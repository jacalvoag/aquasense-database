import type { Document } from "mongodb";

export function destinoDe(conexion: Document): {
  tipo: "Componente" | "Espacio";
  id: string;
} {
  const componente = conexion.componente_destino_id;
  const espacio = conexion.espacio_destino_id;

  if (typeof componente === "string" && espacio === null) {
    return { tipo: "Componente", id: componente };
  }

  if (componente === null && typeof espacio === "string") {
    return { tipo: "Espacio", id: espacio };
  }

  throw new Error("La conexión debe tener exactamente un destino.");
}