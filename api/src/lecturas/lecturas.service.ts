import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../postgres/postgres.service.js';

@Injectable()
export class LecturasService {
  constructor(private readonly postgres: PostgresService) {}

  async listar() {
    const resultado = await this.postgres.consultar(`
      SELECT
        lectura_id,
        medidor_id,
        codigo_medidor,
        fecha_hora_anterior,
        fecha_hora,
        valor_anterior,
        valor_acumulado,
        consumo_m3
      FROM aquasense.consumo_entre_lecturas
      ORDER BY codigo_medidor, fecha_hora
    `);

    return resultado.rows;
  }

  async registrar(cuerpo: unknown) {
    if (
      typeof cuerpo !== 'object' ||
      cuerpo === null ||
      Array.isArray(cuerpo)
    ) {
      throw new BadRequestException('El cuerpo de la solicitud no es válido.');
    }

    const datos = cuerpo as Record<string, unknown>;

    if (
      typeof datos.medidorId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        datos.medidorId,
      )
    ) {
      throw new BadRequestException('El identificador del medidor no es válido.');
    }

    if (
      typeof datos.fechaHora !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        datos.fechaHora,
      ) ||
      Number.isNaN(Date.parse(datos.fechaHora))
    ) {
      throw new BadRequestException(
        'La fecha debe estar en formato ISO 8601 e incluir zona horaria.',
      );
    }

    // Se acepta el valor como texto para conservar los decimales.
    if (
      typeof datos.valorAcumulado !== 'string' ||
      !/^\d{1,11}(?:\.\d{1,3})?$/.test(datos.valorAcumulado)
    ) {
      throw new BadRequestException(
        'El valor acumulado debe ser un texto numérico no negativo con hasta tres decimales.',
      );
    }

    const lecturaId = randomUUID();

    try {
      await this.postgres.consultar(
        `
          SELECT aquasense.registrar_lectura(
            $1::uuid,
            $2::uuid,
            $3::timestamptz,
            $4::numeric
          )
        `,
        [lecturaId, datos.medidorId, datos.fechaHora, datos.valorAcumulado],
      );
    } catch (error: unknown) {
      const codigo =
        typeof error === 'object' && error !== null && 'code' in error
          ? error.code
          : undefined;

      if (codigo === '23503') {
        throw new NotFoundException('El medidor indicado no existe.');
      }

      if (codigo === '23514') {
        throw new UnprocessableEntityException(
          'La lectura no cumple las reglas del medidor.',
        );
      }

      throw error;
    }

    return {
      lecturaId,
      medidorId: datos.medidorId,
      fechaHora: datos.fechaHora,
      valorAcumulado: datos.valorAcumulado,
    };
  }
}