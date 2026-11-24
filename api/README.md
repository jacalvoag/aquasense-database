# API AquaSense

API para consultar información del sistema de agua del campus, registrar
lecturas y gestionar reportes y reemplazos de tuberías.

La API utiliza PostgreSQL como base principal, MongoDB para expedientes y
Neo4j para consultar la red de componentes.

## Requisitos

- Node.js y npm. Las pruebas locales se realizaron con Node.js 26.13.0.
- PostgreSQL, MongoDB y Neo4j en ejecución.
- Las bases preparadas mediante los scripts del repositorio.
- El sincronizador configurado para procesar los eventos.

## Configuración

Desde la carpeta `api`, instala las dependencias:

```powershell
npm ci
```

Copia la plantilla de configuración:

```powershell
Copy-Item .env.example .env
```

Edita `.env` con las credenciales y nombres de tus bases. La plantilla utiliza
las bases de reconstrucción:

- PostgreSQL y MongoDB: `aquasense_reconstruccion`.
- Neo4j: `aquasense-reconstruccion`.

El archivo `.env` contiene credenciales y no debe subirse al repositorio.

## Ejecución

Desde la carpeta `api`:

```powershell
npm run start:dev
```

Por defecto, la API escucha en:

```text
http://127.0.0.1:3000
```

En otra terminal, desde la carpeta `sincronizador`, inicia el proceso:

```powershell
npm run dev
```

El sincronizador aplica en MongoDB y Neo4j los eventos pendientes de
PostgreSQL. Las actualizaciones entre bases no son inmediatas.

## Rutas disponibles

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/salud/postgres` | Comprueba la conexión con PostgreSQL. |
| GET | `/salud/mongodb` | Comprueba la conexión con MongoDB. |
| GET | `/salud/neo4j` | Comprueba la conexión con Neo4j. |
| GET | `/espacios` | Lista los espacios del campus. |
| GET | `/componentes` | Lista los componentes de la red. |
| GET | `/componentes/:componenteId/espacios-afectados` | Consulta los espacios alcanzables desde un componente. |
| POST | `/componentes/tuberias` | Registra una tubería nueva sin conexiones. |
| GET | `/lecturas` | Lista las lecturas y el consumo entre ellas. |
| POST | `/lecturas` | Registra una lectura de un medidor. |
| GET | `/reportes` | Lista los reportes y su estado documental. |
| POST | `/reportes` | Registra un reporte. |
| GET | `/reportes/:reporteId/expediente` | Consulta el expediente documental de un reporte. |
| POST | `/reportes/:reporteId/atenciones` | Registra una atención. |
| POST | `/reportes/:reporteId/reemplazo` | Registra el reemplazo de una tubería. |
| POST | `/reportes/:reporteId/cerrar` | Cierra un reporte que cumple las condiciones. |

Las rutas con `:reporteId` o `:componenteId` requieren sustituir esa parte
por el identificador correspondiente.

## Ejemplos de solicitudes

Los ejemplos muestran el cuerpo JSON. Para las solicitudes `POST`, envía el
encabezado `Content-Type: application/json`.

### Crear un reporte

`POST /reportes`

```json
{
  "espacioId": "10000000-0000-0000-0000-000000000010",
  "descripcionInicial": "Se observó humedad cerca de los lavabos.",
  "referenciaUbicacion": "Baños de estudiantes de UD1"
}
```

La respuesta contiene el `reporteId` y el identificador del evento
documental. El expediente se crea cuando el sincronizador procesa el evento.

### Registrar una atención

`POST /reportes/:reporteId/atenciones`

Ejemplo de inspección:

```json
{
  "tipo": "INSPECCION",
  "fecha": "2026-11-24T11:31:48Z",
  "descripcion": "Se revisó el área reportada.",
  "hallazgos": "Se observó humedad cerca de los lavabos."
}
```

Ejemplo de verificación:

```json
{
  "tipo": "VERIFICACION",
  "fecha": "2026-11-24T12:00:00Z",
  "descripcion": "Se revisó el área después de la reparación.",
  "resultado": "SIN_INDICIOS"
}
```

También se acepta el tipo `REPARACION`, con una lista opcional de
`materiales`. La fecha debe incluir zona horaria.

### Registrar una lectura

`POST /lecturas`

```json
{
  "medidorId": "20000000-0000-0000-0000-000000000002",
  "fechaHora": "2026-11-24T11:56:33Z",
  "valorAcumulado": "120.000"
}
```

`valorAcumulado` se envía como texto numérico, con hasta tres decimales.
La lectura debe cumplir las reglas del medidor, incluida la fecha y el
valor de su última lectura. Los valores del ejemplo deben adaptarse al
estado actual de la base.

### Registrar una tubería para reemplazo

`POST /componentes/tuberias`

```json
{
  "codigo": "TUB-15",
  "nombre": "Tubería de reemplazo",
  "espacioId": "10000000-0000-0000-0000-000000000010",
  "descripcion": "Tubería preparada para una reparación."
}
```

La respuesta incluye el `componenteId` generado. La tubería queda activa,
pero sin conexiones. Se registra en PostgreSQL; el evento de reemplazo
permitirá incorporarla a Neo4j cuando se instale.

### Reemplazar una tubería

`POST /reportes/:reporteId/reemplazo`

```json
{
  "tuberiaAnteriorId": "ID-DE-LA-TUBERIA-ANTERIOR",
  "tuberiaNuevaId": "ID-DE-LA-TUBERIA-NUEVA",
  "fecha": "2026-11-24T12:00:00Z",
  "descripcion": "Se reemplazó la tubería dañada.",
  "materiales": ["Tubería PVC", "Conexiones de PVC"]
}
```

Ambos identificadores deben ser UUID reales. La tubería nueva debe existir,
estar activa y no tener conexiones. La operación registra la reparación y
genera un evento documental y otro para actualizar el grafo.

La respuesta indica el estado inicial `PENDIENTE` de ambos eventos. El
sincronizador debe procesarlos para completar la actualización en MongoDB
y Neo4j.

### Cerrar un reporte

`POST /reportes/:reporteId/cerrar`

No requiere cuerpo JSON. PostgreSQL valida las condiciones de cierre,
incluida una verificación con resultado `SIN_INDICIOS` y la confirmación
del último evento documental.

## Consulta del expediente

`GET /reportes/:reporteId/expediente`

Cuando el evento documental está `PENDIENTE` o en `ERROR`, la respuesta
incluye ese estado y `expediente: null`. Cuando está `PROCESADO`, la API
comprueba que el expediente en MongoDB coincida con el evento confirmado
antes de devolverlo.

## Pruebas

Desde la carpeta `api`:

```powershell
npm test
npm run build
```

Las pruebas unitarias no sustituyen la comprobación completa del sistema
con PostgreSQL, MongoDB, Neo4j y el sincronizador.

## Estado de la integración

La API se ha probado localmente con las bases de reconstrucción. El
frontend y la comprobación final del flujo completo están pendientes.