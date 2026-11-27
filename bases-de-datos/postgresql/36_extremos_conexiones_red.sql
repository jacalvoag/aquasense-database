BEGIN;

-- Migración compatible con eventos previos; los nuevos incluyen los extremos.
CREATE OR REPLACE FUNCTION aquasense.crear_conexion_red(
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
            'conexion', to_jsonb(v_conexion),
            'origen', (SELECT to_jsonb(c) FROM aquasense.componente c
                       WHERE c.componente_id = p_componente_origen_id),
            'destinoComponente', (SELECT to_jsonb(c) FROM aquasense.componente c
                                  WHERE c.componente_id = p_componente_destino_id),
            'destinoEspacio', (SELECT to_jsonb(e) FROM aquasense.espacio e
                              WHERE e.espacio_id = p_espacio_destino_id)
        )
    );

    RETURN p_conexion_id;
END;
$$;

CREATE OR REPLACE FUNCTION aquasense.actualizar_conexion_red(
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
    v_antes aquasense.conexion%ROWTYPE;
    v_despues aquasense.conexion%ROWTYPE;
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
            'La actualización de conexiones requiere READ COMMITTED.'
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

    SELECT *
    INTO v_antes
    FROM aquasense.conexion
    WHERE conexion_id = p_conexion_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'La conexión indicada no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_antes.componente_origen_id IS NOT DISTINCT FROM p_componente_origen_id
       AND v_antes.componente_destino_id IS NOT DISTINCT FROM p_componente_destino_id
       AND v_antes.espacio_destino_id IS NOT DISTINCT FROM p_espacio_destino_id THEN
        RAISE EXCEPTION
            'La conexión no presenta cambios.'
            USING ERRCODE = '23514';
    END IF;

    -- El trigger existente valida tipos, estado, salidas y ciclos.
    UPDATE aquasense.conexion
    SET componente_origen_id = p_componente_origen_id,
        componente_destino_id = p_componente_destino_id,
        espacio_destino_id = p_espacio_destino_id
    WHERE conexion_id = p_conexion_id
    RETURNING * INTO v_despues;

    PERFORM aquasense.encolar_evento_red(
        p_evento_id,
        jsonb_build_object(
            'operacion', 'ACTUALIZAR_CONEXION',
            'antes', to_jsonb(v_antes),
            'despues', to_jsonb(v_despues),
            'origen', (SELECT to_jsonb(c) FROM aquasense.componente c
                       WHERE c.componente_id = p_componente_origen_id),
            'destinoComponente', (SELECT to_jsonb(c) FROM aquasense.componente c
                                  WHERE c.componente_id = p_componente_destino_id),
            'destinoEspacio', (SELECT to_jsonb(e) FROM aquasense.espacio e
                              WHERE e.espacio_id = p_espacio_destino_id)
        )
    );

    RETURN p_conexion_id;
END;
$$;

COMMIT;
