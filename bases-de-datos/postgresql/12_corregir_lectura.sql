BEGIN;

CREATE FUNCTION aquasense.corregir_lectura(
    p_correccion_id UUID,
    p_lectura_id UUID,
    p_valor_nuevo NUMERIC,
    p_motivo TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_medidor_id UUID;
    v_medidor_actual UUID;
    v_fecha_hora TIMESTAMPTZ;
    v_valor_anterior NUMERIC(14,3);

    v_valor_previo NUMERIC(14,3);
    v_valor_siguiente NUMERIC(14,3);
BEGIN
    -- La operación se plantea para READ COMMITTED, igual
    -- que el registro de lecturas.
    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION
            'La corrección de lectura requiere aislamiento READ COMMITTED.'
            USING ERRCODE = '25001';
    END IF;


    -- Validar datos obligatorios.
    IF p_correccion_id IS NULL
       OR p_lectura_id IS NULL
       OR p_valor_nuevo IS NULL
       OR p_motivo IS NULL
       OR btrim(p_motivo) = ''
    THEN
        RAISE EXCEPTION
            'La corrección requiere identificadores, valor nuevo y motivo.'
            USING ERRCODE = '23502';
    END IF;


    -- Validar el valor antes de convertirlo a NUMERIC(14,3).
    IF p_valor_nuevo IN (
        'NaN'::NUMERIC,
        'Infinity'::NUMERIC,
        '-Infinity'::NUMERIC
    ) THEN
        RAISE EXCEPTION
            'El valor nuevo debe ser un número finito.'
            USING ERRCODE = '23514';
    END IF;

    IF p_valor_nuevo < 0 THEN
        RAISE EXCEPTION
            'El valor nuevo no puede ser negativo.'
            USING ERRCODE = '23514';
    END IF;

    IF p_valor_nuevo > 99999999999.999 THEN
        RAISE EXCEPTION
            'El valor nuevo supera el máximo permitido.'
            USING ERRCODE = '23514';
    END IF;

    IF scale(p_valor_nuevo) > 3 THEN
        RAISE EXCEPTION
            'El valor nuevo puede tener como máximo tres decimales.'
            USING ERRCODE = '23514';
    END IF;


    -- Identificar el medidor al que pertenece la lectura.
    SELECT medidor_id
    INTO v_medidor_id
    FROM aquasense.lectura
    WHERE lectura_id = p_lectura_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'La lectura indicada no existe.'
            USING ERRCODE = '23503';
    END IF;


    -- Usar el mismo bloqueo por medidor que registrar_lectura.
    PERFORM 1
    FROM aquasense.componente
    WHERE componente_id = v_medidor_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el componente asociado al medidor.'
            USING ERRCODE = '23503';
    END IF;


    -- Volver a leer la lectura después de obtener el bloqueo.
    SELECT medidor_id, fecha_hora, valor_acumulado
    INTO v_medidor_actual, v_fecha_hora, v_valor_anterior
    FROM aquasense.lectura
    WHERE lectura_id = p_lectura_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'La lectura ya no está disponible.'
            USING ERRCODE = '23503';
    END IF;

    IF v_medidor_actual <> v_medidor_id THEN
        RAISE EXCEPTION
            'El medidor de la lectura cambió durante la operación.'
            USING ERRCODE = '23514';
    END IF;

    IF p_valor_nuevo = v_valor_anterior THEN
        RAISE EXCEPTION
            'El valor nuevo debe ser diferente al valor actual.'
            USING ERRCODE = '23514';
    END IF;


    -- Consultar la lectura anterior, si existe.
    SELECT valor_acumulado
    INTO v_valor_previo
    FROM aquasense.lectura
    WHERE medidor_id = v_medidor_id
      AND fecha_hora < v_fecha_hora
    ORDER BY fecha_hora DESC
    LIMIT 1;

    IF FOUND AND p_valor_nuevo < v_valor_previo THEN
        RAISE EXCEPTION
            'El valor nuevo no puede ser menor que la lectura anterior: % m3.',
            v_valor_previo
            USING ERRCODE = '23514';
    END IF;


    -- Consultar la lectura siguiente, si existe.
    SELECT valor_acumulado
    INTO v_valor_siguiente
    FROM aquasense.lectura
    WHERE medidor_id = v_medidor_id
      AND fecha_hora > v_fecha_hora
    ORDER BY fecha_hora ASC
    LIMIT 1;

    IF FOUND AND p_valor_nuevo > v_valor_siguiente THEN
        RAISE EXCEPTION
            'El valor nuevo no puede ser mayor que la lectura siguiente: % m3.',
            v_valor_siguiente
            USING ERRCODE = '23514';
    END IF;


    -- Cambiar el valor vigente.
    UPDATE aquasense.lectura
    SET valor_acumulado = p_valor_nuevo
    WHERE lectura_id = p_lectura_id;


    -- Conservar la corrección en el historial.
    INSERT INTO aquasense.correccion_lectura (
        correccion_id,
        lectura_id,
        valor_anterior,
        valor_nuevo,
        motivo
    )
    VALUES (
        p_correccion_id,
        p_lectura_id,
        v_valor_anterior,
        p_valor_nuevo,
        btrim(p_motivo)
    );
END;
$$;

COMMIT;