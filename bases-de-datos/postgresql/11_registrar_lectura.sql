BEGIN;

CREATE FUNCTION aquasense.registrar_lectura(
    p_lectura_id UUID,
    p_medidor_id UUID,
    p_fecha_hora TIMESTAMPTZ,
    p_valor_acumulado NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_medidor aquasense.componente.estado%TYPE;
    v_ultima_fecha TIMESTAMPTZ;
    v_ultimo_valor NUMERIC(14,3);
BEGIN
    -- Esta primera versión de la operación se plantea para
    -- READ COMMITTED. La concurrencia se probará después.
    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION
            'La operación de lectura requiere aislamiento READ COMMITTED.'
            USING ERRCODE = '25001';
    END IF;


    -- Validar datos obligatorios.
    IF p_lectura_id IS NULL
       OR p_medidor_id IS NULL
       OR p_fecha_hora IS NULL
       OR p_valor_acumulado IS NULL
    THEN
        RAISE EXCEPTION
            'Todos los datos de la lectura son obligatorios.'
            USING ERRCODE = '23502';
    END IF;


    -- Rechazar fechas especiales y fechas futuras.
    IF NOT isfinite(p_fecha_hora) THEN
        RAISE EXCEPTION
            'La fecha de la lectura debe ser una fecha válida.'
            USING ERRCODE = '23514';
    END IF;

    IF p_fecha_hora > clock_timestamp() THEN
        RAISE EXCEPTION
            'La fecha de la lectura no puede estar en el futuro.'
            USING ERRCODE = '23514';
    END IF;


    -- Rechazar valores especiales de NUMERIC.
    IF p_valor_acumulado IN (
        'NaN'::NUMERIC,
        'Infinity'::NUMERIC,
        '-Infinity'::NUMERIC
    ) THEN
        RAISE EXCEPTION
            'El valor acumulado debe ser un número finito.'
            USING ERRCODE = '23514';
    END IF;

    IF p_valor_acumulado < 0 THEN
        RAISE EXCEPTION
            'El valor acumulado no puede ser negativo.'
            USING ERRCODE = '23514';
    END IF;

    -- NUMERIC(14,3) admite hasta 11 dígitos enteros.
    IF p_valor_acumulado > 99999999999.999 THEN
        RAISE EXCEPTION
            'El valor acumulado supera el máximo permitido.'
            USING ERRCODE = '23514';
    END IF;

    -- Se valida antes de insertar para evitar redondeos
    -- no advertidos al convertir a NUMERIC(14,3).
    IF scale(p_valor_acumulado) > 3 THEN
        RAISE EXCEPTION
            'El valor acumulado puede tener como máximo tres decimales.'
            USING ERRCODE = '23514';
    END IF;


    -- Bloquear el componente del medidor mientras se revisa
    -- su última lectura y se registra la nueva.
    SELECT c.estado
    INTO v_estado_medidor
    FROM aquasense.medidor AS m
    INNER JOIN aquasense.componente AS c
        ON c.componente_id = m.componente_id
    WHERE m.componente_id = p_medidor_id
    FOR UPDATE OF c;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El medidor indicado no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_estado_medidor <> 'ACTIVO' THEN
        RAISE EXCEPTION
            'No se pueden registrar lecturas en un medidor retirado.'
            USING ERRCODE = '23514';
    END IF;


    -- Consultar la última lectura confirmada del medidor.
    SELECT fecha_hora, valor_acumulado
    INTO v_ultima_fecha, v_ultimo_valor
    FROM aquasense.lectura
    WHERE medidor_id = p_medidor_id
    ORDER BY fecha_hora DESC
    LIMIT 1;

    IF FOUND THEN
        IF p_fecha_hora <= v_ultima_fecha THEN
            RAISE EXCEPTION
                'La nueva lectura debe ser posterior a la última lectura del medidor.'
                USING ERRCODE = '23514';
        END IF;

        IF p_valor_acumulado < v_ultimo_valor THEN
            RAISE EXCEPTION
                'El valor acumulado no puede ser menor que la última lectura: % m3.',
                v_ultimo_valor
                USING ERRCODE = '23514';
        END IF;
    END IF;


    INSERT INTO aquasense.lectura (
        lectura_id,
        medidor_id,
        fecha_hora,
        valor_acumulado
    )
    VALUES (
        p_lectura_id,
        p_medidor_id,
        p_fecha_hora,
        p_valor_acumulado
    );
END;
$$;

COMMIT;