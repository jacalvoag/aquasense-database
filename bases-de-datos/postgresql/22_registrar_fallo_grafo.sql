BEGIN;

CREATE FUNCTION aquasense.registrar_fallo_grafo(
    p_evento_id UUID,
    p_error TEXT,
    p_proximo_intento_en TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado TEXT;
    v_secuencia BIGINT;
    v_intentos INTEGER;
    v_nuevos_intentos INTEGER;
    v_nuevo_estado TEXT;
BEGIN
    IF p_evento_id IS NULL THEN
        RAISE EXCEPTION
            'Se requiere el identificador del evento.'
            USING ERRCODE = '23502';
    END IF;

    IF p_error IS NULL OR btrim(p_error) = '' THEN
        RAISE EXCEPTION
            'Se requiere una descripción del error.'
            USING ERRCODE = '23514';
    END IF;

    -- Mantener el orden de bloqueo usado para confirmar eventos.
    PERFORM control_id
    FROM aquasense.control_red
    WHERE control_id = 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el registro de control de la red.'
            USING ERRCODE = '23514';
    END IF;

    SELECT estado, secuencia, intentos
    INTO v_estado, v_secuencia, v_intentos
    FROM aquasense.evento_salida
    WHERE evento_id = p_evento_id
      AND destino = 'GRAFO'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El evento de grafo indicado no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_estado <> 'PENDIENTE' THEN
        RAISE EXCEPTION
            'Solo se pueden registrar fallos de eventos pendientes. Estado actual: %.',
            v_estado
            USING ERRCODE = '23514';
    END IF;

    -- No se procesa un evento si el anterior sigue sin confirmar.
    IF v_secuencia > 1 AND NOT EXISTS (
        SELECT 1
        FROM aquasense.evento_salida
        WHERE destino = 'GRAFO'
          AND secuencia = v_secuencia - 1
          AND estado = 'PROCESADO'
    ) THEN
        RAISE EXCEPTION
            'El evento anterior del grafo no está confirmado.'
            USING ERRCODE = '23514';
    END IF;

    v_nuevos_intentos := v_intentos + 1;

    IF v_nuevos_intentos < 3 THEN
        IF p_proximo_intento_en IS NULL
           OR NOT isfinite(p_proximo_intento_en)
           OR p_proximo_intento_en <= CURRENT_TIMESTAMP THEN
            RAISE EXCEPTION
                'Se requiere una fecha futura para el próximo intento.'
                USING ERRCODE = '23514';
        END IF;

        v_nuevo_estado := 'PENDIENTE';
    ELSE
        v_nuevo_estado := 'ERROR';
    END IF;

    UPDATE aquasense.evento_salida
    SET intentos = v_nuevos_intentos,
        estado = v_nuevo_estado,
        ultimo_error = btrim(p_error),
        proximo_intento_en = CASE
            WHEN v_nuevo_estado = 'PENDIENTE'
                THEN p_proximo_intento_en
            ELSE NULL
        END
    WHERE evento_id = p_evento_id;

    RETURN v_nuevo_estado;
END;
$$;

COMMIT;