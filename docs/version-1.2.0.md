# AquaSense 1.2.0 — entorno completo con Docker

Incluye Compose para PostgreSQL, MongoDB, Neo4j, la inicialización, la API,
el sincronizador y el frontend Nginx. La carga inicial se verifica antes de
habilitar la aplicación. Los volúmenes conservan los registros al recrear
los contenedores.

```powershell
docker compose up --build -d --wait --wait-timeout 300
```

Abre http://localhost:5173. Operador local: `operador` /
`aquasense-operador-local`. Requiere Docker con Compose v2; no requiere instalar
Node ni los motores en el host. Consulta [la guía](https://github.com/jacalvoag/aquasense-database/blob/main/docs/docker.md).

El entorno Docker es independiente de las bases instaladas en el equipo.
No importa datos locales existentes. Las instalaciones nativas siguen usando
el procedimiento anterior. Este entorno es para reproducción y demostración
local, con puertos ligados a loopback y credenciales predeterminadas.
