import { fechaValida } from '../common/fecha.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LecturasRepository } from './lecturas.repository.js';

@Injectable()
export class LecturasService {
  constructor(private readonly repositorio: LecturasRepository) {}

  async listar() {
    const resultado = await this.repositorio.listar();

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
      throw new BadRequestException(
        'El identificador del medidor no es válido.',
      );
    }

    if (!fechaValida(datos.fechaHora)) {
      throw new BadRequestException(
        'La fecha debe ser válida e incluir zona horaria.',
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
      await this.repositorio.registrar([
        lecturaId,
        datos.medidorId,
        datos.fechaHora,
        datos.valorAcumulado,
      ]);
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
