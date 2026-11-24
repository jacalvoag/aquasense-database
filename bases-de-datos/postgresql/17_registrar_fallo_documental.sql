BEGIN;

CREATE FUNCTION aquasense.registrar_fallo_documental(
    p_evento_id UUID,
    p_error TEXT,
    p_proximo_intento_en TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_reporte_id UUID;
    v_estado_evento TEXT;
    v_intentos_actuales INTEGER;
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

    SELECT reporte_id
    INTO v_reporte_id
    FROM aquasense.evento_salida
    WHERE evento_id = p_evento_id
      AND destino = 'DOCUMENTAL';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El evento documental indicado no existe.'
            USING ERRCODE = '23503';
    END IF;

    -- Mantener el mismo orden de bloqueo que las demás funciones.
    PERFORM 1
    FROM aquasense.reporte
    WHERE reporte_id = v_reporte_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El reporte asociado al evento no existe.'
            USING ERRCODE = '23503';
    END IF;

    SELECT estado, intentos
    INTO v_estado_evento, v_intentos_actuales
    FROM aquasense.evento_salida
    WHERE evento_id = p_evento_id
      AND destino = 'DOCUMENTAL'
      AND reporte_id = v_reporte_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El evento documental indicado ya no está disponible.'
            USING ERRCODE = '23503';
    END IF;

    IF v_estado_evento <> 'PENDIENTE' THEN
        RAISE EXCEPTION
            'Solo se pueden registrar fallos de eventos pendientes. Estado actual: %.',
            v_estado_evento
            USING ERRCODE = '23514';
    END IF;

    v_nuevos_intentos := v_intentos_actuales + 1;

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