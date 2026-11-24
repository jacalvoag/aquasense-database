import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

import { registrarFallo } from "./fallos";

function variable(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}.`);
  }

  return valor;
}

test("registra fallos documentales y respeta un evento procesado", async () => {
  const postgres = new pg.Client({
    host: variable("PGHOST"),
    port: Number(variable("PGPORT")),
    database: variable("PGDATABASE"),
    user: variable("PGUSER"),
    password: variable("PGPASSWORD"),
  });

  const reporteId = randomUUID();
  const eventoId = randomUUID();
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

    await postgres.query("BEGIN");
    transaccionIniciada = true;

    await postgres.query(
      `
      SELECT aquasense.crear_reporte(
        $1::uuid, $2::uuid, $3::uuid, $4::text, $5::text
      )
      `,
      [
        reporteId,
        eventoId,
        "10000000-0000-0000-0000-000000000010",
        "Reporte para prueba de fallos.",
        "Ubicación de prueba",
      ],
    );

    const evento = {
      evento_id: eventoId,
      destino: "DOCUMENTAL",
    };

    assert.equal(await registrarFallo(postgres, evento), "PENDIENTE");
    assert.equal(await registrarFallo(postgres, evento), "PENDIENTE");
    assert.equal(await registrarFallo(postgres, evento), "ERROR");

    let resultado = await postgres.query(
      `
      SELECT estado, intentos, proximo_intento_en
      FROM aquasense.evento_salida
      WHERE evento_id = $1::uuid
      `,
      [eventoId],
    );

    assert.equal(resultado.rows[0].estado, "ERROR");
    assert.equal(resultado.rows[0].intentos, 3);
    assert.equal(resultado.rows[0].proximo_intento_en, null);

    await postgres.query(
      "SELECT aquasense.reactivar_evento_documental($1::uuid)",
      [eventoId],
    );

    resultado = await postgres.query(
      `
      SELECT estado, intentos
      FROM aquasense.evento_salida
      WHERE evento_id = $1::uuid
      `,
      [eventoId],
    );

    assert.equal(resultado.rows[0].estado, "PENDIENTE");
    assert.equal(resultado.rows[0].intentos, 0);

    // Esta confirmación es parte de la prueba y se revierte con ROLLBACK.
    await postgres.query(
      "SELECT aquasense.confirmar_evento_documental($1::uuid)",
      [eventoId],
    );

    assert.equal(await registrarFallo(postgres, evento), "PROCESADO");

    resultado = await postgres.query(
      `
      SELECT estado, intentos
      FROM aquasense.evento_salida
      WHERE evento_id = $1::uuid
      `,
      [eventoId],
    );

    assert.equal(resultado.rows[0].estado, "PROCESADO");
    assert.equal(resultado.rows[0].intentos, 0);
  } finally {
    if (transaccionIniciada) {
      await postgres.query("ROLLBACK");
    }

    await postgres.end();
  }
});