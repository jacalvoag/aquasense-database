BEGIN;

CREATE FUNCTION aquasense.cerrar_reporte(
    p_reporte_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_reporte TEXT;
    v_secuencia_actual BIGINT;
    v_evento RECORD;
BEGIN
    IF p_reporte_id IS NULL THEN
        RAISE EXCEPTION
            'Se requiere el identificador del reporte.'
            USING ERRCODE = '23502';
    END IF;

    -- El bloqueo evita que se registre otra atención al mismo tiempo.
    SELECT estado, secuencia_documental
    INTO v_estado_reporte, v_secuencia_actual
    FROM aquasense.reporte
    WHERE reporte_id = p_reporte_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El reporte indicado no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_estado_reporte <> 'EN_ATENCION' THEN
        RAISE EXCEPTION
            'Solo se puede cerrar un reporte en atención. Estado actual: %.',
            v_estado_reporte
            USING ERRCODE = '23514';
    END IF;

    -- Se revisa la operación documental más reciente del reporte.
    SELECT tipo, estado, datos
    INTO v_evento
    FROM aquasense.evento_salida
    WHERE destino = 'DOCUMENTAL'
      AND reporte_id = p_reporte_id
      AND secuencia = v_secuencia_actual;

    IF NOT FOUND OR v_evento.estado <> 'PROCESADO' THEN
        RAISE EXCEPTION
            'La última operación documental no está confirmada.'
            USING ERRCODE = '23514';
    END IF;

    IF v_evento.tipo <> 'AGREGAR_ATENCION'
       OR (v_evento.datos -> 'atencion' ->> 'tipo')
            IS DISTINCT FROM 'VERIFICACION'
       OR (v_evento.datos -> 'atencion' ->> 'resultado')
            IS DISTINCT FROM 'SIN_INDICIOS' THEN
        RAISE EXCEPTION
            'La última atención confirmada debe ser una verificación sin indicios.'
            USING ERRCODE = '23514';
    END IF;

    UPDATE aquasense.reporte
    SET estado = 'CERRADO',
        cerrado_en = CURRENT_TIMESTAMP,
        actualizado_en = CURRENT_TIMESTAMP
    WHERE reporte_id = p_reporte_id;
END;
$$;

COMMIT;