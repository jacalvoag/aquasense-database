BEGIN;

CREATE FUNCTION aquasense.crear_reporte(
    p_reporte_id UUID,
    p_evento_id UUID,
    p_espacio_id UUID,
    p_descripcion_inicial TEXT,
    p_referencia_ubicacion TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_datos_evento JSONB;
BEGIN
    -- Validar identificadores y descripción.
    IF p_reporte_id IS NULL
       OR p_evento_id IS NULL
       OR p_espacio_id IS NULL
       OR p_descripcion_inicial IS NULL
       OR btrim(p_descripcion_inicial) = ''
    THEN
        RAISE EXCEPTION
            'El reporte requiere identificadores, espacio y descripción inicial.'
            USING ERRCODE = '23502';
    END IF;


    -- Preparar los datos necesarios para crear el expediente.
    -- Si no hay referencia adicional, se omite ese campo.
    v_datos_evento := jsonb_strip_nulls(
        jsonb_build_object(
            'reporteId', p_reporte_id::TEXT,
            'descripcionInicial', btrim(p_descripcion_inicial),
            'referenciaUbicacion',
                NULLIF(btrim(p_referencia_ubicacion), '')
        )
    );


    -- Registrar el reporte.
    -- La primera secuencia corresponde a crear su expediente.
    INSERT INTO aquasense.reporte (
        reporte_id,
        espacio_id,
        estado,
        secuencia_documental
    )
    VALUES (
        p_reporte_id,
        p_espacio_id,
        'PENDIENTE',
        1
    );


    -- Registrar el evento que posteriormente procesará
    -- el sincronizador para crear el expediente en MongoDB.
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
        'CREAR_EXPEDIENTE',
        p_reporte_id,
        1,
        v_datos_evento
    );

    RETURN p_reporte_id;
END;
$$;

COMMIT;