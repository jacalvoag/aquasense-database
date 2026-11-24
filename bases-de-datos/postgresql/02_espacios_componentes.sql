BEGIN;
CREATE TABLE aquasense.espacio (
    espacio_id uuid PRIMARY KEY,
    nombre varchar(150) NOT NULL CHECK (btrim(nombre) <> ''),
    tipo varchar(30) NOT NULL CHECK (tipo IN ('EDIFICIO','BAÑO','LABORATORIO','OFICINA','CAFETERIA','ZONA_RIEGO','OTRO')),
    espacio_contenedor_id uuid REFERENCES aquasense.espacio(espacio_id) ON DELETE RESTRICT,
    descripcion text,
    creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (espacio_contenedor_id IS NULL OR espacio_contenedor_id <> espacio_id)
);
CREATE TABLE aquasense.componente (
    componente_id uuid PRIMARY KEY,
    codigo varchar(40) NOT NULL UNIQUE CHECK (codigo = upper(btrim(codigo)) AND codigo <> ''),
    nombre varchar(150) NOT NULL CHECK (btrim(nombre) <> ''),
    tipo varchar(20) NOT NULL CHECK (tipo IN ('CISTERNA','TUBERIA','UNION','VALVULA','MEDIDOR')),
    estado varchar(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','RETIRADO')),
    espacio_id uuid REFERENCES aquasense.espacio(espacio_id) ON DELETE RESTRICT,
    descripcion text,
    creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (componente_id, tipo)
);
-- El tipo constante permite verificar el subtipo mediante clave foránea compuesta.
CREATE TABLE aquasense.valvula (
    componente_id uuid PRIMARY KEY,
    tipo varchar(20) NOT NULL DEFAULT 'VALVULA' CHECK (tipo = 'VALVULA'),
    posicion varchar(20) NOT NULL DEFAULT 'DESCONOCIDA' CHECK (posicion IN ('ABIERTA','CERRADA','DESCONOCIDA')),
    posicion_registrada_en timestamptz,
    FOREIGN KEY (componente_id, tipo) REFERENCES aquasense.componente(componente_id, tipo) ON DELETE RESTRICT,
    CHECK (posicion = 'DESCONOCIDA' OR posicion_registrada_en IS NOT NULL)
);
CREATE TABLE aquasense.medidor (
    componente_id uuid PRIMARY KEY,
    tipo varchar(20) NOT NULL DEFAULT 'MEDIDOR' CHECK (tipo = 'MEDIDOR'),
    unidad varchar(10) NOT NULL DEFAULT 'm3' CHECK (unidad = 'm3'),
    FOREIGN KEY (componente_id, tipo) REFERENCES aquasense.componente(componente_id, tipo) ON DELETE RESTRICT
);
COMMIT;
