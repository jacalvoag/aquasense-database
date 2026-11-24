BEGIN;

CREATE VIEW aquasense.consumo_entre_lecturas AS
WITH lecturas_ordenadas AS (
    SELECT
        l.lectura_id,
        l.medidor_id,
        l.fecha_hora,
        l.valor_acumulado,

        LAG(l.fecha_hora) OVER (
            PARTITION BY l.medidor_id
            ORDER BY l.fecha_hora
        ) AS fecha_hora_anterior,

        LAG(l.valor_acumulado) OVER (
            PARTITION BY l.medidor_id
            ORDER BY l.fecha_hora
        ) AS valor_anterior

    FROM aquasense.lectura AS l
)
SELECT
    l.lectura_id,
    l.medidor_id,
    c.codigo AS codigo_medidor,
    l.fecha_hora_anterior,
    l.fecha_hora,
    l.valor_anterior,
    l.valor_acumulado,
    l.valor_acumulado - l.valor_anterior AS consumo_m3
FROM lecturas_ordenadas AS l
JOIN aquasense.componente AS c
    ON c.componente_id = l.medidor_id;

COMMIT;