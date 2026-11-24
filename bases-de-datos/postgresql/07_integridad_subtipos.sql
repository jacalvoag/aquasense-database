BEGIN;

-- Evita escrituras concurrentes mientras se verifica el estado
-- existente y se instalan las validaciones.
LOCK TABLE
    aquasense.componente,
    aquasense.valvula,
    aquasense.medidor
IN SHARE ROW EXCLUSIVE MODE;


-- 1. Comprobar nuevamente que no existan componentes incompletos.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM aquasense.componente AS c
        LEFT JOIN aquasense.valvula AS v
            ON v.componente_id = c.componente_id
        WHERE c.tipo = 'VALVULA'
          AND v.componente_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'No se puede instalar la validación: existen válvulas sin sus datos específicos.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM aquasense.componente AS c
        LEFT JOIN aquasense.medidor AS m
            ON m.componente_id = c.componente_id
        WHERE c.tipo = 'MEDIDOR'
          AND m.componente_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'No se puede instalar la validación: existen medidores sin sus datos específicos.';
    END IF;
END;
$$;


-- 2. Función que comprueba el subtipo de un componente.
CREATE FUNCTION aquasense.comprobar_subtipo_componente(
    p_componente_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_tipo aquasense.componente.tipo%TYPE;
BEGIN
    SELECT tipo
    INTO v_tipo
    FROM aquasense.componente
    WHERE componente_id = p_componente_id;

    -- Si el componente ya no existe, no hay subtipo que comprobar.
    IF NOT FOUND THEN
        RETURN;
    END IF;

    IF v_tipo = 'VALVULA'
       AND NOT EXISTS (
           SELECT 1
           FROM aquasense.valvula
           WHERE componente_id = p_componente_id
       )
    THEN
        RAISE EXCEPTION
            'El componente % es una válvula y necesita su registro en aquasense.valvula.',
            p_componente_id
            USING ERRCODE = '23514';
    END IF;

    IF v_tipo = 'MEDIDOR'
       AND NOT EXISTS (
           SELECT 1
           FROM aquasense.medidor
           WHERE componente_id = p_componente_id
       )
    THEN
        RAISE EXCEPTION
            'El componente % es un medidor y necesita su registro en aquasense.medidor.',
            p_componente_id
            USING ERRCODE = '23514';
    END IF;
END;
$$;


-- 3. Función que atiende las modificaciones de las tres tablas.
CREATE FUNCTION aquasense.validar_subtipo_componente()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- En una eliminación o actualización se revisa el componente
    -- al que pertenecía la fila anterior.
    IF TG_OP IN ('DELETE', 'UPDATE') THEN
        PERFORM aquasense.comprobar_subtipo_componente(
            OLD.componente_id
        );
    END IF;

    -- En una inserción o actualización se revisa el componente
    -- al que pertenece la fila nueva.
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM aquasense.comprobar_subtipo_componente(
            NEW.componente_id
        );
    END IF;

    RETURN NULL;
END;
$$;


-- 4. Validar componentes nuevos o modificados.
CREATE CONSTRAINT TRIGGER componente_subtipo_completo
AFTER INSERT OR UPDATE
ON aquasense.componente
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION aquasense.validar_subtipo_componente();


-- 5. Validar cambios o eliminaciones de datos de válvula.
CREATE CONSTRAINT TRIGGER valvula_subtipo_completo
AFTER UPDATE OR DELETE
ON aquasense.valvula
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION aquasense.validar_subtipo_componente();


-- 6. Validar cambios o eliminaciones de datos de medidor.
CREATE CONSTRAINT TRIGGER medidor_subtipo_completo
AFTER UPDATE OR DELETE
ON aquasense.medidor
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION aquasense.validar_subtipo_componente();

COMMIT;