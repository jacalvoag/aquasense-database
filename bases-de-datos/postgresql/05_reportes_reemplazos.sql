BEGIN;
CREATE TABLE aquasense.reporte (
    reporte_id uuid PRIMARY KEY,
    espacio_id uuid NOT NULL REFERENCES aquasense.espacio(espacio_id) ON DELETE RESTRICT,
    estado varchar(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','EN_ATENCION','CERRADO')),
    secuencia_documental bigint NOT NULL DEFAULT 0 CHECK (secuencia_documental >= 0),
    registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cerrado_en timestamptz,
    CHECK ((estado = 'CERRADO') = (cerrado_en IS NOT NULL))
);
CREATE TABLE aquasense.reporte_componente (
    reporte_id uuid NOT NULL REFERENCES aquasense.reporte(reporte_id) ON DELETE RESTRICT,
    componente_id uuid NOT NULL REFERENCES aquasense.componente(componente_id) ON DELETE RESTRICT,
    PRIMARY KEY (reporte_id, componente_id)
);
CREATE TABLE aquasense.reemplazo_tuberia (
    reemplazo_id uuid PRIMARY KEY,
    tuberia_anterior_id uuid NOT NULL REFERENCES aquasense.componente(componente_id) ON DELETE RESTRICT,
    tuberia_nueva_id uuid NOT NULL REFERENCES aquasense.componente(componente_id) ON DELETE RESTRICT,
    reporte_id uuid NOT NULL REFERENCES aquasense.reporte(reporte_id) ON DELETE RESTRICT,
    registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (tuberia_anterior_id <> tuberia_nueva_id),
    UNIQUE (tuberia_anterior_id),
    UNIQUE (tuberia_nueva_id)
);
CREATE INDEX reporte_espacio_idx ON aquasense.reporte (espacio_id);
CREATE INDEX reporte_componente_por_componente_idx ON aquasense.reporte_componente (componente_id);
COMMIT;
