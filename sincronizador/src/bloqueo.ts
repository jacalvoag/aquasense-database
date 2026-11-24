import type { Client } from "pg";

export async function obtenerBloqueo(postgres: Client): Promise<boolean> {
  const resultado = await postgres.query(
    "SELECT pg_try_advisory_lock(710911, 1) AS adquirido",
  );

  return resultado.rows[0].adquirido === true;
}