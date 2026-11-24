BEGIN;

-- Registrar la tubería nueva, inicialmente sin conexiones.
INSERT INTO aquasense.componente (
    componente_id,
    codigo,
    nombre,
    tipo,
    espacio_id,
    descripcion
)
VALUES (
    '20000000-0000-0000-0000-000000000021',
    'TUB-12',
    'Tubería de reemplazo hacia baños de UD1',
    'TUBERIA',
    '10000000-0000-0000-0000-000000000010',
    'Tubería supuesta instalada durante la reparación de ejemplo.'
);

-- Reemplazar TUB-03 por TUB-12 y generar los eventos.
SELECT aquasense.reemplazar_tuberia(
    '80000000-0000-0000-0000-000000000001'::UUID,
    '20000000-0000-0000-0000-000000000006'::UUID,
    '20000000-0000-0000-0000-000000000021'::UUID,
    '50000000-0000-0000-0000-000000000001'::UUID,
    '60000000-0000-0000-0000-000000000003'::UUID,
    '60000000-0000-0000-0000-000000000004'::UUID,
    jsonb_build_object(
        'atencionId',
        '70000000-0000-0000-0000-000000000002',

        'tipo',
        'REPARACION',

        'fecha',
        to_char(
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        ),

        'descripcion',
        'Se retiró TUB-03 y se instaló TUB-12 en el tramo hacia los baños de estudiantes de UD1.',

        'materiales',
        jsonb_build_array(
            'Tubería PVC',
            'Conexiones de PVC'
        )
    )
);

COMMIT;