BEGIN;

-- Como todavía no hay conexiones, comprobamos nuevamente
-- esa condición antes de instalar la validación.
LOCK TABLE aquasense.conexion
IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM aquasense.conexion
    ) THEN
        RAISE EXCEPTION
            'Ya existen conexiones. Deben revisarse antes de instalar esta validación.';
    END IF;
END;
$$;


CREATE FUNCTION aquasense.validar_conexion_red()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tipo_origen aquasense.componente.tipo%TYPE;
    v_estado_origen aquasense.componente.estado%TYPE;

    v_tipo_destino aquasense.componente.tipo%TYPE;
    v_estado_destino aquasense.componente.estado%TYPE;

    v_conexion_anterior UUID;
    v_forma_ciclo BOOLEAN;
BEGIN
    -- Coordinamos las modificaciones de conexiones mediante
    -- la fila de control de la red.
    PERFORM control_id
    FROM aquasense.control_red
    WHERE control_id = 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No existe el registro de control de la red.'
            USING ERRCODE = '23514';
    END IF;

    -- Al actualizar, excluimos la fila anterior de las
    -- comprobaciones de salidas y recorridos.
    IF TG_OP = 'UPDATE' THEN
        v_conexion_anterior := OLD.conexion_id;
    END IF;


    -- La conexión debe tener exactamente un destino.
    IF (
        NEW.componente_destino_id IS NULL
        AND NEW.espacio_destino_id IS NULL
    ) OR (
        NEW.componente_destino_id IS NOT NULL
        AND NEW.espacio_destino_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'La conexión debe tener un solo destino: componente o espacio.'
            USING ERRCODE = '23514';
    END IF;


    -- Consultar el componente de origen.
    SELECT tipo, estado
    INTO v_tipo_origen, v_estado_origen
    FROM aquasense.componente
    WHERE componente_id = NEW.componente_origen_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El componente de origen no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_estado_origen <> 'ACTIVO' THEN
        RAISE EXCEPTION
            'El componente de origen debe estar activo.'
            USING ERRCODE = '23514';
    END IF;


    -- Solo las uniones pueden tener más de una salida.
    IF v_tipo_origen <> 'UNION'
       AND EXISTS (
           SELECT 1
           FROM aquasense.conexion AS c
           WHERE c.componente_origen_id = NEW.componente_origen_id
             AND (
                 v_conexion_anterior IS NULL
                 OR c.conexion_id <> v_conexion_anterior
             )
       )
    THEN
        RAISE EXCEPTION
            'El componente de origen ya tiene una salida registrada.'
            USING ERRCODE = '23514';
    END IF;


    -- Si el destino es un espacio, el origen debe ser tubería.
    IF NEW.espacio_destino_id IS NOT NULL THEN
        IF v_tipo_origen <> 'TUBERIA' THEN
            RAISE EXCEPTION
                'Solo una tubería puede conectarse directamente a un espacio.'
                USING ERRCODE = '23514';
        END IF;

        -- La clave foránea comprueba que el espacio exista.
        RETURN NEW;
    END IF;


    -- A partir de aquí, el destino es otro componente.
    IF NEW.componente_origen_id = NEW.componente_destino_id THEN
        RAISE EXCEPTION
            'Un componente no puede conectarse consigo mismo.'
            USING ERRCODE = '23514';
    END IF;

    SELECT tipo, estado
    INTO v_tipo_destino, v_estado_destino
    FROM aquasense.componente
    WHERE componente_id = NEW.componente_destino_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El componente de destino no existe.'
            USING ERRCODE = '23503';
    END IF;

    IF v_estado_destino <> 'ACTIVO' THEN
        RAISE EXCEPTION
            'El componente de destino debe estar activo.'
            USING ERRCODE = '23514';
    END IF;


    -- Validar las combinaciones de tipos permitidas.
    IF NOT (
        (
            v_tipo_origen = 'CISTERNA'
            AND v_tipo_destino = 'TUBERIA'
        )
        OR (
            v_tipo_origen = 'TUBERIA'
            AND v_tipo_destino IN (
                'TUBERIA',
                'UNION',
                'VALVULA',
                'MEDIDOR'
            )
        )
        OR (
            v_tipo_origen = 'UNION'
            AND v_tipo_destino = 'TUBERIA'
        )
        OR (
            v_tipo_origen = 'VALVULA'
            AND v_tipo_destino = 'TUBERIA'
        )
        OR (
            v_tipo_origen = 'MEDIDOR'
            AND v_tipo_destino = 'TUBERIA'
        )
    ) THEN
        RAISE EXCEPTION
            'Conexión no permitida: % hacia %.',
            v_tipo_origen,
            v_tipo_destino
            USING ERRCODE = '23514';
    END IF;


    -- Si desde el destino ya se puede llegar al origen,
    -- agregar la nueva conexión cerraría un ciclo.
    WITH RECURSIVE recorrido AS (
        SELECT NEW.componente_destino_id AS componente_id

        UNION

        SELECT c.componente_destino_id
        FROM aquasense.conexion AS c
        INNER JOIN recorrido AS r
            ON c.componente_origen_id = r.componente_id
        WHERE c.componente_destino_id IS NOT NULL
          AND (
              v_conexion_anterior IS NULL
              OR c.conexion_id <> v_conexion_anterior
          )
    )
    SELECT EXISTS (
        SELECT 1
        FROM recorrido
        WHERE componente_id = NEW.componente_origen_id
    )
    INTO v_forma_ciclo;

    IF v_forma_ciclo THEN
        RAISE EXCEPTION
            'La conexión formaría un ciclo en la red.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER conexion_validar_red
BEFORE INSERT OR UPDATE
ON aquasense.conexion
FOR EACH ROW
EXECUTE FUNCTION aquasense.validar_conexion_red();

COMMIT;