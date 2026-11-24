BEGIN;

CREATE FUNCTION aquasense.encolar_evento_red(
    p_evento_id UUID,
    p_cambio JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_version_red BIGINT;
BEGIN
    IF p_evento_id IS NULL THEN
        RAISE EXCEPTION
            'Se requiere el identificador del evento.'
            USING ERRCODE = '23502';
    END IF;

    IF p_cambio IS NULL
       OR jsonb_typeof(p_cambio) IS DISTINCT FROM 'object'
       OR p_cambio = '{}'::JSONB THEN
        RAISE EXCEPTION
            'El cambio de red debe ser un objeto JSON no vacío.'
            USING ERRCODE = '23514';
    END IF;

    -- La actualización también bloquea la fila de control
    -- hasta que termine la transacción.
    UPDATE aquasense.control_red
    SET version_red = version_red + 1,
        actualizado_en = CURRENT_TIMESTAMP
    WHERE control_id = 1
    RETURNING version_red INTO v_version_red;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el registro de control de la red.'
            USING ERRCODE = '23514';
    END IF;

    INSERT INTO aquasense.evento_salida (
        evento_id,
        destino,
        tipo,
        reporte_id,
        secuencia,
        datos
    )
    VALUES (
        p_evento_id,
        'GRAFO',
        'ACTUALIZAR_RED',
        NULL,
        v_version_red,
        jsonb_build_object(
            'versionRed', v_version_red,
            'cambio', p_cambio
        )
    );

    RETURN v_version_red;
END;
$$;

COMMIT;