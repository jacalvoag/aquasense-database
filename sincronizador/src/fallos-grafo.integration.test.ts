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

test("registra fallos de grafo y permite reactivar el evento", async () => {
  const postgres = new pg.Client({
    host: variable("PGHOST"),
    port: Number(variable("PGPORT")),
    database: variable("PGDATABASE"),
    user: variable("PGUSER"),
    password: variable("PGPASSWORD"),
  });

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

    // La nueva versión solo existe dentro de esta transacción.
    const control = await postgres.query(`
      UPDATE aquasense.control_red
      SET version_red = version_red + 1
      WHERE control_id = 1
      RETURNING version_red
    `);

    assert.equal(control.rows.length, 1);

    const version = BigInt(control.rows[0].version_red);

    if (version > 1n) {
      const anterior = await postgres.query(
        `
        SELECT estado
        FROM aquasense.evento_salida
        WHERE destino = 'GRAFO'
          AND secuencia = $1::bigint
        `,
        [(version - 1n).toString()],
      );

      assert.equal(
        anterior.rows[0]?.estado,
        "PROCESADO",
        "La prueba requiere que el evento de grafo anterior esté procesado.",
      );
    }

    await postgres.query(
      `
      INSERT INTO aquasense.evento_salida (
        evento_id, destino, tipo, secuencia, datos
      )
      VALUES (
        $1::uuid, 'GRAFO', 'ACTUALIZAR_RED', $2::bigint, '{}'::jsonb
      )
      `,
      [eventoId, version.toString()],
    );

    const evento = {
      evento_id: eventoId,
      destino: "GRAFO",
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
      "SELECT aquasense.reactivar_evento_grafo($1::uuid)",
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

    // Confirmación ficticia, revertida al final de la prueba.
    await postgres.query(
      "SELECT aquasense.confirmar_evento_grafo($1::uuid)",
      [eventoId],
    );

    assert.equal(await registrarFallo(postgres, evento), "PROCESADO");
  } finally {
    if (transaccionIniciada) {
      await postgres.query("ROLLBACK");
    }

    await postgres.end();
  }
});