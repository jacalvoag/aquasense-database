MATCH (control:ControlRed {id: 'red-principal'})
WHERE control.estado = 'PENDIENTE_VERIFICACION'
  AND control.versionAplicada IS NULL

SET control.versionAplicada = 0,
    control.estado = 'INICIALIZADO',
    control.inicializadoEn = datetime()

RETURN
  control.id AS red,
  control.estado AS estado,
  control.versionAplicada AS version_aplicada;