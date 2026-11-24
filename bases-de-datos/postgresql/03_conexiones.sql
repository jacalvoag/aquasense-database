BEGIN;
CREATE TABLE aquasense.conexion (
    conexion_id uuid PRIMARY KEY,
    componente_origen_id uuid NOT NULL REFERENCES aquasense.componente(componente_id) ON DELETE RESTRICT,
    componente_destino_id uuid REFERENCES aquasense.componente(componente_id) ON DELETE RESTRICT,
    espacio_destino_id uuid REFERENCES aquasense.espacio(espacio_id) ON DELETE RESTRICT,
    creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((componente_destino_id IS NOT NULL) <> (espacio_destino_id IS NOT NULL)),
    CHECK (componente_destino_id IS NULL OR componente_origen_id <> componente_destino_id)
);
-- Cada destino tiene como máximo una entrada actual; una unión puede tener múltiples salidas.
CREATE UNIQUE INDEX conexion_entrada_componente_uq ON aquasense.conexion (componente_destino_id) WHERE componente_destino_id IS NOT NULL;
CREATE UNIQUE INDEX conexion_entrada_espacio_uq ON aquasense.conexion (espacio_destino_id) WHERE espacio_destino_id IS NOT NULL;
CREATE INDEX conexion_origen_idx ON aquasense.conexion (componente_origen_id);
COMMIT;
