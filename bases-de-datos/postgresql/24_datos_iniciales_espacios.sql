BEGIN;

-- Edificios y espacios generales identificados en el mapa.
INSERT INTO aquasense.espacio (
    espacio_id,
    nombre,
    tipo,
    descripcion
)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        'UD1',
        'EDIFICIO',
        'Edificio identificado por el equipo en el mapa del campus.'
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        'UD2',
        'EDIFICIO',
        'Edificio identificado por el equipo en el mapa del campus.'
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        'UD3',
        'EDIFICIO',
        'Edificio identificado por el equipo en el mapa del campus.'
    ),
    (
        '10000000-0000-0000-0000-000000000004',
        'UD4',
        'EDIFICIO',
        'Edificio identificado por el equipo en el mapa del campus.'
    ),
    (
        '10000000-0000-0000-0000-000000000005',
        'UD5',
        'EDIFICIO',
        'Edificio identificado por el equipo en el mapa del campus.'
    ),
    (
        '10000000-0000-0000-0000-000000000006',
        'Cafetería',
        'CAFETERIA',
        'Espacio identificado por el equipo en el mapa del campus.'
    ),
    (
        '10000000-0000-0000-0000-000000000007',
        'Biblioteca',
        'OTRO',
        'Espacio identificado por el equipo en el mapa del campus.'
    ),
    (
        '10000000-0000-0000-0000-000000000008',
        'Laboratorios',
        'LABORATORIO',
        'Espacio identificado por el equipo en el mapa del campus.'
    ),
    (
        '10000000-0000-0000-0000-000000000009',
        'Taller de mecatrónica y manufactura',
        'OTRO',
        'Espacio identificado por el equipo en el mapa del campus.'
    );

-- Espacios interiores supuestos para el escenario.
INSERT INTO aquasense.espacio (
    espacio_id,
    nombre,
    tipo,
    espacio_contenedor_id,
    descripcion
)
VALUES
    (
        '10000000-0000-0000-0000-000000000010',
        'Baños de estudiantes de UD1',
        'BAÑO',
        '10000000-0000-0000-0000-000000000001',
        'Espacio interior supuesto para el escenario del proyecto.'
    ),
    (
        '10000000-0000-0000-0000-000000000011',
        'Baños de docentes de UD2',
        'BAÑO',
        '10000000-0000-0000-0000-000000000002',
        'Espacio interior supuesto para el escenario del proyecto.'
    );

-- Zonas de riego aproximadas según las marcas del mapa.
INSERT INTO aquasense.espacio (
    espacio_id,
    nombre,
    tipo,
    descripcion
)
VALUES
    (
        '10000000-0000-0000-0000-000000000012',
        'Zona de riego cercana a UD1',
        'ZONA_RIEGO',
        'Ubicación aproximada según la zona marcada en el mapa.'
    ),
    (
        '10000000-0000-0000-0000-000000000013',
        'Zona de riego cercana a UD2',
        'ZONA_RIEGO',
        'Ubicación aproximada según la zona marcada en el mapa.'
    ),
    (
        '10000000-0000-0000-0000-000000000014',
        'Zona de riego cercana a la biblioteca',
        'ZONA_RIEGO',
        'Ubicación aproximada según la zona marcada en el mapa.'
    );

COMMIT;