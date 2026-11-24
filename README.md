# AquaSense — Preparación de las bases de datos

## Alcance

AquaSense utiliza tres bases de datos:

- **PostgreSQL:** datos operativos, lecturas, reportes, conexiones,
  reemplazos y eventos pendientes de sincronización.
- **MongoDB:** expedientes de reportes y detalle de sus atenciones.
- **Neo4j:** representación de la red para recorridos y consulta
  del historial de reemplazos.

Los datos del campus se usan como escenario académico. Las cisternas,
tuberías, conexiones, lecturas y reportes son supuestos o ficticios.

## PostgreSQL: estructura y carga base

En una base de datos PostgreSQL nueva:

1. Ejecutar, en orden, los archivos `01` a `23`.
2. Ejecutar los archivos `24` a `27` para cargar los espacios,
   componentes, conexiones y lecturas de ejemplo.
3. Ejecutar el archivo `28` para crear la vista de consumo.
4. Ejecutar los archivos `32`, `33` y `34` para instalar las
   operaciones de creación, eliminación y actualización de conexiones.

La carga base esperada contiene:

| Dato | Cantidad |
|---|---:|
| Espacios | 14 |
| Componentes | 20 |
| Conexiones | 22 |
| Lecturas | 7 |
| Reportes | 0 |
| Versión de red | 0 |

Los archivos `29`, `30` y `31` pertenecen al ejemplo completo del
reporte. No se deben ejecutar seguidos sin realizar los pasos
intermedios descritos más abajo.

## MongoDB: estructura

En una instalación nueva, ejecutar en este orden:

1. `01_coleccion_expedientes.js`
2. `02_indice_expedientes.js`

El primer archivo crea la colección y su validación. El segundo crea
un índice único por `reporteId`.

Los scripts seleccionan la base `aquasense`. Para una reconstrucción
aislada, usar otra instancia de MongoDB o adaptar el nombre de la base
en una copia de los scripts. No ejecutar la creación de la colección
sobre una base que ya la tenga.

Estos archivos no insertan el expediente del ejemplo.

## Neo4j: estructura y carga base

En una base de grafo nueva, ejecutar:

1. `01_restricciones.cypher`
2. `02_espacios.cypher`
3. `03_componentes.cypher`
4. `04_ubicaciones.cypher`
5. `05_espacios_interiores.cypher`
6. `06_conexiones.cypher`
7. `07_control_red.cypher`

Los archivos de carga deben procesar:

| Dato | Cantidad |
|---|---:|
| Espacios | 14 |
| Componentes | 20 |
| Ubicaciones | 20 |
| Relaciones entre espacios | 2 |
| Conexiones de agua | 22 |

El control de red debe quedar en `PENDIENTE_VERIFICACION`, sin versión
aplicada. Después de comparar la carga con PostgreSQL y comprobar que
la versión de red de PostgreSQL es `0`, ejecutar:

8. `08_confirmar_version_inicial.cypher`

La carga base representa la red antes del reemplazo: `TUB-03` está
activa y `TUB-12` todavía no existe.

No ejecutar la carga base sobre un grafo que ya contenga el ejemplo
de reemplazo. `MERGE` evita algunos duplicados, pero estos archivos
no reconstruyen ni concilian automáticamente un grafo existente.

## Ejemplo del reporte y reemplazo

El ejemplo completo se ejecutó manualmente en estas etapas:

1. Ejecutar `29_datos_iniciales_reporte.sql` en PostgreSQL.
2. Crear en MongoDB el expediente correspondiente al evento documental
   de secuencia `1`; verificarlo y confirmar ese evento en PostgreSQL.
3. Ejecutar `30_datos_iniciales_inspeccion.sql`.
4. Agregar la inspección al expediente en MongoDB; verificarla y
   confirmar el evento documental de secuencia `2` en PostgreSQL.
5. Ejecutar `31_datos_iniciales_reemplazo.sql`.
6. Agregar la reparación al expediente en MongoDB y confirmar el evento
   documental de secuencia `3`.
7. Aplicar el reemplazo en Neo4j, registrar el evento aplicado y
   avanzar el control del grafo a la versión `1`. Después, confirmar
   el evento de grafo en PostgreSQL.
8. Registrar la verificación en PostgreSQL, agregarla en MongoDB y
   confirmar el evento documental de secuencia `4`.
9. Cerrar el reporte en PostgreSQL.

Estos pasos describen lo realizado, pero **todavía no constituyen un
procedimiento de reconstrucción automatizado**: faltan guardar los
comandos intermedios de MongoDB, Neo4j y las confirmaciones de eventos.

No se debe marcar un evento como procesado sin comprobar que su cambio
se aplicó en la base de destino.

## Estado actual y pendientes

- La estructura y carga base de PostgreSQL se reconstruyeron en una
  base separada. Las 21 funciones y los 6 triggers coincidieron con
  los de la base original.
- Se creó y probó la colección de expedientes de MongoDB.
- Se cargó y comparó la red base en Neo4j.
- Se completó manualmente un ejemplo de reporte y reemplazo en las
  tres bases.

Queda pendiente:

- Guardar los comandos intermedios del ejemplo y las consultas de
  comprobación.
- Revisar la reconstrucción de tablas, restricciones e índices,
  además de funciones y triggers.
- Definir las operaciones necesarias para cambios de espacios y
  componentes, y el control de acceso a las escrituras.
- Implementar y probar la sincronización automática entre bases.
- Desarrollar la API y el sincronizador en el repositorio, con cambios
  y pruebas registrados por etapas.