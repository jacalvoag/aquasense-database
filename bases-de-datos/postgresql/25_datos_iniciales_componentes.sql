BEGIN;

INSERT INTO aquasense.componente (
    componente_id,
    codigo,
    nombre,
    tipo,
    espacio_id,
    descripcion
)
VALUES
    -- Sistema supuesto de UD1.
    (
        '20000000-0000-0000-0000-000000000001',
        'CIS-01',
        'Cisterna del sistema UD1',
        'CISTERNA',
        '10000000-0000-0000-0000-000000000001',
        'Ubicación y abastecimiento supuestos.'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        'MED-01',
        'Medidor del sistema UD1',
        'MEDIDOR',
        '10000000-0000-0000-0000-000000000001',
        'Medidor supuesto.'
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        'UNI-01',
        'Unión del sistema UD1',
        'UNION',
        '10000000-0000-0000-0000-000000000001',
        'Ramificación supuesta hacia baños y riego.'
    ),
    (
        '20000000-0000-0000-0000-000000000004',
        'TUB-01',
        'Tubería de cisterna a medidor UD1',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000001',
        'Tubería supuesta.'
    ),
    (
        '20000000-0000-0000-0000-000000000005',
        'TUB-02',
        'Tubería de medidor a unión UD1',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000001',
        'Tubería supuesta.'
    ),
    (
        '20000000-0000-0000-0000-000000000006',
        'TUB-03',
        'Tubería hacia baños de UD1',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000010',
        'Tubería interna supuesta.'
    ),
    (
        '20000000-0000-0000-0000-000000000007',
        'TUB-04',
        'Tubería hacia zona de riego UD1',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000012',
        'Tubería supuesta.'
    ),

    -- Sistema supuesto de UD2.
    (
        '20000000-0000-0000-0000-000000000008',
        'CIS-02',
        'Cisterna del sistema UD2',
        'CISTERNA',
        '10000000-0000-0000-0000-000000000002',
        'Ubicación y abastecimiento supuestos.'
    ),
    (
        '20000000-0000-0000-0000-000000000009',
        'MED-02',
        'Medidor del sistema UD2',
        'MEDIDOR',
        '10000000-0000-0000-0000-000000000002',
        'Medidor supuesto.'
    ),
    (
        '20000000-0000-0000-0000-000000000010',
        'UNI-02',
        'Unión del sistema UD2',
        'UNION',
        '10000000-0000-0000-0000-000000000002',
        'Ramificación supuesta hacia baños y riego.'
    ),
    (
        '20000000-0000-0000-0000-000000000011',
        'TUB-05',
        'Tubería de cisterna a medidor UD2',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000002',
        'Tubería supuesta.'
    ),
    (
        '20000000-0000-0000-0000-000000000012',
        'TUB-06',
        'Tubería de medidor a unión UD2',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000002',
        'Tubería supuesta.'
    ),
    (
        '20000000-0000-0000-0000-000000000013',
        'TUB-07',
        'Tubería hacia baños de UD2',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000011',
        'Tubería interna supuesta.'
    ),
    (
        '20000000-0000-0000-0000-000000000014',
        'TUB-08',
        'Tubería hacia zona de riego UD2',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000013',
        'Tubería supuesta.'
    ),

    -- Sistema supuesto de riego cercano a la biblioteca.
    (
        '20000000-0000-0000-0000-000000000015',
        'CIS-03',
        'Cisterna del sistema de biblioteca',
        'CISTERNA',
        '10000000-0000-0000-0000-000000000007',
        'Ubicación y abastecimiento supuestos.'
    ),
    (
        '20000000-0000-0000-0000-000000000016',
        'MED-03',
        'Medidor del sistema de biblioteca',
        'MEDIDOR',
        '10000000-0000-0000-0000-000000000007',
        'Medidor supuesto.'
    ),
    (
        '20000000-0000-0000-0000-000000000017',
        'VAL-01',
        'Válvula de riego cercana a biblioteca',
        'VALVULA',
        '10000000-0000-0000-0000-000000000014',
        'Válvula supuesta.'
    ),
    (
        '20000000-0000-0000-0000-000000000018',
        'TUB-09',
        'Tubería de cisterna a medidor de biblioteca',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000007',
        'Tubería supuesta.'
    ),
    (
        '20000000-0000-0000-0000-000000000019',
        'TUB-10',
        'Tubería de medidor a válvula de biblioteca',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000007',
        'Tubería supuesta.'
    ),
    (
        '20000000-0000-0000-0000-000000000020',
        'TUB-11',
        'Tubería hacia zona de riego de biblioteca',
        'TUBERIA',
        '10000000-0000-0000-0000-000000000014',
        'Tubería supuesta.'
    );

-- Datos específicos de los medidores.
INSERT INTO aquasense.medidor (componente_id)
VALUES
    ('20000000-0000-0000-0000-000000000002'),
    ('20000000-0000-0000-0000-000000000009'),
    ('20000000-0000-0000-0000-000000000016');

-- La posición queda como DESCONOCIDA por el valor predeterminado.
INSERT INTO aquasense.valvula (componente_id)
VALUES
    ('20000000-0000-0000-0000-000000000017');

COMMIT;