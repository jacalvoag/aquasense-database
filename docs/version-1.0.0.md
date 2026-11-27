# AquaSense 1.0.0 — entrega académica

Versión del prototipo local para demostración del proyecto integrador.

## Incluye

- API NestJS conectada a PostgreSQL, MongoDB y Neo4j.
- Lecturas manuales, consumo por intervalo y flujo de reporte hasta su cierre.
- Expedientes con inspección, reparación y verificación.
- Reemplazo de tubería con conservación de conexiones y dos eventos de salida.
- Sincronización ordenada, reintentos, registro de fallos y recuperación.
- Interfaz React con red ilustrada, alcance, vista móvil y resumen de registros.
- Explicación de tuberías candidatas y acceso de operador para escrituras.
- Lanzador de Windows, guía de arranque, diagnóstico y guion de demostración.
- Pruebas unitarias, HTTP, sistema con tres motores y navegador.
- Herramientas de exportación y comparación de estructura PostgreSQL.

## Ejecutar

Prepara las bases y los archivos `.env` según la
[guía local](https://github.com/jacalvoag/aquasense-database/blob/main/docs/ejecucion-local.md).
Desde la raíz, en Windows:

```powershell
.\iniciar.ps1 -Instalar
```

Los siguientes arranques usan `.\iniciar.ps1`. Para la exposición sigue el
[guion](https://github.com/jacalvoag/aquasense-database/blob/main/docs/demostracion.md).

## Validación

La publicación automática se realiza en main después de aprobar las
comprobaciones del código, el sistema y la interfaz con tres motores aislados,
y la sintaxis/configuración del lanzador en Windows. Las ejecuciones conservan
logs y capturas en GitHub Actions.

La [validación documentada](https://github.com/jacalvoag/aquasense-database/blob/main/docs/validacion.md)
y el [informe técnico](https://github.com/jacalvoag/aquasense-database/blob/main/docs/informe-tecnico.md)
separan la evidencia histórica de las nuevas ejecuciones. El arranque de las
tres terminales en el equipo de exposición debe comprobarse manualmente.

## Límites conocidos

Escenario académico con infraestructura y lecturas de prueba. Sin sensores,
detección automática de fugas, simulación hidráulica ni ahorro de agua medido.
La credencial de operador y el modo de ejecución se diseñaron para uso local.
Una candidata nueva se conecta mediante un reemplazo; la edición libre de
conexiones está fuera del alcance de esta entrega.
