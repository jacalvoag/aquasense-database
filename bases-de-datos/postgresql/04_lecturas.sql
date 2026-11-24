BEGIN;
CREATE TABLE aquasense.lectura (
    lectura_id uuid PRIMARY KEY,
    medidor_id uuid NOT NULL REFERENCES aquasense.medidor(componente_id) ON DELETE RESTRICT,
    fecha_hora timestamptz NOT NULL,
    valor_acumulado numeric(14,3) NOT NULL CHECK (valor_acumulado >= 0 AND valor_acumulado <> 'NaN'::numeric),
    registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (medidor_id, fecha_hora)
);
CREATE TABLE aquasense.correccion_lectura (
    correccion_id uuid PRIMARY KEY,
    lectura_id uuid NOT NULL REFERENCES aquasense.lectura(lectura_id) ON DELETE RESTRICT,
    valor_anterior numeric(14,3) NOT NULL CHECK (valor_anterior >= 0 AND valor_anterior <> 'NaN'::numeric),
    valor_nuevo numeric(14,3) NOT NULL CHECK (valor_nuevo >= 0 AND valor_nuevo <> 'NaN'::numeric),
    motivo text NOT NULL CHECK (btrim(motivo) <> ''),
    corregido_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (valor_anterior <> valor_nuevo)
);
CREATE INDEX correccion_lectura_historial_idx ON aquasense.correccion_lectura (lectura_id, corregido_en);
COMMIT;
