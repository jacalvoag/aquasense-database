BEGIN;

CREATE FUNCTION aquasense.reemplazar_tuberia(
    p_reemplazo_id UUID,
    p_tuberia_anterior_id UUID,
    p_tuberia_nueva_id UUID,
    p_reporte_id UUID,
    p_evento_documental_id UUID,
    p_evento_grafo_id UUID,
    p_atencion JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_anterior aquasense.componente%ROWTYPE;
    v_nueva aquasense.componente%ROWTYPE;

    v_entrada_antes aquasense.conexion%ROWTYPE;
    v_entrada_despues aquasense.conexion%ROWTYPE;

    v_salida_antes aquasense.conexion%ROWTYPE;
    v_salida_despues aquasense.conexion%ROWTYPE;

    v_tiene_entrada BOOLEAN;
    v_tiene_salida BOOLEAN;
    v_estado_reporte TEXT;

    v_conexiones JSONB := '[]'::JSONB;
    v_atencion JSONB;
BEGIN
    IF p_reemplazo_id IS NULL
       OR p_tuberia_anterior_id IS NULL
       OR p_tuberia_nueva_id IS NULL
       OR p_reporte_id IS NULL
       OR p_evento_documental_id IS NULL
       OR p_evento_grafo_id IS NULL THEN
        RAISE EXCEPTION
            'Se requieren todos los identificadores del reemplazo.'
            USING ERRCODE = '23502';
    END IF;

    IF p_tuberia_anterior_id = p_tuberia_nueva_id THEN
        RAISE EXCEPTION
            'La tubería anterior y la nueva deben ser diferentes.'
            USING ERRCODE = '23514';
    END IF;

    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION
            'El reemplazo requiere el aislamiento READ COMMITTED.'
            USING ERRCODE = '25001';
    END IF;

    IF p_atencion IS NULL
       OR jsonb_typeof(p_atencion) IS DISTINCT FROM 'object'
       OR (p_atencion ->> 'tipo') IS DISTINCT FROM 'REPARACION' THEN
        RAISE EXCEPTION
            'El reemplazo requiere una atención de tipo REPARACION.'
            USING ERRCODE = '23514';
    END IF;

    -- Coordinar los cambios de topología.
    PERFORM control_id
    FROM aquasense.control_red
    WHERE control_id = 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el registro de control de la red.'
            USING ERRCODE = '23514';
    END IF;

    -- Bloquear el reporte antes de registrar la atención.
    SELECT estado
    INTO v_estado_reporte
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
            'No se puede asociar un reemplazo a un reporte cerrado.'
            USING ERRCODE = '23514';
    END IF;

    -- Bloquear ambos componentes en un orden estable.
    PERFORM componente_id
    FROM aquasense.componente
    WHERE componente_id IN (
        p_tuberia_anterior_id,
        p_tuberia_nueva_id
    )
    ORDER BY componente_id
    FOR UPDATE;

    SELECT *
    INTO v_anterior
    FROM aquasense.componente
    WHERE componente_id = p_tuberia_anterior_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'La tubería anterior no existe.'
            USING ERRCODE = '23503';
    END IF;

    SELECT *
    INTO v_nueva
    FROM aquasense.componente
    WHERE componente_id = p_tuberia_nueva_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'La tubería nueva no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_anterior.tipo <> 'TUBERIA'
       OR v_nueva.tipo <> 'TUBERIA' THEN
        RAISE EXCEPTION
            'Ambos componentes deben ser tuberías.'
            USING ERRCODE = '23514';
    END IF;

    IF v_anterior.estado <> 'ACTIVO'
       OR v_nueva.estado <> 'ACTIVO' THEN
        RAISE EXCEPTION
            'Ambas tuberías deben estar activas antes del reemplazo.'
            USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM aquasense.conexion
        WHERE componente_origen_id = p_tuberia_nueva_id
           OR componente_destino_id = p_tuberia_nueva_id
    ) THEN
        RAISE EXCEPTION
            'La tubería nueva no debe tener conexiones actuales.'
            USING ERRCODE = '23514';
    END IF;

    -- Una tubería solo puede ser reemplazada una vez y una nueva
    -- solo puede reemplazar directamente a una tubería anterior.
    IF EXISTS (
        SELECT 1
        FROM aquasense.reemplazo_tuberia
        WHERE tuberia_anterior_id = p_tuberia_anterior_id
           OR tuberia_nueva_id = p_tuberia_nueva_id
    ) THEN
        RAISE EXCEPTION
            'La relación de reemplazo entra en conflicto con un reemplazo existente.'
            USING ERRCODE = '23514';
    END IF;

    -- Evitar ciclos en la cadena de reemplazos.
    IF EXISTS (
        WITH RECURSIVE cadena AS (
            SELECT p_tuberia_nueva_id AS tuberia_id

            UNION

            SELECT r.tuberia_nueva_id
            FROM aquasense.reemplazo_tuberia AS r
            JOIN cadena AS c
                ON r.tuberia_anterior_id = c.tuberia_id
        )
        SELECT 1
        FROM cadena
        WHERE tuberia_id = p_tuberia_anterior_id
    ) THEN
        RAISE EXCEPTION
            'El reemplazo formaría un ciclo en el historial.'
            USING ERRCODE = '23514';
    END IF;

    -- Obtener las conexiones actuales de la tubería anterior.
    SELECT *
    INTO v_entrada_antes
    FROM aquasense.conexion
    WHERE componente_destino_id = p_tuberia_anterior_id;

    v_tiene_entrada := FOUND;

    SELECT *
    INTO v_salida_antes
    FROM aquasense.conexion
    WHERE componente_origen_id = p_tuberia_anterior_id;

    v_tiene_salida := FOUND;

    IF NOT v_tiene_entrada AND NOT v_tiene_salida THEN
        RAISE EXCEPTION
            'La tubería anterior no tiene conexiones actuales.'
            USING ERRCODE = '23514';
    END IF;

    IF v_tiene_entrada THEN
        UPDATE aquasense.conexion
        SET componente_destino_id = p_tuberia_nueva_id
        WHERE conexion_id = v_entrada_antes.conexion_id
        RETURNING * INTO v_entrada_despues;

        v_conexiones := v_conexiones || jsonb_build_array(
            jsonb_build_object(
                'antes', to_jsonb(v_entrada_antes),
                'despues', to_jsonb(v_entrada_despues)
            )
        );
    END IF;

    IF v_tiene_salida THEN
        UPDATE aquasense.conexion
        SET componente_origen_id = p_tuberia_nueva_id
        WHERE conexion_id = v_salida_antes.conexion_id
        RETURNING * INTO v_salida_despues;

        v_conexiones := v_conexiones || jsonb_build_array(
            jsonb_build_object(
                'antes', to_jsonb(v_salida_antes),
                'despues', to_jsonb(v_salida_despues)
            )
        );
    END IF;

    -- Ya sin conexiones, la tubería anterior puede retirarse.
    UPDATE aquasense.componente
    SET estado = 'RETIRADO'
    WHERE componente_id = p_tuberia_anterior_id
    RETURNING * INTO v_anterior;

    INSERT INTO aquasense.reemplazo_tuberia (
        reemplazo_id,
        tuberia_anterior_id,
        tuberia_nueva_id,
        reporte_id
    )
    VALUES (
        p_reemplazo_id,
        p_tuberia_anterior_id,
        p_tuberia_nueva_id,
        p_reporte_id
    );

    -- Asociar ambas tuberías al reporte.
    INSERT INTO aquasense.reporte_componente (
        reporte_id,
        componente_id
    )
    VALUES
        (p_reporte_id, p_tuberia_anterior_id),
        (p_reporte_id, p_tuberia_nueva_id)
    ON CONFLICT (reporte_id, componente_id) DO NOTHING;

    -- La atención apunta a la tubería instalada. La relación
    -- formal con la anterior queda en reemplazo_tuberia.
    v_atencion := jsonb_set(
        p_atencion,
        '{componenteId}',
        to_jsonb(p_tuberia_nueva_id::TEXT),
        TRUE
    );

    PERFORM aquasense.registrar_atencion(
        p_evento_documental_id,
        p_reporte_id,
        v_atencion
    );

    -- Encolar el cambio incremental para Neo4j.
    PERFORM aquasense.encolar_evento_red(
        p_evento_grafo_id,
        jsonb_build_object(
            'operacion', 'REEMPLAZAR_TUBERIA',
            'reemplazoId', p_reemplazo_id::TEXT,
            'reporteId', p_reporte_id::TEXT,
            'tuberiaAnterior', to_jsonb(v_anterior),
            'tuberiaNueva', to_jsonb(v_nueva),
            'conexiones', v_conexiones
        )
    );

    RETURN p_reemplazo_id;
END;
$$;

COMMIT;