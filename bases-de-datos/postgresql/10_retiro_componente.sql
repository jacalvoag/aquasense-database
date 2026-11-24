BEGIN;

CREATE FUNCTION aquasense.validar_retiro_componente()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Solo necesitamos esta comprobación cuando el componente
    -- cambia de ACTIVO a RETIRADO.
    IF OLD.estado = 'ACTIVO'
       AND NEW.estado = 'RETIRADO'
    THEN
        -- Usamos el mismo control de red que la validación
        -- de conexiones.
        PERFORM control_id
        FROM aquasense.control_red
        WHERE control_id = 1
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'No existe el registro de control de la red.'
                USING ERRCODE = '23514';
        END IF;

        -- Revisar si el componente aparece como origen o
        -- como destino en alguna conexión actual.
        IF EXISTS (
            SELECT 1
            FROM aquasense.conexion AS c
            WHERE c.componente_origen_id = OLD.componente_id
               OR c.componente_destino_id = OLD.componente_id
        ) THEN
            RAISE EXCEPTION
                'No se puede retirar el componente % porque tiene conexiones actuales.',
                OLD.codigo
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER componente_validar_retiro
BEFORE UPDATE OF estado
ON aquasense.componente
FOR EACH ROW
EXECUTE FUNCTION aquasense.validar_retiro_componente();

COMMIT;