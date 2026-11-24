BEGIN;

SELECT aquasense.registrar_atencion(
    '60000000-0000-0000-0000-000000000002'::UUID,
    '50000000-0000-0000-0000-000000000001'::UUID,
    jsonb_build_object(
        'atencionId',
        '70000000-0000-0000-0000-000000000001',

        'tipo',
        'INSPECCION',

        'fecha',
        to_char(
            CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS"Z"'
        ),

        'descripcion',
        'Se revisó visualmente la tubería TUB-03 en los baños de estudiantes de UD1.',

        'componenteId',
        '20000000-0000-0000-0000-000000000006',

        'hallazgos',
        'Se observó una fisura en la tubería y humedad alrededor del tramo.'
    )
);

COMMIT;