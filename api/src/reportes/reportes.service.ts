import { PostgresService } from '../postgres/postgres.service.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MongodbService } from '../mongodb/mongodb.service.js';

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
}