# AquaSense: memoria técnica de la entrega académica

Autores: José Antonio Calvo Aguilar y Uzzi Yazziel Gonzaga Gómez.  
Programa: Ingeniería en Tecnologías de la Información e Innovación Digital,
Universidad Politécnica de Chiapas.  
Docente: Horacio Irán Solís Cisneros.  
Fecha de cierre documental: 27 de noviembre de 2026.

## Problema y objetivo

El mantenimiento de una red de agua necesita relacionar sus componentes y
conexiones con los espacios abastecidos, las lecturas de medidores y las
acciones realizadas ante un reporte. Consultar cada dato por separado dificulta
seguir el proceso y reconocer qué espacios se encuentran aguas abajo de un
componente.

AquaSense integra esas consultas y un flujo de mantenimiento en un prototipo
web. El objetivo de la entrega es registrar lecturas manuales, atender un
reporte hasta su cierre, conservar el expediente y consultar la conectividad
de la red utilizando tres modelos de bases de datos con responsabilidades
definidas.

Se utiliza un campus como caso de demostración. Los nombres de espacios dan
contexto al escenario; la infraestructura hidráulica, las lecturas y los
incidentes son supuestos o datos de prueba. No se realizó un levantamiento
hidráulico del campus.

## Diseño e integración

| Parte | Tecnología | Responsabilidad implementada |
| --- | --- | --- |
| Interfaz | React, TypeScript y Vite | Consultas, formularios del operador, estados de confirmación y resumen de registros. |
| Diagrama | React Flow, Dagre y SVG | Distribución del esquema, figuras por tipo, selección, zoom, lista y alcance resaltado. |
| API | NestJS y TypeScript | Validación de entradas, autorización de escrituras, ejecución de operaciones SQL y consulta de proyecciones. |
| Base operativa | PostgreSQL | Espacios, componentes, conexiones, lecturas, reportes, reemplazos, controles y eventos. |
| Base documental | MongoDB | Un expediente por reporte con las atenciones y la última secuencia aplicada. |
| Grafo | Neo4j | Conectividad dirigida, control de versión y registro de eventos de red aplicados. |
| Procesador | Node.js y TypeScript | Selección ordenada, aplicación y confirmación de eventos; reintentos y recuperación. |

PostgreSQL concentra las reglas que necesitan una operación coherente:
validación de lecturas, conexiones y reemplazos, cambios de estado y creación
de eventos. Las restricciones y transacciones evitan que una sustitución
registre solo una parte del cambio operativo.

MongoDB permite consultar en un documento el detalle de un reporte. Una
inspección contiene hallazgos, una reparación puede contener materiales y una
verificación incluye un resultado. El índice único por reporte y el control
de secuencia evitan crear varios expedientes para el mismo reporte.

Neo4j expresa conexiones dirigidas entre componentes y espacios. Los recorridos
aguas abajo siguen las relaciones de la red y devuelven los espacios
alcanzables. Esto describe conectividad, sin calcular presión ni caudal.

La elección responde a un ejercicio de integración de modelos. PostgreSQL
también podría almacenar documentos o ejecutar consultas recursivas; no se
afirma que las tareas sean imposibles con un solo motor ni que se haya medido
una superioridad frente a esa alternativa.

## Consistencia y recuperación

La API escribe primero en PostgreSQL. La operación registra los eventos de
salida dentro de la transacción correspondiente. El sincronizador aplica los
cambios en MongoDB o Neo4j y después confirma el evento en PostgreSQL. No se
implementó una transacción distribuida entre los tres motores.

Las secuencias documentales se controlan por reporte; los cambios del grafo
siguen una secuencia global de versiones de red. El procesador utiliza un
bloqueo de sesión para evitar dos ejecuciones simultáneas sobre el mismo
conjunto de eventos. Los fallos se registran con reintentos; al alcanzar su
límite el evento queda en ERROR y requiere intervención.

Si el destino ya aplicó el evento pero su confirmación falla, la secuencia,
el ID de evento y los registros aplicados permiten reconocerlo al reintentar.
Las pruebas de sistema provocan esa interrupción tanto en el flujo documental
como en el grafo y verifican que no se dupliquen sus efectos.

La interfaz distingue el estado operativo del reporte y los estados de sus
eventos. La API comprueba las secuencias y versiones antes de entregar
proyecciones como actuales. Cuando no están confirmadas devuelve el estado de
espera o un error de disponibilidad según la ruta.

## Funcionalidades demostradas

- Catálogos de espacios, componentes, reportes y lecturas.
- Altas de espacios y de los cinco tipos de componentes, con subtipos atómicos.
- Creación, modificación y eliminación de conexiones con actualización del diagrama.
- Registro manual de lecturas acumuladas y cálculo de consumo del intervalo.
- Creación de reporte, inspección, reparación, verificación y cierre.
- Preparación de una tubería candidata sin conexiones y reemplazo de una
  tubería instalada conservando las conexiones.
- Consulta de expediente y del estado de los eventos vinculados al reporte.
- Red ilustrada, recorrido aguas abajo y espacios alcanzables.
- Comprobación de salud de los tres motores.
- Portada con cifras de registros actuales, sin sustituir fallos de consulta
  por contadores en cero.
- Acceso de operador para habilitar formularios y validar cada escritura.

La autorización local emplea una credencial configurada en la API y conservada
solo en memoria por la interfaz. No es un sistema de cuentas y roles. El modo
documentado es local; una publicación en Internet requiere preparar transporte,
autenticación y operación adecuados para ese entorno.

## Evidencia y resultados

Los resultados se mantienen separados por fecha y tipo de prueba. La
[matriz de validación](validacion.md), las
[evidencias del 27 de noviembre](../pruebas/evidencias/2026-11-27/README.md)
y los artefactos de GitHub Actions conservan sus condiciones.

| Evidencia documentada | Resultado y alcance |
| --- | --- |
| Integración manual del 25 de noviembre | Nueve casos aprobados: arranque, reporte, inspección, candidata, rechazos, reemplazo y reinicio, cierre, lectura y recuperación de consultas. |
| Medición local del 25 de noviembre | 210 solicitudes medidas, todas HTTP 200, repartidas en siete rutas. Mayor P95 por ruta: 25.09 ms, en la consulta de red. Carga pequeña y secuencial. |
| API del 27 de noviembre, antes del cierre de presentación | 58 pruebas unitarias y 18 HTTP aprobadas. Las HTTP usan drivers simulados. |
| Sincronizador del 27 de noviembre | Cuatro pruebas unitarias y cinco de selección, fallos y bloqueo contra PostgreSQL real. |
| Sistema del 27 de noviembre | Flujo real con tres motores, siete grupos de comprobaciones, recuperación sin duplicados, cierre y consumo de 2.500 m³ en el escenario de prueba. |
| Interfaz del 27 de noviembre | Red y alcance comprobados en escritorio y móvil contra servicios reales; capturas incluidas en evidencias. |
| Estructura local original y copia | El responsable reportó 190 objetos coincidentes en aquasense y aquasense_reconstruccion, sin diferencias. El repositorio conserva su resumen, no los snapshots locales. |
| Reproducibilidad de scripts | Dos reconstrucciones aisladas coincidieron; un índice retirado en una transacción revertida fue detectado por el comparador. Es una prueba diferente de la comparación original/copia. |

El inventario local incluye 123 restricciones; las reconstrucciones aisladas
en PostgreSQL 16.15 incluyen 69. Esos conteos pertenecen a inventarios distintos.
La explicación y las cantidades completas están en las evidencias; no deben
combinarse como si fueran una sola medición.

La prueba nativa del 27 de noviembre utilizó MongoDB 7.0.48 por una limitación
del entorno. La configuración Compose y la medición histórica utilizan MongoDB
8.0.38. La validación continua ejecuta las versiones fijadas en Compose y
conserva por separado su salida, sin reescribir las mediciones históricas.

## Cierre y condiciones de aceptación

La entrega se considera lista para demostrar cuando:

1. La instalación elegida responde en las tres rutas de salud.
2. Un reporte puede recorrer el flujo documentado, confirmar los eventos y
   cerrarse con su expediente y red coherentes.
3. La lectura devuelve el consumo esperado para su intervalo.
4. Las pruebas aplicables al código pasan y se conserva su resultado.
5. La explicación y el cartel distinguen los datos académicos de mediciones
   reales de infraestructura.

El repositorio incorpora un lanzador, un guion de demostración y diagnóstico.
La validación automatizada de Windows revisa sintaxis y configuración del
lanzador. Abrir las tres terminales y comprobar el equipo concreto de
presentación sigue siendo una comprobación manual antes de exponer.

## Valoración y limitaciones

Los resultados respaldan el registro del proceso de mantenimiento, la consulta
del historial y la navegación de conexiones del escenario probado. La
recuperación verificada respalda el diseño de eventos para las interrupciones
ensayadas. No constituye una garantía sobre cualquier fallo o volumen de datos.

La entrega no incluye sensores, detección automática de fugas, cálculos
hidráulicos, plano geográfico exacto, edición de atributos de todos los registros existentes,
cuentas múltiples ni despliegue público de producción. Tampoco permite
cuantificar ahorro de agua. Las mediciones disponibles no son pruebas de carga
concurrente ni de escalabilidad.

## Fuentes técnicas

La implementación y sus pruebas son la evidencia primaria de este proyecto:

- [Contrato de API](api/contrato.md).
- [Sincronizador y recuperación](../sincronizador/README.md).
- [Prueba integrada reproducible](../pruebas/README.md).
- [Exportación y comparación de estructura](../herramientas/README.md).
- [Código y scripts](https://github.com/jacalvoag/aquasense-database).

Documentación oficial para consultar las tecnologías empleadas:

- [PostgreSQL: restricciones](https://www.postgresql.org/docs/16/ddl-constraints.html)
  y [transacciones](https://www.postgresql.org/docs/16/tutorial-transactions.html).
- [MongoDB: modelado de datos](https://www.mongodb.com/docs/manual/data-modeling/).
- [Neo4j: patrones de longitud variable](https://neo4j.com/docs/cypher-manual/current/patterns/variable-length-patterns/).
- [NestJS](https://docs.nestjs.com/).
- [React Flow](https://reactflow.dev/learn).
- [Playwright](https://playwright.dev/docs/intro).

Estas fuentes explican las herramientas. Los resultados y cantidades del
prototipo proceden de las evidencias del equipo, no de esas fuentes.

## Ampliación 1.1.0: registro y construcción de ramales

La [red dinámica](red-dinamica.md) permite crear nuevos espacios y componentes y
administrar conexiones desde formularios. Las altas y conexiones generan eventos
de grafo y la vista comprueba su confirmación antes de actualizar el esquema.
Los registros nuevos pueden emplearse en los flujos de lectura y mantenimiento.
Esta ampliación conserva los límites físicos del prototipo y añade sus propias
pruebas de sistema y navegador; no amplía las mediciones históricas de rendimiento.
