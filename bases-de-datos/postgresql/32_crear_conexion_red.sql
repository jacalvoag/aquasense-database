BEGIN;

CREATE FUNCTION aquasense.crear_conexion_red(
    p_conexion_id UUID,
    p_componente_origen_id UUID,
    p_componente_destino_id UUID,
    p_espacio_destino_id UUID,
    p_evento_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_conexion aquasense.conexion%ROWTYPE;
BEGIN
    IF p_conexion_id IS NULL
       OR p_componente_origen_id IS NULL
       OR p_evento_id IS NULL THEN
        RAISE EXCEPTION
            'Se requieren los identificadores de conexión, origen y evento.'
            USING ERRCODE = '23502';
    END IF;

    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION
            'La creación de conexiones requiere READ COMMITTED.'
            USING ERRCODE = '25001';
    END IF;

    -- Coordinar el cambio con las demás operaciones de la red.
    PERFORM control_id
    FROM aquasense.control_red
    WHERE control_id = 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el registro de control de la red.'
            USING ERRCODE = '23514';
    END IF;

    -- Las restricciones y el trigger existentes validan la conexión.
    INSERT INTO aquasense.conexion (
        conexion_id,
        componente_origen_id,
        componente_destino_id,
        espacio_destino_id
    )
    VALUES (
        p_conexion_id,
        p_componente_origen_id,
        p_componente_destino_id,
        p_espacio_destino_id
    )
    RETURNING * INTO v_conexion;

    PERFORM aquasense.encolar_evento_red(
        p_evento_id,
        jsonb_build_object(
            'operacion', 'CREAR_CONEXION',
            'conexion', to_jsonb(v_conexion)
        )
    );

    RETURN p_conexion_id;
END;
$$;

COMMIT;