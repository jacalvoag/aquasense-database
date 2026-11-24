MERGE (control:ControlRed {id: 'red-principal'})
ON CREATE SET
  control.estado = 'PENDIENTE_VERIFICACION',
  control.creadoEn = datetime()

RETURN
  control.id AS red,
  control.estado AS estado,
  control.versionAplicada AS version_aplicada;