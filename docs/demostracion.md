# Guion de demostración de AquaSense

Duración sugerida: 5 a 7 minutos, después de ensayar el flujo completo. Usa datos
académicos y un código de tubería nuevo en cada ensayo. La presentación muestra
mantenimiento y conectividad; no anuncia detección automática de fugas.

## Preparación previa

1. Conserva tu base original. Elige la reconstrucción o las bases aisladas de
   [pruebas/README.md](../pruebas/README.md); no mezcles sus configuraciones.
2. Inicia las bases y, desde la raíz, ejecuta `.\iniciar.ps1`, o los
   [comandos manuales](ejecucion-local.md#arranque-manual). Mantén una sola
   instancia del sincronizador para ese conjunto de bases.
3. Abre Inicio y verifica los tres motores disponibles. Guarda la credencial
   local mediante **Acceso de operador**. La API la valida al enviar operaciones.
4. Escoge una tubería **ACTIVO y con conexiones** y anota su código y los espacios
   que alcanza. Selecciona uno de esos espacios para el reporte. Si ya
   reemplazaste TUB-03, usa la tubería actualmente instalada en ese ramal.
5. Prepara una lectura de un medidor activo, con fecha posterior a su última
   lectura y no futura, y un acumulado igual o mayor al último. Consulta los
   datos actuales; no reutilices fechas ni cifras sin comprobarlas.

La prueba automatizada deja un estado ya cerrado con
`TUB-PRUEBA-INTEGRAL` instalada. Puedes mostrarlo sin cambiar datos. Si quieres
otro flujo en ese mismo escenario, selecciona una tubería aún activa y utiliza
un reporte y una candidata nuevos. Para repetir la prueba automática desde
cero, sigue la eliminación de **sus volúmenes aislados** descrita en la guía.
No elimines las bases del equipo.

## Recorrido en la interfaz

| Tiempo aproximado | Acción | Qué explicar y comprobar |
| --- | --- | --- |
| 0:00–0:40 | Inicio y Red de agua. | Las cifras vienen de los registros. Seleccionar un componente resalta sus ramales y espacios aguas abajo. Mostrar las figuras y el panel de detalle. |
| 0:40–1:30 | Crear reporte para el espacio elegido. | PostgreSQL registra la operación y su evento. Esperar el expediente PROCESADO antes de seguir. |
| 1:30–2:10 | Agregar INSPECCION con descripción y hallazgos. | MongoDB reúne el detalle documental. Esperar confirmación y ver la atención en el expediente. |
| 2:10–3:20 | En Componentes, preparar una tubería con código único. Volver al reporte y elegir Reemplazar tubería. | La candidata nace sin conexiones. Seleccionar la anterior y la nueva; describir el trabajo y materiales. El reemplazo ya registra la REPARACION: no agregarla por separado. |
| 3:20–4:10 | Esperar expediente y red PROCESADO. Actualizar Red de agua. | La anterior queda RETIRADO; la nueva conserva sus conexiones y alcance. Mostrar que la versión avanzó respecto de la anotada al inicio. |
| 4:10–5:00 | Agregar VERIFICACION con resultado Sin indicios, esperar su confirmación y cerrar el reporte. | El cierre depende de las reglas del proceso. Mostrar CERRADO y las tres atenciones: inspección, reparación y verificación. |
| 5:00–5:40 | Capturar la lectura preparada y consultar consumo. | Se resta el acumulado anterior del nuevo. Por ejemplo, 120.500 − 118.000 = 2.500 m³, solo si esos eran los datos del ensayo. |
| 5:40–6:00 | Volver a Inicio y mostrar el repositorio. | Presentar los resultados de pruebas y las limitaciones. El alcance es conectividad, no simulación hidráulica. |

**PENDIENTE** del reporte indica su etapa de atención. **PENDIENTE** del evento
indica trabajo del sincronizador. **ERROR** requiere revisar la causa y la
recuperación del backend. No marcar eventos como procesados manualmente.

## Evidencia para conservar

Anota el ID del reporte y los eventos de reemplazo. Guarda capturas legibles
de la red antes y después, expediente con tres atenciones, cierre y consumo.
Los registros deben corresponder al mismo ensayo. Si usas una ejecución anterior,
indica su fecha; las evidencias del repositorio ya identifican la suya.

## Si hay una interrupción durante la exposición

Muestra el estado pendiente y consulta la terminal correspondiente. Usa
[solucion-problemas.md](solucion-problemas.md). Para continuar la explicación
sin nuevas escrituras, abre las capturas existentes y explica que son una
ejecución documentada. No presentes capturas antiguas como resultado del ensayo
interrumpido.

## Revisión del material de entrega

- README, contrato, informe y explicación oral deben describir el mismo alcance.
- En el cartel conserva el contexto de prototipo, los autores y el QR al
  [repositorio](https://github.com/jacalvoag/aquasense-database).
- Las nueve pruebas y 210 consultas del cartel pertenecen a la medición histórica
  del 25 de noviembre; consulta sus condiciones en [validacion.md](validacion.md).
- Conserva los archivos editables del cartel. Este cierre actualiza la
  documentación del repositorio, no reemplaza la plantilla PPTX por una imagen.
