# AquaSense 1.1.0 — registro y construcción de ramales

Amplía la aplicación para registrar espacios y los cinco tipos de componentes,
crear/cambiar/eliminar conexiones y actualizar el diagrama al confirmar los
cambios. Los registros nuevos pueden utilizarse en lecturas, reportes y
reemplazos.

## Actualización necesaria

Con PostgreSQL encendido, detén API y sincronizador. Desde la raíz y con tus
archivos `.env` existentes:

```powershell
npm ci --prefix api
npm ci --prefix sincronizador
npm ci --prefix frontend
node --env-file=sincronizador/.env herramientas/actualizar-red.mjs --aplicar
.\iniciar.ps1
```

Se aplican únicamente las migraciones 35 y 36, sin recargar datos. La operación
usa el destino de `sincronizador/.env`, que debe coincidir con el de la API.

## Incluye

- Altas de espacios, cisternas, tuberías, uniones, válvulas y medidores.
- Subtipos y eventos registrados de forma atómica.
- Administración de conexiones mediante formularios con opciones compatibles.
- Confirmación visible de eventos y actualización automática de la vista de red.
- Compatibilidad con las candidatas registradas antes de esta versión.
- Recuperación sin duplicados de altas y de reemplazos con nodos ya existentes.
- Pruebas unitarias, HTTP, flujo real con tres motores y navegador.

Consulta [la guía de red dinámica](https://github.com/jacalvoag/aquasense-database/blob/main/docs/red-dinamica.md).

## Alcance

Las figuras representan conectividad y los catálogos conservan elementos sin
conexiones. Se mantienen los límites de sensores, detección automática de fugas,
simulación hidráulica y despliegue público de producción. La credencial de
operador corresponde al modo local documentado.
