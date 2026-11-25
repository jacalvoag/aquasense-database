# Validación del prototipo AquaSense

Pruebas del 25 de noviembre de 2026. El escenario es una red hidráulica académica con datos ficticios.

## Integración desde la interfaz

Se usó Edge, la API NestJS y el sincronizador con tres bases reales en un proyecto Docker separado. La carga inicial tenía 14 espacios, 20 componentes, 22 conexiones, 7 lecturas y 0 reportes. La demostración conservó esa carga durante la prueba.

| Caso | Condición y pasos | Resultado esperado | Resultado observado | Estado y evidencia interna |
| --- | --- | --- | --- | --- |
| P6-01 · Arranque | Abrir portada y red con carga base. | Tres motores disponibles y versión 0. | Tres motores disponibles, 25 nodos y 22 conexiones. | Aprobado · `resultados.json` |
| P6-02 · Reporte | Intentar envío sin espacio. Elegir baños de UD1, guardar con el sincronizador detenido y reactivarlo. | Exigir espacio y crear un solo expediente al sincronizar. | HTTP 201. El reporte quedó pendiente y después apareció un solo expediente. | Aprobado · `01-reporte-pendiente.png` |
| P6-03 · Inspección | Agregar una inspección al reporte abierto y esperar confirmación. | Una atención nueva en el expediente. | Una inspección confirmada en MongoDB. | Aprobado · `resultados.json` |
| P6-04 · Tubería candidata | Dar de alta una tubería y consultar su alcance antes de instalarla. | Candidata activa sin conexiones y alcance rechazado. | Alta HTTP 201 y alcance HTTP 409. | Aprobado · `resultados.json` |
| P6-05 · Validaciones | Enviar solicitudes inválidas, duplicadas o sin autorización. Probar reemplazo incompatible, cierre prematuro y evento ajeno. | Rechazar las solicitudes y conservar el estado previo. | 13 rechazos. PostgreSQL conservó 1 reporte, 0 reemplazos, 7 lecturas, 21 componentes y versión 0. | Aprobado · `resultados.json` |
| P6-06 · Reemplazo y reinicio | Detener el sincronizador, reemplazar TUB-03, recargar y reiniciar el procesador. | Dos eventos recuperables. Al confirmar, se conserva el alcance y se aplica cada cambio una vez. | La red devolvió 503 durante la espera. Los dos eventos se confirmaron, con una reparación en MongoDB y una aplicación en Neo4j. Red versión 1 con TUB-03 retirada. | Aprobado · `02-reemplazo-eventos-pendientes.png`, `03-red-reemplazada.png` |
| P6-07 · Cierre | Registrar verificación «Sin indicios», esperar confirmación, cerrar y reintentar un reemplazo. | Reporte cerrado con tres atenciones. Rechazar otro reemplazo. | Cierre HTTP 200, tres atenciones y un único reemplazo. | Aprobado · `04-reporte-cerrado.png` |
| P6-08 · Lectura | Registrar 120.500 m³ para MED-01, tras un acumulado de 118.000 m³. | Consumo de 2.500 m³ en el intervalo. | API e interfaz mostraron 2.500 m³. | Aprobado · `05-lectura-y-consumo.png` |
| P6-09 · Recuperación | Detener MongoDB y Neo4j. Consultar expediente y red antes y después de reanudar. | HTTP 503 durante la interrupción y recuperación de ambas consultas. | Se observó el 503 y luego se recuperaron tres atenciones y la red versión 1. | Aprobado · `resultados.json` |

El registro interno `contexto/paso-6/` conserva las capturas, los pasos de reproducción y los resultados por caso con hora e identificadores de ejecución.

## Rendimiento básico de consultas

Windows (compilación 26300), Intel Core i7-13620H con 16 procesadores lógicos y 15.64 GiB de RAM. El motor Docker 29.1.3 tenía disponibles 16 procesadores lógicos y 7.57 GiB. Se usaron Node 26.13.0, Nest 12.6.0, PostgreSQL 16.15, MongoDB 8.0.38 y Neo4j 5.26.34.

Se reutilizó el estado final de la prueba integrada: 14 espacios, 21 componentes, 8 lecturas, 1 reporte cerrado, 1 expediente con 3 atenciones y red versión 1 con 25 nodos y 22 conexiones. El sincronizador se mantuvo detenido con los eventos confirmados.

Un cliente HTTP local hizo 5 solicitudes de calentamiento por ruta y después 30 solicitudes secuenciales por ruta en orden rotativo. Se midió hasta recibir el cuerpo completo. Los percentiles se calcularon por rango más próximo. Las 210 solicitudes medidas devolvieron HTTP 200 y sus cuerpos cumplieron las comprobaciones de contenido.

| Consulta | Muestras | P50 (ms) | P95 (ms) |
| --- | ---: | ---: | ---: |
| Espacios | 30 | 1.79 | 2.57 |
| Componentes | 30 | 1.84 | 2.79 |
| Lecturas | 30 | 1.75 | 2.90 |
| Reportes | 30 | 1.80 | 2.67 |
| Expediente | 30 | 3.29 | 4.21 |
| Red instalada | 30 | 14.52 | 25.09 |
| Alcance aguas abajo | 30 | 12.23 | 19.45 |

El registro interno `contexto/paso-7/` conserva el procedimiento, el script, la salida JSON y las muestras individuales.

## Límites del resultado

- Los tiempos describen una carga local pequeña y secuencial. Quedan fuera de la medición la concurrencia, el tiempo visual del navegador, las escrituras, la sincronización y el consumo de recursos durante cada operación.
- El escenario académico no permite estimar ahorro de agua ni precisión en detección de fugas.
- La instalación probada usa una credencial de operador local y un único sincronizador. La edición general de espacios y componentes queda fuera del prototipo.
- Las pruebas HTTP de desarrollo usan drivers simulados. Los nueve casos de esta matriz cubren un flujo integrado real. La reconstrucción de tablas, restricciones e índices de PostgreSQL está pendiente de una comparación completa con la base original.
