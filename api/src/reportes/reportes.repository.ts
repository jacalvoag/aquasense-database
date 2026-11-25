import { Injectable } from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service.js';

@Injectable()
export class ReportesRepository {
  constructor(private readonly postgres: PostgresService) {}

  listar() {
    return this.postgres.consultar(`
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
  }

  consultarEstadoDocumental(parametros: unknown[]) {
    return this.postgres.consultar(
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
      parametros,
    );
  }

  crear(parametros: unknown[]) {
    return this.postgres.consultar(
      `
      SELECT aquasense.crear_reporte(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::text,
        $5::text
      )
      `,
      parametros,
    );
  }

  registrarAtencion(parametros: unknown[]) {
    return this.postgres.consultar(
      `
      SELECT aquasense.registrar_atencion(
        $1::uuid,
        $2::uuid,
        $3::jsonb
      )
      `,
      parametros,
    );
  }

  cerrar(parametros: unknown[]) {
    return this.postgres.consultar(
      'SELECT aquasense.cerrar_reporte($1::uuid)',
      parametros,
    );
  }

  reemplazarTuberia(parametros: unknown[]) {
    return this.postgres.consultar(
      `
      SELECT aquasense.reemplazar_tuberia(
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5::uuid,
        $6::uuid,
        $7::jsonb
      )
      `,
      parametros,
    );
  }

  consultarEvento(parametros: unknown[]) {
    return this.postgres.consultar(
      `
    SELECT
      evento_id,
      destino,
      tipo,
      estado,
      secuencia,
      intentos,
      registrado_en,
      procesado_en
    FROM aquasense.evento_salida
    WHERE evento_id = $1::uuid
      AND (
        (destino = 'DOCUMENTAL' AND reporte_id = $2::uuid)
        OR
        (
          destino = 'GRAFO'
          AND datos -> 'cambio' ->> 'reporteId' = ($2::uuid)::text
        )
      )
    `,
      parametros,
    );
  }
}
