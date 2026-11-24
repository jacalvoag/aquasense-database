import { PostgresService } from '../postgres/postgres.service.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MongodbService } from '../mongodb/mongodb.service.js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ReportesService {
  constructor(
    private readonly postgres: PostgresService,
    private readonly mongodb: MongodbService
  ) {}

  async listar() {
    const resultado = await this.postgres.consultar(`
      SELECT
        r.reporte_id,
        r.espacio_id,
        espacio.nombre AS espacio_nombre,
        r.estado,
        r.secuencia_documental,
        r.registrado_en,
        r.actualizado_en,
        r.cerrado_en,
        evento.estado AS estado_evento_documental
      FROM aquasense.reporte AS r
      JOIN aquasense.espacio AS espacio
        ON espacio.espacio_id = r.espacio_id
      LEFT JOIN aquasense.evento_salida AS evento
        ON evento.reporte_id = r.reporte_id
       AND evento.destino = 'DOCUMENTAL'
       AND evento.secuencia = r.secuencia_documental
      ORDER BY r.registrado_en DESC, r.reporte_id
    `);

    return resultado.rows;
  }

  async consultarExpediente(reporteId: string) {
    const formatoUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!formatoUuid.test(reporteId)) {
      throw new BadRequestException('El identificador del reporte no es válido.');
    }

    const id = reporteId.toLowerCase();

    const resultado = await this.postgres.consultar(
      `
      SELECT
        r.reporte_id,
        r.secuencia_documental,
        evento.evento_id,
        evento.estado AS estado_evento
      FROM aquasense.reporte AS r
      LEFT JOIN aquasense.evento_salida AS evento
        ON evento.reporte_id = r.reporte_id
      AND evento.destino = 'DOCUMENTAL'
      AND evento.secuencia = r.secuencia_documental
      WHERE r.reporte_id = $1::uuid
      `,
      [id],
    );

    if (resultado.rows.length === 0) {
      throw new NotFoundException('El reporte no existe.');
    }

    const reporte = resultado.rows[0];

  if (
    reporte.estado_evento === 'PENDIENTE' ||
    reporte.estado_evento === 'ERROR'
  ) {
    return {
      reporteId: id,
      estadoDocumental: reporte.estado_evento,
      expediente: null,
    };
  }

  if (reporte.estado_evento !== 'PROCESADO' || !reporte.evento_id) {
    throw new ServiceUnavailableException(
      'No está disponible el estado documental del reporte.',
    );
  }

  let expediente;

  try {
    expediente = await this.mongodb.buscarExpediente(id);
  } catch {
    throw new ServiceUnavailableException(
      'No fue posible consultar el expediente en MongoDB.',
    );
  }

  const secuenciaMongo =
    expediente?.ultimaSecuenciaAplicada?.toString();

  if (
    !expediente ||
    secuenciaMongo !== reporte.secuencia_documental ||
    expediente.ultimoEventoId !== reporte.evento_id
  ) {
    throw new ServiceUnavailableException(
      'El expediente no coincide con el último evento confirmado.',
    );
  }

  return {
    reporteId: id,
    estadoDocumental: 'PROCESADO',
    expediente: {
      ...expediente,
      ultimaSecuenciaAplicada: secuenciaMongo,
    },
  };
}

async crear(entrada: unknown) {
  if (
    !entrada ||
    typeof entrada !== 'object' ||
    Array.isArray(entrada)
  ) {
    throw new BadRequestException('El cuerpo del reporte no es válido.');
  }

  const datos = entrada as Record<string, unknown>;
  const formatoUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    typeof datos.espacioId !== 'string' ||
    !formatoUuid.test(datos.espacioId)
  ) {
    throw new BadRequestException('El espacioId no es válido.');
  }

  if (
    typeof datos.descripcionInicial !== 'string' ||
    datos.descripcionInicial.trim() === ''
  ) {
    throw new BadRequestException(
      'La descripción inicial es obligatoria.',
    );
  }

  if (
    datos.referenciaUbicacion != null &&
    typeof datos.referenciaUbicacion !== 'string'
  ) {
    throw new BadRequestException(
      'La referencia de ubicación debe ser texto.',
    );
  }

  const reporteId = randomUUID();
  const eventoId = randomUUID();

  try {
    await this.postgres.consultar(
      `
      SELECT aquasense.crear_reporte(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::text,
        $5::text
      )
      `,
      [
        reporteId,
        eventoId,
        datos.espacioId.toLowerCase(),
        datos.descripcionInicial.trim(),
        typeof datos.referenciaUbicacion === 'string'
          ? datos.referenciaUbicacion.trim()
          : null,
      ],
    );
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23503'
    ) {
      throw new NotFoundException('El espacio indicado no existe.');
    }

    throw error;
  }

  return {
    reporteId,
    eventoId,
    estadoReporte: 'PENDIENTE',
    estadoDocumentalInicial: 'PENDIENTE',
  };
}
}