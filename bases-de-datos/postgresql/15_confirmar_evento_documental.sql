BEGIN;

CREATE FUNCTION aquasense.confirmar_evento_documental(
    p_evento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_reporte_id UUID;
    v_estado_reporte TEXT;
    v_secuencia_reporte BIGINT;

    v_tipo_evento TEXT;
    v_estado_evento TEXT;
    v_secuencia_evento BIGINT;
BEGIN
    IF p_evento_id IS NULL THEN
        RAISE EXCEPTION
            'Se requiere el identificador del evento.'
            USING ERRCODE = '23502';
    END IF;

    -- Primero identificamos el reporte al que pertenece el evento.
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

    -- Se bloquea primero el reporte, como en registrar_atencion.
    SELECT estado, secuencia_documental
    INTO v_estado_reporte, v_secuencia_reporte
    FROM aquasense.reporte
    WHERE reporte_id = v_reporte_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El reporte asociado al evento no existe.'
            USING ERRCODE = '23503';
    END IF;

    SELECT tipo, estado, secuencia
    INTO v_tipo_evento, v_estado_evento, v_secuencia_evento
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

    -- Permite repetir la confirmación sin aplicar cambios otra vez.
    IF v_estado_evento = 'PROCESADO' THEN
        RETURN;
    END IF;

    IF v_estado_evento <> 'PENDIENTE' THEN
        RAISE EXCEPTION
            'Solo se pueden confirmar eventos pendientes. Estado actual: %.',
            v_estado_evento
            USING ERRCODE = '23514';
    END IF;

    IF v_estado_reporte = 'CERRADO' THEN
        RAISE EXCEPTION
            'No se puede confirmar un evento pendiente de un reporte cerrado.'
            USING ERRCODE = '23514';
    END IF;

    IF v_secuencia_evento <> v_secuencia_reporte THEN
        RAISE EXCEPTION
            'La secuencia del evento no coincide con la secuencia actual del reporte.'
            USING ERRCODE = '23514';
    END IF;

    IF v_tipo_evento = 'CREAR_EXPEDIENTE' THEN
        IF v_secuencia_evento <> 1 THEN
            RAISE EXCEPTION
                'La creación del expediente debe tener la secuencia 1.'
                USING ERRCODE = '23514';
        END IF;

    ELSIF v_tipo_evento = 'AGREGAR_ATENCION' THEN
        IF v_secuencia_evento <= 1 OR NOT EXISTS (
            SELECT 1
            FROM aquasense.evento_salida
            WHERE destino = 'DOCUMENTAL'
              AND reporte_id = v_reporte_id
              AND secuencia = v_secuencia_evento - 1
              AND estado = 'PROCESADO'
        ) THEN
            RAISE EXCEPTION
                'La operación documental anterior no está confirmada.'
                USING ERRCODE = '23514';
        END IF;

    ELSE
        RAISE EXCEPTION
            'Tipo de evento documental no admitido: %.',
            v_tipo_evento
            USING ERRCODE = '23514';
    END IF;

    UPDATE aquasense.evento_salida
    SET estado = 'PROCESADO',
        procesado_en = CURRENT_TIMESTAMP,
        proximo_intento_en = NULL,
        ultimo_error = NULL
    WHERE evento_id = p_evento_id;

    IF v_tipo_evento = 'AGREGAR_ATENCION'
       AND v_estado_reporte = 'PENDIENTE' THEN

        UPDATE aquasense.reporte
        SET estado = 'EN_ATENCION',
            actualizado_en = CURRENT_TIMESTAMP
        WHERE reporte_id = v_reporte_id;
    END IF;
END;
$$;

COMMIT;