# Contrato de la API AquaSense

Base local: `http://127.0.0.1:3000`. JSON UTF-8. Los identificadores son UUID.
Fechas: ISO 8601 con hora y zona (`Z` o `-06:00`). Los acumulados y secuencias
BIGINT se conservan como texto. Los campos de listados SQL usan snake_case;
las operaciones y respuestas compuestas usan camelCase, como se indica aquí.

## Acceso y estados HTTP

GET sin credencial. POST requiere `Authorization: Basic <base64(usuario:clave)>`
con API_OPERATOR_USER/API_OPERATOR_PASSWORD. El frontend puede pedir la credencial
al operador y conservarla solo en memoria. Nunca ponerla en variables públicas del
build ni persistirla en localStorage. La API local no emite tokens de sesión.
`CORS_ORIGINS` contiene orígenes exactos separados por coma, sin ruta final.

POST devuelve 201 salvo cierre (200). GET devuelve 200. Errores JSON con
`statusCode` y `message` (puede existir también `error`). 400: entrada inválida;
401: credencial ausente/incorrecta; 404: registro inexistente o evento ajeno al reporte;
409: conflicto de estado, duplicado o evento pendiente; 422: regla del dominio;
503: base inaccesible o proyección no sincronizada. 500: error inesperado.
No repetir POST automáticamente tras un timeout: los IDs se generan por petición;
consultar el estado antes de decidir otro envío. Deshabilitar el botón mientras se envía.

## Consultas

| GET | Respuesta |
| --- | --- |
| `/salud/postgres`, `/salud/mongodb`, `/salud/neo4j` | `{ "estado": "ok" }` o error de disponibilidad. |
| `/espacios` | Lista: espacio_id, nombre, tipo, espacio_contenedor_id, descripcion. |
| `/componentes` | Lista: componente_id, codigo, nombre, tipo, estado, espacio_id, espacio_nombre, descripcion, tiene_conexiones. |
| `/lecturas` | Lista: lectura_id, medidor_id, codigo_medidor, fecha_hora_anterior, fecha_hora, valor_anterior, valor_acumulado, consumo_m3. Primera lectura: consumo y valores anteriores null. |
| `/reportes` | Lista: reporte_id, espacio_id, espacio_nombre, estado, secuencia_documental, registrado_en, actualizado_en, cerrado_en, evento_documental_id, estado_evento_documental, evento_grafo_id, estado_evento_grafo. El evento de grafo prioriza uno sin procesar; si todos están confirmados, muestra el último. Sus campos son null si el reporte no tiene eventos de grafo. |
| `/reportes/:id/expediente` | `{reporteId, estadoDocumental, expediente}`. PENDIENTE o ERROR: expediente null. PROCESADO: expediente y atenciones de MongoDB, verificados contra la secuencia y evento de PostgreSQL. |
| `/reportes/:id/eventos/:eventoId` | `{reporteId, eventoId, destino, tipo, estado, secuencia, intentos, registradoEn, procesadoEn}`. Solo devuelve eventos vinculados al reporte. |
| `/componentes/:id/espacios-afectados` | `{componenteId, codigo, versionRed, espacios:[{espacioId,nombre,tipo}]}`. Requiere componente activo y red sincronizada. Tubería sin conexiones: 409. |
| `/red` | `{versionRed, nodos, conexiones}`. Red instalada de componentes activos conectados y espacios abastecidos. |
| `/red/componentes/:componenteId/alcance` | `{componenteId, versionRed, nodoIds, conexionIds, espacios:[{espacioId,nombre,tipo}]}`. Alcance dirigido aguas abajo. |

Cada nodo de `/red` tiene `id`, `clase` (`COMPONENTE` o `ESPACIO`), `entidadId`,
`nombre` y `tipo`. Los componentes además incluyen `codigo`, `estado` y
`espacioId` (ubicación o `null`). La ubicación no indica abastecimiento.
El identificador del nodo lleva el prefijo `c:` o `e:` seguido del UUID.
Cada conexión contiene `{id, origen, destino}`. El `id` es el UUID de la
conexión y los extremos corresponden a IDs del listado de nodos.

El alcance incluye el componente seleccionado, los ramales aguas abajo aunque
no lleguen a un espacio y los espacios alcanzados. La consulta devuelve 400
para UUID inválido, 404 para componente inexistente y 409 para componente
retirado o tubería sin conexiones. Una red sincronizada sin conexiones
devuelve listados vacíos. Ambas rutas devuelven 503 si el grafo no está
disponible, faltan sus controles, difiere la versión, existen eventos de grafo
pendientes o con error, o cambia la versión durante la consulta.
`versionRed` se devuelve como texto. Aplica el alcance sobre una red dibujada
solo cuando ambas respuestas tienen la misma versión.

Los espacios afectados se obtienen por conectividad del grafo. No representan
simulaciones hidráulicas ni prueban por sí solos una fuga real.

## Escrituras

Los campos opcionales se identifican con `?`; no se envía el signo de interrogación.
No enviar tipo/estado/identificadores generados que no aparezcan en estas entradas.

### POST /reportes

Entrada: `{espacioId, descripcionInicial, referenciaUbicacion?}`. Descripción no vacía.
Respuesta: `{reporteId, eventoId, estadoReporte:"PENDIENTE", estadoDocumentalInicial:"PENDIENTE"}`.

### POST /reportes/:id/atenciones

Entrada común: `{tipo, fecha, descripcion, componenteId?}`. Tipos y campos:
- INSPECCION: `hallazgos` obligatorio no vacío.
- REPARACION: `materiales?`, lista de textos no vacíos.
- VERIFICACION: `resultado`, uno de SIN_INDICIOS, PERSISTE, NO_CONCLUYENTE.

Respuesta: `{reporteId, atencionId, eventoId, estadoDocumentalInicial:"PENDIENTE"}`.
Esperar confirmación del evento antes de otra atención del mismo reporte.

### POST /lecturas

Entrada: `{medidorId, fechaHora, valorAcumulado}`. Acumulado como texto:
`"120.000"`, no negativo, hasta 11 cifras enteras y 3 decimales. PostgreSQL exige
medidor activo, fecha no futura y posterior a la última, acumulado no decreciente.
Respuesta: `{lecturaId, medidorId, fechaHora, valorAcumulado}`.

### POST /componentes/tuberias

Entrada: `{codigo, nombre, espacioId?, descripcion?}`. Código único de hasta 40
caracteres (se convierte a mayúsculas); nombre no vacío hasta 150 caracteres.
Respuesta: `{componenteId, codigo, nombre, tipo:"TUBERIA", estado:"ACTIVO"}`.
Queda sin conexiones en PostgreSQL. Se incorpora al grafo al efectuar un reemplazo.
Una tubería activa sin conexiones es candidata, no garantía de elegibilidad: la función
SQL también revisa el historial de reemplazos y las demás restricciones.

### POST /reportes/:id/reemplazo

Entrada: `{tuberiaAnteriorId, tuberiaNuevaId, fecha, descripcion, materiales?}`.
Ambas tuberías deben existir y estar activas; la nueva no debe estar conectada ni
haber sido utilizada previamente como tubería nueva en otro reemplazo. El reporte
no puede estar cerrado. PostgreSQL mueve las conexiones, retira la anterior y registra
el reemplazo y la atención REPARACION en una operación atómica.
Respuesta: `{reporteId, reemplazoId, atencionId, eventoDocumentalId, eventoGrafoId,
estadoDocumentalInicial:"PENDIENTE", estadoGrafoInicial:"PENDIENTE"}`.

No registrar otra REPARACION por separado para el mismo reemplazo. Consultar ambos
IDs en `/reportes/:id/eventos/:eventoId` hasta confirmar los dos. Un éxito HTTP solo
confirma PostgreSQL, no las otras bases. ERROR requiere intervención del responsable
de backend; no se reactiva desde la interfaz ni se marca PROCESADO manualmente.

### POST /reportes/:id/cerrar

Sin cuerpo. Respuesta: `{reporteId, estado:"CERRADO"}`. Exige reporte EN_ATENCION,
última atención VERIFICACION/SIN_INDICIOS y su evento documental confirmado. Si hubo
reemplazo, la interfaz también debe esperar el evento de grafo antes de dar por terminado
el flujo integrado. El cierre SQL valida lo documental, no la confirmación de todo el grafo.

## Secuencia de demostración

1. Crear reporte sobre espacio existente. Esperar su evento DOCUMENTAL PROCESADO.
2. Registrar inspección. Esperar confirmación y consultar expediente.
3. Crear tubería de código nuevo. Seleccionar una anterior activa con conexiones.
4. Solicitar reemplazo y esperar sus dos eventos PROCESADO.
5. Consultar componentes, expediente y espacios afectados desde la tubería instalada
   o desde un componente aguas arriba. La retirada debe estar RETIRADO.
6. Registrar verificación SIN_INDICIOS, esperar confirmación y cerrar el reporte.
7. Consultar listado de reportes y expediente. Conservar IDs y evidencia de la prueba.

El escenario usa datos académicos ficticios. Sigue la [guía local](../ejecucion-local.md) y ejecuta una sola instancia del sincronizador. Consulta el [informe de validación](../validacion.md).
