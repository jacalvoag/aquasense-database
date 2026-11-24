BEGIN;

CREATE FUNCTION aquasense.impedir_cambio_tipo_componente()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
        RAISE EXCEPTION
            'No se puede cambiar el tipo del componente %. '
            'Tipo actual: %. Tipo solicitado: %.',
            OLD.codigo,
            OLD.tipo,
            NEW.tipo
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER componente_tipo_inmutable
BEFORE UPDATE OF tipo
ON aquasense.componente
FOR EACH ROW
EXECUTE FUNCTION aquasense.impedir_cambio_tipo_componente();

COMMIT;