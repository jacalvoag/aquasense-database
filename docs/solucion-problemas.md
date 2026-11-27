# Solución de problemas

Ejecuta los comandos desde la raíz del repositorio, salvo que se indique otra
carpeta. Revisa la terminal de la aplicación que falló. No compartas archivos
`.env`, contraseñas ni encabezados Authorization.

## No hay comunicación con la API

```powershell
Test-NetConnection 127.0.0.1 -Port 3000
Invoke-RestMethod http://127.0.0.1:3000/salud/postgres
Invoke-RestMethod http://127.0.0.1:3000/salud/mongodb
Invoke-RestMethod http://127.0.0.1:3000/salud/neo4j
```

Usa el puerto real de `api/.env` si cambiaste `PORT`. Si el puerto no responde,
inicia `npm run start:dev` desde `api/`. Compilar sin errores no garantiza
que Nest haya terminado de iniciar: revisa el mensaje final de la terminal.

Si falta `API_OPERATOR_USER` o `API_OPERATOR_PASSWORD`, configúralos en
`api/.env` a partir de `api/.env.example` y reinicia la API.
No sobrescribas un archivo de configuración que ya contenga tus conexiones.

## Un motor devuelve 503

Comprueba el puerto configurado. Estos son los puertos locales habituales,
no los de Compose de pruebas:

```powershell
Test-NetConnection 127.0.0.1 -Port 5432
Test-NetConnection 127.0.0.1 -Port 27017
Test-NetConnection 127.0.0.1 -Port 7687
```

En Neo4j Desktop inicia la instancia que contiene el grafo; tener abierto el
programa no implica que esté ejecutándose la base. Comprueba URI, nombre de
base y usuario de `api/.env`. Community normalmente usa la base `neo4j`.
En PostgreSQL y MongoDB inicia sus servicios o contenedores según cómo los
instalaste. Un puerto abierto solo confirma TCP: vuelve a consultar la ruta de
salud para comprobar el acceso del driver.

## El navegador falla pero las rutas de salud responden en PowerShell

Comprueba `VITE_API_BASE_URL` en `frontend/.env.local` y reinicia Vite.
Para la ejecución normal, el ejemplo es `http://127.0.0.1:3000`; las pruebas
aisladas usan 3001. Configura el origen exacto de la interfaz en
`CORS_ORIGINS` de la API, por ejemplo `http://localhost:5173`. Autorizar
localhost no autoriza automáticamente 127.0.0.1 ni un puerto diferente.
El lanzador usa 5173 de forma estricta y pasa la URL pública de la API a Vite.

## Se requiere acceso de operador o una operación devuelve 401

Abre **Acceso de operador** e introduce el usuario y la clave de `api/.env`.
Se conservan solo en memoria: al recargar el navegador debes introducirlos otra
vez. Continuar habilita los formularios; la API comprueba la credencial al
enviarlos. Si es incorrecta, corrígela antes de repetir la operación.

## La tubería registrada no aparece en el diagrama

Un componente nuevo se guarda activo **sin conexiones**. En **Conexiones**,
crea su entrada y salida según los tipos permitidos. Una tubería también puede
instalarse mediante **Reemplazar tubería** en un reporte. El catálogo distingue
el estado ACTIVO de tener conexiones. Consulta [red-dinamica.md](red-dinamica.md).

## El expediente está pendiente o la red informa cambios pendientes

Inicia `npm run dev` desde `sincronizador/` y comprueba que apunte a las
mismas bases que la API. Espera al siguiente ciclo o a la fecha de reintento.
La API evita presentar como actual una proyección sin confirmar.

Si un evento llega a ERROR, revisa la causa en la terminal y sigue el proceso
de [fallos y recuperación](../sincronizador/README.md). No repitas una escritura
solo porque su confirmación tarda y no cambies el evento a PROCESADO a mano.

## Otro sincronizador tiene el bloqueo

Utiliza una sola sesión para ese conjunto de bases. La segunda espera su turno.
Cierra con Ctrl+C la sesión duplicada; no termines sesiones PostgreSQL ajenas.
El bloqueo de sesión se libera al cerrar la conexión que lo mantiene.

## No se puede cerrar un reporte

Espera ambas confirmaciones si hubo reemplazo. La última atención debe ser
VERIFICACION / SIN_INDICIOS y estar confirmada documentalmente. Un reporte
con otra verificación necesita completar la atención conforme a las reglas.
No modifiques su estado directamente para saltar esas comprobaciones.

## Lectura rechazada

El componente debe ser un medidor activo. La fecha debe ser posterior a su
última lectura, no futura e incluir una zona horaria válida en la petición.
El acumulado no puede disminuir. La primera lectura no tiene consumo previo:
ese campo es null, no cero.

## Lanzador de Windows

`.\iniciar.ps1 -SoloComprobar` valida configuración y dependencias. Para
comprobar también las conexiones sin iniciar las aplicaciones:

```powershell
node scripts/comprobar-servicios.mjs
```

Si faltan dependencias, usa `.\iniciar.ps1 -Instalar`. Si un puerto está
ocupado, utiliza las terminales ya abiertas o detén tus sesiones antes de
arrancar otra vez. El lanzador no mata procesos ni instala motores.

Si la política local impide ejecutar el script y tu equipo permite este uso,
puedes ejecutarlo en una sesión limitada al proceso:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\iniciar.ps1
```

Esto no cambia la política permanente del equipo. Si el equipo está administrado,
respeta la política de la institución y usa el arranque manual.

## La prueba de sistema rechaza bases con datos

La prueba exige bases aisladas vacías. Sigue [pruebas/README.md](../pruebas/README.md).
No cambies nombres o puertos para apuntarla a `aquasense` o a la reconstrucción
que conserva tu trabajo. Solo elimina volúmenes del Compose de pruebas cuando
quieras reiniciar ese entorno.

Si una operación informa que faltan las migraciones 35/36, detén API y
sincronizador y ejecuta el procedimiento de actualización de la guía.

## Vite muestra advertencias de npm sobre host o puerto

Si aparecen `Unknown cli config "--host"` y `CACError: Unused args: 5173`,
actualiza el repositorio y, desde `frontend/`, ejecuta:

```powershell
npm run dev:local
```

El script contiene las opciones de Vite y evita reenviarlas desde PowerShell.
Como solución inmediata también puedes ejecutar:

```powershell
node .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5173 --strictPort
```

Esto no requiere repetir la migración SQL. Si API y sincronizador ya funcionan,
puedes dejarlos encendidos y arrancar solo el frontend.
