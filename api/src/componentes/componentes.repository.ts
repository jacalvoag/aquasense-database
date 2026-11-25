import { Injectable } from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service.js';

@Injectable()
export class ComponentesRepository {
  constructor(private readonly postgres: PostgresService) {}

  listar() {
    return this.postgres.consultar(`
      SELECT
        c.componente_id,
        c.codigo,
        c.nombre,
        c.tipo,
        c.estado,
c.espacio_id,
e.nombre AS espacio_nombre,
c.descripcion,
EXISTS (
  SELECT 1
  FROM aquasense.conexion AS conexion
  WHERE conexion.componente_origen_id = c.componente_id
     OR conexion.componente_destino_id = c.componente_id
) AS tiene_conexiones
      FROM aquasense.componente AS c
      LEFT JOIN aquasense.espacio AS e
        ON e.espacio_id = c.espacio_id
      ORDER BY c.codigo
    `);
  }

  consultarEstado(parametros: unknown[]) {
    return this.postgres.consultar(
      `
      SELECT
        componente.componente_id,
        componente.codigo,
        componente.estado,
        componente.tipo,
        EXISTS (SELECT 1 FROM aquasense.conexion c WHERE c.componente_origen_id = componente.componente_id OR c.componente_destino_id = componente.componente_id) AS tiene_conexiones,
        (
          SELECT version_red
          FROM aquasense.control_red
          WHERE control_id = 1
        ) AS version_red,
        EXISTS (
          SELECT 1
          FROM aquasense.evento_salida
          WHERE destino = 'GRAFO'
            AND estado <> 'PROCESADO'
        ) AS eventos_sin_procesar
      FROM aquasense.componente AS componente
      WHERE componente.componente_id = $1::uuid
      `,
      parametros,
    );
  }

  consultarControlRed() {
    return this.postgres.consultar(`
      SELECT version_red::text,
             EXISTS (
               SELECT 1 FROM aquasense.evento_salida
               WHERE destino = 'GRAFO' AND estado <> 'PROCESADO'
             ) AS eventos_sin_procesar
      FROM aquasense.control_red
      WHERE control_id = 1
    `);
  }

  crearTuberia(parametros: unknown[]) {
    return this.postgres.consultar(
      `
      INSERT INTO aquasense.componente (
        componente_id,
        codigo,
        nombre,
        tipo,
        estado,
        espacio_id,
        descripcion
      )
      VALUES ($1::uuid, $2, $3, 'TUBERIA', 'ACTIVO', $4::uuid, $5)
      `,
      parametros,
    );
  }
}
