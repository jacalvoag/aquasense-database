BEGIN;

CREATE FUNCTION aquasense.reactivar_evento_grafo(
    p_evento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado TEXT;
BEGIN
    IF p_evento_id IS NULL THEN
        RAISE EXCEPTION
            'Se requiere el identificador del evento.'
            USING ERRCODE = '23502';
    END IF;

    -- Mantener el mismo orden de bloqueo de los eventos del grafo.
    PERFORM control_id
    FROM aquasense.control_red
    WHERE control_id = 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el registro de control de la red.'
            USING ERRCODE = '23514';
    END IF;

    SELECT estado
    INTO v_estado
    FROM aquasense.evento_salida
    WHERE evento_id = p_evento_id
      AND destino = 'GRAFO'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El evento de grafo indicado no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_estado <> 'ERROR' THEN
        RAISE EXCEPTION
            'Solo se pueden reactivar eventos en ERROR. Estado actual: %.',
            v_estado
            USING ERRCODE = '23514';
    END IF;

    UPDATE aquasense.evento_salida
    SET estado = 'PENDIENTE',
        intentos = 0,
        proximo_intento_en = CURRENT_TIMESTAMP
    WHERE evento_id = p_evento_id;
END;
$$;

COMMIT;