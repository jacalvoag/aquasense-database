BEGIN;

CREATE FUNCTION aquasense.reactivar_evento_documental(
    p_evento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_reporte_id UUID;
    v_estado_evento TEXT;
BEGIN
    IF p_evento_id IS NULL THEN
        RAISE EXCEPTION
            'Se requiere el identificador del evento.'
            USING ERRCODE = '23502';
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

    -- Mantener el mismo orden de bloqueo de las demás funciones.
    PERFORM 1
    FROM aquasense.reporte
    WHERE reporte_id = v_reporte_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El reporte asociado al evento no existe.'
            USING ERRCODE = '23503';
    END IF;

    SELECT estado
    INTO v_estado_evento
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

    IF v_estado_evento <> 'ERROR' THEN
        RAISE EXCEPTION
            'Solo se pueden reactivar eventos en ERROR. Estado actual: %.',
            v_estado_evento
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