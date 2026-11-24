import type { Client } from "pg";

export type EventoFallido = {
  evento_id: string;
  destino: string;
};

export async function registrarFallo(
  postgres: Client,
  evento: EventoFallido,
): Promise<string> {
  const resultadoEstado = await postgres.query(
    `
    SELECT estado
    FROM aquasense.evento_salida
    WHERE evento_id = $1::uuid
    `,
    [evento.evento_id],
  );

  const estado = resultadoEstado.rows[0]?.estado;

  if (estado === "PROCESADO") {
    return "PROCESADO";
  }

  if (estado !== "PENDIENTE") {
    return "NO_PENDIENTE";
  }

  const funcion =
    evento.destino === "DOCUMENTAL"
      ? "aquasense.registrar_fallo_documental"
      : evento.destino === "GRAFO"
        ? "aquasense.registrar_fallo_grafo"
        : null;

  if (funcion === null) {
    throw new Error("Destino de evento no reconocido.");
  }

  const resultado = await postgres.query(
    `
    SELECT ${funcion}(
      $1::uuid,
      $2::text,
      CURRENT_TIMESTAMP + INTERVAL '1 minute'
    ) AS estado
    `,
    [
      evento.evento_id,
      "Falló el procesamiento del evento; revisar la salida del sincronizador.",
    ],
  );

  return resultado.rows[0].estado;
}