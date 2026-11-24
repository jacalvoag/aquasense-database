BEGIN;

CREATE FUNCTION aquasense.confirmar_evento_grafo(
    p_evento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado TEXT;
    v_secuencia BIGINT;
    v_version_red BIGINT;
BEGIN
    IF p_evento_id IS NULL THEN
        RAISE EXCEPTION
            'Se requiere el identificador del evento.'
            USING ERRCODE = '23502';
    END IF;

    -- Coordinar la comprobación con los cambios de versión de la red.
    SELECT version_red
    INTO v_version_red
    FROM aquasense.control_red
    WHERE control_id = 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el registro de control de la red.'
            USING ERRCODE = '23514';
    END IF;

    SELECT estado, secuencia
    INTO v_estado, v_secuencia
    FROM aquasense.evento_salida
    WHERE evento_id = p_evento_id
      AND destino = 'GRAFO'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El evento de grafo indicado no existe.'
            USING ERRCODE = '23503';
    END IF;

    -- Una confirmación repetida no vuelve a modificar el evento.
    IF v_estado = 'PROCESADO' THEN
        RETURN;
    END IF;

    IF v_estado <> 'PENDIENTE' THEN
        RAISE EXCEPTION
            'Solo se pueden confirmar eventos pendientes. Estado actual: %.',
            v_estado
            USING ERRCODE = '23514';
    END IF;

    IF v_secuencia > v_version_red THEN
        RAISE EXCEPTION
            'La secuencia del evento supera la versión actual de la red.'
            USING ERRCODE = '23514';
    END IF;

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

    UPDATE aquasense.evento_salida
    SET estado = 'PROCESADO',
        procesado_en = CURRENT_TIMESTAMP,
        proximo_intento_en = NULL,
        ultimo_error = NULL
    WHERE evento_id = p_evento_id;
END;
$$;

COMMIT;