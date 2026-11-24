import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

import { obtenerBloqueo } from "./bloqueo";

function variable(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}.`);
  }

  return valor;
}

function crearCliente(): pg.Client {
  return new pg.Client({
    host: variable("PGHOST"),
    port: Number(variable("PGPORT")),
    database: variable("PGDATABASE"),
    user: variable("PGUSER"),
    password: variable("PGPASSWORD"),
  });
}

test("solo una sesión obtiene el bloqueo a la vez", async () => {
  const primera = crearCliente();
  const segunda = crearCliente();

  try {
    await primera.connect();
    await segunda.connect();

    const base = await primera.query(
      "SELECT current_database() AS nombre",
    );

    if (base.rows[0].nombre !== "aquasense_reconstruccion") {
      throw new Error(
        "La prueba solo debe ejecutarse en aquasense_reconstruccion.",
      );
    }

    assert.equal(await obtenerBloqueo(primera), true);
    assert.equal(await obtenerBloqueo(segunda), false);

    const liberado = await primera.query(
      "SELECT pg_advisory_unlock(710911, 1) AS liberado",
    );

    assert.equal(liberado.rows[0].liberado, true);
    assert.equal(await obtenerBloqueo(segunda), true);
  } finally {
    // Al cerrar las sesiones se liberan los bloqueos que conserven.
    await Promise.allSettled([primera.end(), segunda.end()]);
  }
});