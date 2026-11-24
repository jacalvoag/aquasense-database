import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { destinoDe } from "./conexion";

describe("destinoDe", () => {
  it("identifica un componente como destino", () => {
    assert.deepEqual(
      destinoDe({
        componente_destino_id: "componente-1",
        espacio_destino_id: null,
      }),
      { tipo: "Componente", id: "componente-1" },
    );
  });

  it("identifica un espacio como destino", () => {
    assert.deepEqual(
      destinoDe({
        componente_destino_id: null,
        espacio_destino_id: "espacio-1",
      }),
      { tipo: "Espacio", id: "espacio-1" },
    );
  });

  it("rechaza dos destinos", () => {
    assert.throws(() =>
      destinoDe({
        componente_destino_id: "componente-1",
        espacio_destino_id: "espacio-1",
      }),
    );
  });

  it("rechaza una conexión sin destino", () => {
    assert.throws(() =>
      destinoDe({
        componente_destino_id: null,
        espacio_destino_id: null,
      }),
    );
  });
});