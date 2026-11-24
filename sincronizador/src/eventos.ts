import type { Client } from "pg";

export async function obtenerEventosPendientes(postgres: Client) {
  return postgres.query(`
    SELECT
      e.evento_id,
      e.destino,
      e.tipo,
      e.reporte_id,
      e.secuencia,
      e.intentos,
      e.datos
    FROM aquasense.evento_salida AS e
    WHERE e.estado = 'PENDIENTE'
      AND (
        e.proximo_intento_en IS NULL
        OR e.proximo_intento_en <= CURRENT_TIMESTAMP
      )
      AND NOT EXISTS (
        SELECT 1
        FROM aquasense.evento_salida AS anterior
        WHERE anterior.destino = e.destino
          AND anterior.secuencia < e.secuencia
          AND anterior.estado <> 'PROCESADO'
          AND (
            e.destino = 'GRAFO'
            OR anterior.reporte_id = e.reporte_id
          )
      )
        AND (
            e.destino <> 'GRAFO'
            OR e.secuencia = 1
            OR EXISTS (
                SELECT 1
                FROM aquasense.evento_salida AS previo
                WHERE previo.destino = 'GRAFO'
                AND previo.secuencia = e.secuencia - 1
                AND previo.estado = 'PROCESADO'
            )
        )
    ORDER BY e.registrado_en, e.evento_id
    LIMIT 20
  `);
}

export async function obtenerEventosEnError(postgres: Client) {
  return postgres.query(`
    SELECT
      evento_id,
      destino,
      tipo,
      reporte_id,
      secuencia,
      intentos
    FROM aquasense.evento_salida
    WHERE estado = 'ERROR'
    ORDER BY registrado_en, evento_id
    LIMIT 20
  `);
}