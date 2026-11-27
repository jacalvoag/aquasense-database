# Ejecutar AquaSense localmente

El escenario académico representa la red de agua de un campus. Las lecturas se capturan manualmente. El navegador usa la API NestJS para consultar catálogos, lecturas, reportes y el esquema de la red. El operador puede registrar lecturas y completar un reporte de mantenimiento con reemplazo de tubería.

## Preparar los servicios

1. Instala Node.js y npm. Para reproducir la ejecución validada usa Node 26.13.0 y npm 12.2.3. Necesitas PostgreSQL 16, MongoDB 8.0 y Neo4j Community 5.26 en instancias locales o contenedores con almacenamiento persistente. Usa el cliente de cada motor para ejecutar los scripts.
2. Crea bases nuevas y sigue la [preparación de la carga base](preparacion-bases.md#postgresql-estructura-y-carga-base). En PostgreSQL ejecuta los scripts 01–28 y 32–36, en ese orden. En MongoDB ejecuta los scripts de colección e índice y usa `aquasense` en la configuración de la aplicación si conservaste el nombre de los scripts. Aplica las restricciones y la carga de Neo4j, compara los identificadores y vínculos con PostgreSQL y confirma la versión inicial con el script 08.
3. Copia los archivos de ejemplo desde la raíz. Si ya tienes un archivo `.env` para un servicio, edita sus valores directamente.

   ```powershell
   Copy-Item api/.env.example api/.env
   Copy-Item sincronizador/.env.example sincronizador/.env
   ```

4. Configura las mismas bases y credenciales de conexión en ambos archivos. Para una instalación de Neo4j Community con la configuración estándar, usa `NEO4J_DATABASE=neo4j`. En la API define una clave propia para `API_OPERATOR_PASSWORD`, conserva los orígenes de Vite en `CORS_ORIGINS` y deja `PORT=3000` si está libre. Mantén las credenciales en tu equipo.

Si actualizas una instalación existente, aplica solo las migraciones indicadas
en [red-dinamica.md](red-dinamica.md); conserva sus datos y configuración.

## Arrancar la aplicación

En Windows, desde la raíz, puedes ejecutar:

```powershell
.\iniciar.ps1 -Instalar
```

En los siguientes arranques usa `.\iniciar.ps1`. El script comprueba que API
y sincronizador apunten a las mismas bases y verifica las conexiones con ambos
conjuntos de credenciales antes de abrir tres terminales. Espera a la API y abre
el navegador. Las bases deben estar preparadas y encendidas; no carga ni borra
datos. Rechaza puertos ocupados para evitar sesiones duplicadas.

Opciones:

- `-Instalar`: ejecuta `npm ci` en las tres carpetas antes de arrancar.
- `-SoloComprobar`: valida archivos, destinos, CORS y dependencias; no contacta
  motores ni abre aplicaciones. Se puede combinar con `-Instalar`.
- `-NoAbrirNavegador`: inicia las aplicaciones sin abrir una pestaña.

El script admite rutas con espacios y PowerShell 5.1. Detén las aplicaciones con
Ctrl+C en sus respectivas terminales. Si algo falla, conserva la terminal que
muestra el error y sigue la [guía de diagnóstico](solucion-problemas.md).

## Arranque manual

Abre tres terminales. Desde `api/`, `sincronizador/` y `frontend/`, respectivamente, ejecuta estos comandos.

| Terminal | Instalar dependencias | Arrancar |
| --- | --- | --- |
| API | `npm ci` | `npm run start:dev` |
| Sincronizador | `npm ci` | `npm run dev` |
| Interfaz | `npm ci` | `npm run dev` |

Abre `http://localhost:5173` y comprueba en la portada que los tres motores respondan. Si el puerto de la API cambia, configura `VITE_API_BASE_URL` en `frontend/.env.local`. Si cambia el origen de la interfaz, autorízalo en `CORS_ORIGINS` y reinicia la API.

## Demostración

Estos valores corresponden a una **carga base nueva**. Tu base utilizada puede tener otras versiones y cantidades. Para presentar o repetir el flujo consulta el [guion con sus condiciones](demostracion.md).

1. En **Red de agua**, comprueba versión 0, 25 nodos y 22 conexiones. Selecciona TUB-03 y consulta su alcance en el ramal de baños de UD1.
2. Abre **Acceso de operador** con la credencial configurada. Crea un reporte para ese espacio, espera que se genere el expediente y registra una inspección.
3. En **Componentes**, usa **Registrar componente** con tipo Tubería con un código libre. Queda sin conexiones hasta conectarla o usarla en un reemplazo. Sustituye TUB-03 y espera los dos eventos, documental y de grafo. Confirma que TUB-03 aparezca retirada y que la tubería instalada conserve el alcance en la red versión 1.
4. Registra la verificación **Sin indicios**, espera la confirmación documental y cierra el reporte. Consulta las tres atenciones en el expediente.
5. Captura una lectura acumulada de MED-01 posterior a su última lectura y dentro de la fecha actual. Por ejemplo, si el último acumulado es 118.000 m³, al capturar 120.500 m³ el consumo del intervalo debe ser 2.500 m³.

Usa una base separada para repetir el reemplazo desde cero. Puedes conservar el estado de la demostración deteniendo los servicios y manteniendo el almacenamiento de las bases.

## Comprobaciones de desarrollo

- API, desde `api/`: `npm test`, `npm run test:e2e`, `npm run lint` y `npm run build`. Las pruebas HTTP usan drivers simulados.
- Sincronizador, desde `sincronizador/`: `npm run check` y `npm test`. Para `npm run test:integracion`, usa PostgreSQL aislado y detén el procesador continuo, como indica el [README del sincronizador](../sincronizador/README.md).
- Frontend, desde `frontend/`: `npm run lint` y `npm run build`.
- Consulta los [resultados integral y de rendimiento](validacion.md) para conocer las condiciones y el alcance de las pruebas.
- La [prueba reproducible del sistema y navegador](../pruebas/README.md) usa
  servicios aislados y conserva sus resultados. La
  [comparación de estructura](../herramientas/README.md) exporta ambas bases
  PostgreSQL en modo de solo lectura.

- Lanzador, desde la raíz: `node --test scripts/configuracion.test.mjs`.
