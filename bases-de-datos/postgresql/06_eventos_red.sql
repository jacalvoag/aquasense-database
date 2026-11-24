BEGIN;
CREATE TABLE aquasense.control_red (
    control_id smallint PRIMARY KEY CHECK (control_id = 1),
    version_red bigint NOT NULL DEFAULT 0 CHECK (version_red >= 0),
    actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO aquasense.control_red (control_id) VALUES (1);
CREATE TABLE aquasense.evento_salida (
    evento_id uuid PRIMARY KEY,
    destino varchar(20) NOT NULL CHECK (destino IN ('DOCUMENTAL','GRAFO')),
    tipo varchar(40) NOT NULL CHECK (btrim(tipo) <> ''),
    reporte_id uuid REFERENCES aquasense.reporte(reporte_id) ON DELETE RESTRICT,
    secuencia bigint NOT NULL CHECK (secuencia > 0),
    datos jsonb NOT NULL CHECK (jsonb_typeof(datos) = 'object'),
    estado varchar(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','PROCESADO','ERROR')),
    intentos integer NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    proximo_intento_en timestamptz,
    ultimo_error text,
    registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    procesado_en timestamptz,
    CHECK ((destino = 'DOCUMENTAL' AND reporte_id IS NOT NULL) OR (destino = 'GRAFO' AND reporte_id IS NULL)),
    CHECK ((estado = 'PROCESADO') = (procesado_en IS NOT NULL))
);
CREATE UNIQUE INDEX evento_documental_secuencia_uq ON aquasense.evento_salida (reporte_id, secuencia) WHERE destino = 'DOCUMENTAL';
CREATE UNIQUE INDEX evento_grafo_secuencia_uq ON aquasense.evento_salida (secuencia) WHERE destino = 'GRAFO';
CREATE UNIQUE INDEX evento_documental_uno_pendiente_uq ON aquasense.evento_salida (reporte_id) WHERE destino = 'DOCUMENTAL' AND estado IN ('PENDIENTE','ERROR');
CREATE INDEX evento_pendiente_idx ON aquasense.evento_salida (destino, proximo_intento_en, registrado_en) WHERE estado = 'PENDIENTE';
COMMIT;
