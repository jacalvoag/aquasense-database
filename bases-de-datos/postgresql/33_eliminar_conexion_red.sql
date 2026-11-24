BEGIN;

CREATE FUNCTION aquasense.eliminar_conexion_red(
    p_conexion_id UUID,
    p_evento_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_conexion aquasense.conexion%ROWTYPE;
BEGIN
    IF p_conexion_id IS NULL OR p_evento_id IS NULL THEN
        RAISE EXCEPTION
            'Se requieren los identificadores de conexión y evento.'
            USING ERRCODE = '23502';
    END IF;

    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION
            'La eliminación de conexiones requiere READ COMMITTED.'
            USING ERRCODE = '25001';
    END IF;

    -- Coordinar este cambio con las demás operaciones de la red.
    PERFORM control_id
    FROM aquasense.control_red
    WHERE control_id = 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el registro de control de la red.'
            USING ERRCODE = '23514';
    END IF;

    -- Conservar los datos de la conexión para el evento.
    DELETE FROM aquasense.conexion
    WHERE conexion_id = p_conexion_id
    RETURNING * INTO v_conexion;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'La conexión indicada no existe.'
            USING ERRCODE = '23503';
    END IF;

    PERFORM aquasense.encolar_evento_red(
        p_evento_id,
        jsonb_build_object(
            'operacion', 'ELIMINAR_CONEXION',
            'conexion', to_jsonb(v_conexion)
        )
    );

    RETURN p_conexion_id;
END;
$$;

COMMIT;