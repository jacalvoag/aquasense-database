# Crear y modificar la red desde la aplicación

AquaSense permite dar de alta espacios, cisternas, tuberías, uniones, válvulas y
medidores; crear, cambiar o eliminar conexiones; y utilizar los registros nuevos
en reportes, lecturas y reemplazos. Las operaciones se conservan al reiniciar.
Los datos del ejemplo son académicos; las escrituras se realizan en las bases.

## Actualizar una instalación existente

Actualiza el repositorio y detén temporalmente API, sincronizador y frontend. Desde la raíz:

```powershell
npm ci --prefix api
npm ci --prefix sincronizador
npm ci --prefix frontend
node --env-file=sincronizador/.env herramientas/actualizar-red.mjs --aplicar
node --env-file=sincronizador/.env herramientas/actualizar-red.mjs --comprobar
.\iniciar.ps1
```

El comando utiliza el PostgreSQL de `sincronizador/.env`; la API debe usar la
misma base. Aplica únicamente los scripts **35 y 36** en una transacción,
conserva tablas y datos, y no carga ejemplos. Puede reaplicarse. Si falla,
revierte esa transacción. No reemplaces tus archivos `.env` ni ejecutes de nuevo
la carga inicial sobre bases que ya contienen trabajo.

También puedes ejecutar 35 y 36, en ese orden, con tu cliente PostgreSQL. Para
una base nueva, sigue [preparacion-bases.md](preparacion-bases.md).

Las comparaciones de estructura anteriores a esta ampliación siguen siendo
evidencia histórica. Esta migración añade dos funciones y actualiza dos
existentes; si comparas una base migrada con otra sin migrar, esas diferencias
son esperadas. No actualices la base original de referencia para ocultarlas.

## Ensayo de un ramal nuevo

1. Inicia las bases y las tres aplicaciones. Abre **Acceso de operador**.
2. En **Espacios**, registra “Zona de riego adicional de UD1”. Selecciona el tipo
   Zona de riego y, si corresponde, UD1 como contenedor. Espera la confirmación.
3. En **Componentes**, registra una tubería de código único, por ejemplo
   `TUB-DEMO-NUEVA`, y selecciona el espacio nuevo como ubicación. Espera la
   confirmación. Ubicar un componente no lo conecta al agua.
4. En **Conexiones**, crea `UNI-01 → TUB-DEMO-NUEVA`. Una unión admite ramales.
   Espera la confirmación antes de continuar.
5. Crea `TUB-DEMO-NUEVA → Zona de riego adicional de UD1`, seleccionando **Espacio
   abastecido** como destino. Espera la confirmación.
6. En **Red de agua**, selecciona UNI-01 o la tubería nueva. Comprueba el ramal
   y su espacio aguas abajo. La vista comprueba versiones cada dos segundos.
7. En **Conexiones**, usa **Modificar** para cambiar el destino por otro espacio
   sin entrada. Si mantienes el diagrama abierto en otra pestaña, también
   actualizará el recorrido al confirmar el cambio.
8. Prueba **Eliminar** solo sobre una conexión del ensayo. La interfaz pide
   confirmación. Los espacios, componentes, lecturas y reportes se conservan;
   el tramo deja de formar parte de los recorridos.

Puedes registrar un medidor nuevo y capturar sus lecturas desde **Lecturas**.
La primera lectura no tiene consumo anterior. También puedes crear un reporte
para el espacio nuevo y completar el [flujo de mantenimiento](demostracion.md).
Una tubería sin conexiones puede utilizarse en un reemplazo si cumple las
reglas de la operación.

## Reglas del registro

- Tipos de espacio: edificio, baño, laboratorio, oficina, cafetería, zona de
  riego y otro. El contenedor es opcional y debe existir.
- Los códigos de componentes son únicos. Los componentes nacen ACTIVO.
- Los medidores se crean junto con su subtipo y usan m³. Las válvulas se crean
  junto con su posición registrada; no es una lectura de sensor. El recorrido
  representa conectividad y no calcula el efecto hidráulico de esa posición.
- Cada conexión tiene un origen y exactamente un destino, componente o espacio.
- Solo las uniones admiten varias salidas. Cada destino admite una entrada.
- Solo una tubería puede conectar directamente con un espacio. Los extremos
  deben estar activos y ser compatibles. PostgreSQL rechaza ciclos.
- Crear, cambiar o eliminar una conexión genera un evento de red. Mientras haya
  cambios pendientes o con error, la vista evita presentar un diagrama antiguo
  como si estuviera actualizado.
- Los registros sin conexiones aparecen en los catálogos. El diagrama muestra
  componentes activos conectados y espacios abastecidos.

## API incorporada

| Método y ruta | Propósito |
| --- | --- |
| POST `/espacios` | Alta de espacio con evento de red. |
| POST `/componentes` | Alta de cualquier tipo admitido, subtipo y evento. |
| GET `/conexiones` | Lista con extremos e identificadores actuales. |
| POST `/conexiones` | Crear una conexión. |
| POST `/conexiones/:id/actualizar` | Cambiar sus extremos. |
| POST `/conexiones/:id/eliminar` | Eliminarla; responde 200. |
| GET `/red/eventos/:id` | Consultar la confirmación de un evento de grafo. |
| GET `/red/estado` | Versión operativa y cantidades de eventos pendientes/con error. |

Las escrituras requieren la credencial de operador. Las consultas son públicas.
El [contrato](api/contrato.md) describe cuerpos y respuestas. Se conserva la
ruta antigua `POST /componentes/tuberias`: prepara una candidata sin evento de
alta; sus snapshots permiten incorporarla al conectarla o reemplazarla.

## Pruebas

La prueba de sistema crea espacios y los cinco tipos, comprueba subtipos y
atomicidad, conecta una candidata antigua, cambia/elimina conexiones y rechaza
ciclos, duplicados, tipos incompatibles y retirados. También recupera un alta
interrumpida y reemplaza una candidata cuyo nodo ya existe en Neo4j.

La prueba de navegador registra un espacio y una tubería desde formularios,
confirma persistencia después de recargar, crea ambas conexiones y observa un
cambio de destino realizado por otro cliente sin recargar el diagrama. Después
elimina una conexión desde la interfaz. Usa API y motores reales.
