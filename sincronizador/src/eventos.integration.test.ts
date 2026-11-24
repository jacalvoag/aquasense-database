import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

import { obtenerEventosPendientes } from "./eventos";

function variable(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}.`);
  }

  return valor;
}

test("selecciona eventos de grafo en orden y respeta el reintento", async () => {
  const postgres = new pg.Client({
    host: variable("PGHOST"),
    port: Number(variable("PGPORT")),
    database: variable("PGDATABASE"),
    user: variable("PGUSER"),
    password: variable("PGPASSWORD"),
  });

  const eventoAnterior = randomUUID();
  const eventoSiguiente = randomUUID();
  let transaccionIniciada = false;

  try {
    await postgres.connect();

    const base = await postgres.query(
      "SELECT current_database() AS nombre",
    );

    if (base.rows[0].nombre !== "aquasense_reconstruccion") {
      throw new Error(
        "La prueba solo debe ejecutarse en aquasense_reconstruccion.",
      );
    }

    const pendientesIniciales = await obtenerEventosPendientes(postgres);

    if (pendientesIniciales.rows.length !== 0) {
      throw new Error(
        "La prueba requiere que no haya eventos pendientes disponibles.",
      );
    }

    await postgres.query("BEGIN");
    transaccionIniciada = true;

    const resultadoSecuencia = await postgres.query(`
      SELECT COALESCE(MAX(secuencia), 0) AS ultima
      FROM aquasense.evento_salida
      WHERE destino = 'GRAFO'
    `);

    const siguiente = BigInt(resultadoSecuencia.rows[0].ultima) + 1n;
    const posterior = siguiente + 1n;

    // El evento anterior empieza en ERROR y bloquea al siguiente.
    await postgres.query(
      `
      INSERT INTO aquasense.evento_salida (
        evento_id, destino, tipo, secuencia, datos, estado
      )
      VALUES
        ($1::uuid, 'GRAFO', 'ACTUALIZAR_RED', $2::bigint, '{}'::jsonb, 'ERROR'),
        ($3::uuid, 'GRAFO', 'ACTUALIZAR_RED', $4::bigint, '{}'::jsonb, 'PENDIENTE')
      `,
      [
        eventoAnterior,
        siguiente.toString(),
        eventoSiguiente,
        posterior.toString(),
      ],
    );

    let pendientes = await obtenerEventosPendientes(postgres);

    assert.equal(
      pendientes.rows.some((evento) => evento.evento_id === eventoSiguiente),
      false,
      "No debe seleccionar un evento si el anterior está en ERROR.",
    );

    // Al quedar procesado el anterior, el siguiente se vuelve elegible.
    await postgres.query(
      `
      UPDATE aquasense.evento_salida
      SET estado = 'PROCESADO',
          procesado_en = CURRENT_TIMESTAMP
      WHERE evento_id = $1::uuid
      `,
      [eventoAnterior],
    );

    pendientes = await obtenerEventosPendientes(postgres);

    assert.equal(
      pendientes.rows.some((evento) => evento.evento_id === eventoSiguiente),
      true,
      "Debe seleccionar el evento cuando el anterior está procesado.",
    );

    // Si el reintento está programado a futuro, no debe seleccionarlo.
    await postgres.query(
      `
      UPDATE aquasense.evento_salida
      SET proximo_intento_en = CURRENT_TIMESTAMP + INTERVAL '1 hour'
      WHERE evento_id = $1::uuid
      `,
      [eventoSiguiente],
    );

    pendientes = await obtenerEventosPendientes(postgres);

    assert.equal(
      pendientes.rows.some((evento) => evento.evento_id === eventoSiguiente),
      false,
      "No debe seleccionar el evento antes de su próximo intento.",
    );
  } finally {
    if (transaccionIniciada) {
      await postgres.query("ROLLBACK");
    }

    await postgres.end();
  }
});