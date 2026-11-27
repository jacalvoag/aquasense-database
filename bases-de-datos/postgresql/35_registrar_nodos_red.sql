BEGIN;

-- Migración aditiva: no borra ni recarga los datos existentes. Puede reaplicarse.
CREATE OR REPLACE FUNCTION aquasense.registrar_espacio_red(
    p_id UUID, p_evento_id UUID, p_nombre TEXT, p_tipo TEXT,
    p_contenedor_id UUID, p_descripcion TEXT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_espacio aquasense.espacio%ROWTYPE;
BEGIN
    PERFORM control_id FROM aquasense.control_red WHERE control_id = 1 FOR UPDATE;
    INSERT INTO aquasense.espacio (
        espacio_id, nombre, tipo, espacio_contenedor_id, descripcion
    ) VALUES (p_id, p_nombre, p_tipo, p_contenedor_id, p_descripcion)
    RETURNING * INTO v_espacio;
    RETURN aquasense.encolar_evento_red(p_evento_id, jsonb_build_object(
        'operacion', 'CREAR_ESPACIO', 'espacio', to_jsonb(v_espacio)
    ));
END;
$$;

CREATE OR REPLACE FUNCTION aquasense.registrar_componente_red(
    p_id UUID, p_evento_id UUID, p_codigo TEXT, p_nombre TEXT, p_tipo TEXT,
    p_espacio_id UUID, p_descripcion TEXT, p_posicion TEXT DEFAULT 'DESCONOCIDA'
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_componente aquasense.componente%ROWTYPE;
BEGIN
    PERFORM control_id FROM aquasense.control_red WHERE control_id = 1 FOR UPDATE;
    INSERT INTO aquasense.componente (
        componente_id, codigo, nombre, tipo, espacio_id, descripcion
    ) VALUES (p_id, p_codigo, p_nombre, p_tipo, p_espacio_id, p_descripcion)
    RETURNING * INTO v_componente;
    -- Los subtipos se crean en la misma transacción que el componente y su evento.
    IF p_tipo = 'MEDIDOR' THEN
        INSERT INTO aquasense.medidor (componente_id) VALUES (p_id);
    ELSIF p_tipo = 'VALVULA' THEN
        INSERT INTO aquasense.valvula (componente_id, posicion, posicion_registrada_en)
        VALUES (p_id, p_posicion, CASE WHEN p_posicion <> 'DESCONOCIDA' THEN CURRENT_TIMESTAMP END);
    END IF;
    RETURN aquasense.encolar_evento_red(p_evento_id, jsonb_build_object(
        'operacion', 'CREAR_COMPONENTE', 'componente', to_jsonb(v_componente)
    ));
END;
$$;

COMMIT;
