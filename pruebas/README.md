# Prueba integrada reproducible

Esta prueba usa PostgreSQL, MongoDB y Neo4j reales, la API compilada y el
sincronizador. Verifica el flujo completo y la recuperación después de aplicar
un cambio en una base de destino y fallar su confirmación en PostgreSQL.

## Preparar un entorno aislado

Requisitos: Node.js, npm y Docker con Compose. Desde la raíz del repositorio:

```powershell
docker compose -f pruebas/compose.yaml up -d --wait
cd api
npm ci
npm run build
cd ../sincronizador
npm ci
Copy-Item .env.pruebas.example .env.pruebas
npm run test:sistema
```

La configuración usa puertos diferentes de las instalaciones locales habituales:
PostgreSQL 55432, MongoDB 57017, Neo4j Bolt 57687 y API 3001. Las credenciales de
ejemplo pertenecen únicamente a estos servicios de prueba ligados a loopback.
No cambies el archivo `.env` de la ejecución normal. No inicies otro sincronizador
con `.env.pruebas` durante la prueba.

Antes de crear datos, la prueba exige `AQUASENSE_PRUEBAS=1`, los nombres y puertos
aislados y que el esquema PostgreSQL, la base MongoDB y el grafo estén vacíos.
Rechaza el arranque si encuentra datos. No vacía bases ni elimina registros
existentes. El entorno se conserva al finalizar para inspeccionarlo.

## Qué comprueba

- Instala los scripts de estructura y carga y compara componentes y conexiones
  entre PostgreSQL y Neo4j antes de confirmar la versión inicial.
- Comprueba salud de los tres motores, snapshot de 25 nodos y 22 conexiones,
  autorización, entradas inválidas y cierre prematuro.
- Crea un reporte y su expediente. Registra una inspección, interrumpe la
  confirmación después de aplicarla en MongoDB y reintenta sin duplicarla.
- Registra una tubería candidata, rechaza su alcance antes de instalarla y
  ejecuta el reemplazo. Interrumpe la confirmación después de aplicarlo en
  Neo4j; recupera un único nodo, historial y conexiones, conservando el alcance.
- Registra la verificación, cierra el reporte y rechaza otra atención.
- Captura una lectura y verifica el consumo. Comprueba que no quedan eventos
  sin confirmar y que otro ciclo no crea expedientes duplicados.

La interrupción se produce mediante un trigger temporal en la base de pruebas
que rechaza la confirmación del evento. No se añaden fallos simulados al código
productivo. `--una-vez` ejecuta un ciclo del sincronizador y devuelve código 1 si
falla; el modo continuo de `npm run dev` conserva su comportamiento.

## Resultados y repetición

Se generan `sistema.json`, `identificadores.json`, `estructura-reconstruida.json`
y logs en `pruebas/resultados/`, carpeta excluida de Git. `sistema.json` solo indica
`finalizado: true` si todas las comprobaciones terminaron correctamente.

Para examinar el estado final con la interfaz, configura una ejecución separada
de la API con los valores de `.env.pruebas` y usa en `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:3001
```

Inicia el frontend con `npm run dev`. Selecciona la tubería `TUB-PRUEBA-INTEGRAL`:
debe mostrarse instalada en la red versión 1 y alcanzar los baños de UD1. El
reporte de prueba queda cerrado con tres atenciones. No necesita nuevos eventos
para consultar ese estado.

Para repetir desde cero, desde la raíz, elimina **solo los volúmenes de este
proyecto de pruebas** y vuelve a arrancarlo:

```powershell
docker compose -f pruebas/compose.yaml down -v
docker compose -f pruebas/compose.yaml up -d --wait
cd sincronizador
npm run test:sistema
```

## Comprobar la interfaz con servicios reales

Después de `test:sistema`, desde la raíz, inicia la API de pruebas en otra
terminal con la configuración aislada:

```powershell
cd api
node --env-file=../sincronizador/.env.pruebas dist/main.js
```

Desde otra terminal, en la raíz:

```powershell
cd frontend
npm ci
npx playwright install chromium
npm run test:visual
```

Detén cualquier frontend que esté ocupando el puerto 5173: la prueba inicia y
cierra su propio Vite, apuntando a la API de pruebas en 3001. El caso de red no intercepta
solicitudes ni sustituye respuestas. Comprueba la tubería realmente instalada,
su alcance, el zoom, la selección con teclado y la lista móvil sin desbordamiento.
Genera capturas y un reporte JSON en `pruebas/resultados/`.

La comparación con la estructura PostgreSQL original se realiza aparte con
las [herramientas de exportación de solo lectura](../herramientas/README.md).

## Comprobaciones de presentación

El mismo comando `npm run test:visual` añade tres casos:

- Compara los contadores de Inicio con las respuestas reales de la API y revisa
  la lectura reciente y el ancho móvil.
- Sustituye **solo en un caso** la respuesta del catálogo de componentes por
  un 503 para comprobar que se informa la indisponibilidad y no se muestra cero.
- Comprueba la explicación de la tubería candidata y la habilitación del
  formulario al introducir una credencial en memoria. No envía la operación
  ni afirma verificar esa credencial; la autorización del POST se prueba aparte.

GitHub Actions ejecuta el sistema con los motores definidos en Compose, conserva
`pruebas/resultados/` como artefacto durante 30 días y elimina únicamente sus
volúmenes de prueba al finalizar. El job de Windows comprueba sintaxis y
configuración del lanzador sin abrir terminales ni conectar motores.
