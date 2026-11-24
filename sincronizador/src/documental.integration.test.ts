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

test("un error documental no bloquea otro reporte", async () => {
  const postgres = new pg.Client({
    host: variable("PGHOST"),
    port: Number(variable("PGPORT")),
    database: variable("PGDATABASE"),
    user: variable("PGUSER"),
    password: variable("PGPASSWORD"),
  });

  const reporteConError = randomUUID();
  const reporteDisponible = randomUUID();
  const eventoConError = randomUUID();
  const eventoDisponible = randomUUID();
  const espacioId = "10000000-0000-0000-0000-000000000010";

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

    await postgres.query(
      `
      SELECT aquasense.crear_reporte(
        $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text
      )
      `,
      [
        reporteConError,
        eventoConError,
        espacioId,
        "Reporte de prueba con evento en error.",
        "Ubicación de prueba",
      ],
    );

    await postgres.query(
      `
      SELECT aquasense.crear_reporte(
        $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text
      )
      `,
      [
        reporteDisponible,
        eventoDisponible,
        espacioId,
        "Reporte de prueba con evento disponible.",
        "Ubicación de prueba",
      ],
    );

    await postgres.query(
      `
      UPDATE aquasense.evento_salida
      SET estado = 'ERROR'
      WHERE evento_id = $1::uuid
      `,
      [eventoConError],
    );

    let pendientes = await obtenerEventosPendientes(postgres);

    assert.equal(
      pendientes.rows.some((evento) => evento.evento_id === eventoConError),
      false,
      "Un evento en ERROR no debe seleccionarse.",
    );

    assert.equal(
      pendientes.rows.some(
        (evento) => evento.evento_id === eventoDisponible,
      ),
      true,
      "El evento de otro reporte debe seguir disponible.",
    );

    await postgres.query(
      `
      UPDATE aquasense.evento_salida
      SET proximo_intento_en = CURRENT_TIMESTAMP + INTERVAL '1 hour'
      WHERE evento_id = $1::uuid
      `,
      [eventoDisponible],
    );

    pendientes = await obtenerEventosPendientes(postgres);

    assert.equal(
      pendientes.rows.some(
        (evento) => evento.evento_id === eventoDisponible,
      ),
      false,
      "El evento no debe seleccionarse antes de su próximo intento.",
    );
  } finally {
    if (transaccionIniciada) {
      await postgres.query("ROLLBACK");
    }

    await postgres.end();
  }
});