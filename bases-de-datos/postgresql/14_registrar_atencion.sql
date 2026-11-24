BEGIN;

CREATE FUNCTION aquasense.registrar_atencion(
    p_evento_id UUID,
    p_reporte_id UUID,
    p_atencion JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_estado_reporte TEXT;
    v_secuencia_actual BIGINT;
    v_nueva_secuencia BIGINT;

    v_atencion_id UUID;
    v_componente_id UUID;
    v_tipo TEXT;
    v_fecha TIMESTAMPTZ;
BEGIN
    -- Validaciones generales.
    IF p_evento_id IS NULL OR p_reporte_id IS NULL THEN
        RAISE EXCEPTION
            'Se requieren los identificadores del evento y del reporte.'
            USING ERRCODE = '23502';
    END IF;

    IF p_atencion IS NULL
       OR jsonb_typeof(p_atencion) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION
            'La atención debe ser un objeto JSON.'
            USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(p_atencion -> 'atencionId') IS DISTINCT FROM 'string'
       OR btrim(p_atencion ->> 'atencionId') = '' THEN
        RAISE EXCEPTION
            'La atención requiere un identificador.'
            USING ERRCODE = '23514';
    END IF;

    BEGIN
        v_atencion_id := (p_atencion ->> 'atencionId')::UUID;
    EXCEPTION
        WHEN invalid_text_representation THEN
            RAISE EXCEPTION
                'El identificador de la atención debe ser un UUID válido.'
                USING ERRCODE = '23514';
    END;

    IF jsonb_typeof(p_atencion -> 'tipo') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION
            'La atención requiere un tipo.'
            USING ERRCODE = '23514';
    END IF;

    v_tipo := p_atencion ->> 'tipo';

    IF v_tipo NOT IN ('INSPECCION', 'REPARACION', 'VERIFICACION') THEN
        RAISE EXCEPTION
            'Tipo de atención inválido: %.', v_tipo
            USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(p_atencion -> 'fecha') IS DISTINCT FROM 'string'
       OR (p_atencion ->> 'fecha') !~
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' THEN
        RAISE EXCEPTION
            'La fecha debe incluir fecha, hora y zona horaria.'
            USING ERRCODE = '23514';
    END IF;

    BEGIN
        v_fecha := (p_atencion ->> 'fecha')::TIMESTAMPTZ;
    EXCEPTION
        WHEN invalid_datetime_format OR datetime_field_overflow THEN
            RAISE EXCEPTION
                'La fecha de la atención no es válida.'
                USING ERRCODE = '23514';
    END;

    IF NOT isfinite(v_fecha) THEN
        RAISE EXCEPTION
            'La fecha de la atención debe ser finita.'
            USING ERRCODE = '23514';
    END IF;

    IF jsonb_typeof(p_atencion -> 'descripcion') IS DISTINCT FROM 'string'
       OR btrim(p_atencion ->> 'descripcion') = '' THEN
        RAISE EXCEPTION
            'La atención requiere una descripción.'
            USING ERRCODE = '23514';
    END IF;

    -- El componente es opcional. Si se proporciona, debe existir.
    IF p_atencion ? 'componenteId'
       AND p_atencion -> 'componenteId' <> 'null'::JSONB THEN

        IF jsonb_typeof(p_atencion -> 'componenteId') IS DISTINCT FROM 'string'
           OR btrim(p_atencion ->> 'componenteId') = '' THEN
            RAISE EXCEPTION
                'El componente debe identificarse con un UUID válido.'
                USING ERRCODE = '23514';
        END IF;

        BEGIN
            v_componente_id := (p_atencion ->> 'componenteId')::UUID;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION
                    'El componente debe identificarse con un UUID válido.'
                    USING ERRCODE = '23514';
        END;

        IF NOT EXISTS (
            SELECT 1
            FROM aquasense.componente
            WHERE componente_id = v_componente_id
        ) THEN
            RAISE EXCEPTION
                'El componente indicado no existe.'
                USING ERRCODE = '23503';
        END IF;
    END IF;

    -- Campos específicos de cada tipo.
    IF v_tipo = 'INSPECCION' THEN
        IF jsonb_typeof(p_atencion -> 'hallazgos') IS DISTINCT FROM 'string'
           OR btrim(p_atencion ->> 'hallazgos') = '' THEN
            RAISE EXCEPTION
                'La inspección requiere registrar sus hallazgos.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF v_tipo = 'REPARACION' AND p_atencion ? 'materiales' THEN
        IF jsonb_typeof(p_atencion -> 'materiales') IS DISTINCT FROM 'array' THEN
            RAISE EXCEPTION
                'Los materiales deben ser una lista.'
                USING ERRCODE = '23514';
        END IF;

        IF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_atencion -> 'materiales') AS material(valor)
            WHERE jsonb_typeof(material.valor) <> 'string'
               OR btrim(material.valor #>> '{}') = ''
        ) THEN
            RAISE EXCEPTION
                'Cada material debe ser un texto no vacío.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF v_tipo = 'VERIFICACION' THEN
        IF jsonb_typeof(p_atencion -> 'resultado') IS DISTINCT FROM 'string'
           OR (p_atencion ->> 'resultado') NOT IN (
               'SIN_INDICIOS',
               'PERSISTE',
               'NO_CONCLUYENTE'
           ) THEN
            RAISE EXCEPTION
                'La verificación requiere un resultado válido.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- Bloquear el reporte para ordenar las operaciones sobre él.
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

    IF v_estado_reporte = 'CERRADO' THEN
        RAISE EXCEPTION
            'No se pueden agregar atenciones a un reporte cerrado.'
            USING ERRCODE = '23514';
    END IF;

    -- El expediente y cualquier atención anterior deben estar confirmados.
    IF v_secuencia_actual < 1 OR NOT EXISTS (
        SELECT 1
        FROM aquasense.evento_salida
        WHERE destino = 'DOCUMENTAL'
          AND reporte_id = p_reporte_id
          AND secuencia = v_secuencia_actual
          AND estado = 'PROCESADO'
    ) THEN
        RAISE EXCEPTION
            'El reporte tiene una operación documental pendiente o sin confirmar.'
            USING ERRCODE = '23514';
    END IF;

    -- No reutilizar el identificador de una atención en este reporte.
    IF EXISTS (
        SELECT 1
        FROM aquasense.evento_salida
        WHERE destino = 'DOCUMENTAL'
          AND reporte_id = p_reporte_id
          AND tipo = 'AGREGAR_ATENCION'
          AND datos -> 'atencion' ->> 'atencionId' = v_atencion_id::TEXT
    ) THEN
        RAISE EXCEPTION
            'La atención ya fue registrada para este reporte.'
            USING ERRCODE = '23505';
    END IF;

    v_nueva_secuencia := v_secuencia_actual + 1;

    UPDATE aquasense.reporte
    SET secuencia_documental = v_nueva_secuencia,
        actualizado_en = CURRENT_TIMESTAMP
    WHERE reporte_id = p_reporte_id;

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
        'DOCUMENTAL',
        'AGREGAR_ATENCION',
        p_reporte_id,
        v_nueva_secuencia,
        jsonb_build_object(
            'reporteId', p_reporte_id::TEXT,
            'atencion',
            jsonb_set(
                p_atencion,
                '{atencionId}',
                to_jsonb(v_atencion_id::TEXT)
            )
        )
    );

    RETURN p_evento_id;
END;
$$;

COMMIT;