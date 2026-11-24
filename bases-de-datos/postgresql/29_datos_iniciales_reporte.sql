BEGIN;

-- Crear el reporte y dejar pendiente la creación de su expediente.
SELECT aquasense.crear_reporte(
    '50000000-0000-0000-0000-000000000001'::UUID,
    '60000000-0000-0000-0000-000000000001'::UUID,
    '10000000-0000-0000-0000-000000000010'::UUID,
    'Se observó humedad cerca de una tubería en los baños de estudiantes de UD1.',
    'Cerca de los lavabos'
);

-- Asociar la tubería que se desea revisar.
INSERT INTO aquasense.reporte_componente (
    reporte_id,
    componente_id
)
VALUES (
    '50000000-0000-0000-0000-000000000001'::UUID,
    '20000000-0000-0000-0000-000000000006'::UUID
);

COMMIT;