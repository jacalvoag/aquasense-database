# Replicar AquaSense con Docker

Requisitos: Git y Docker con Compose v2. En Windows instala Docker Desktop y
activa los contenedores Linux. Reserva aproximadamente 6 GB de memoria para
Docker. La primera ejecución necesita Internet para descargar imágenes y paquetes.

```powershell
git clone https://github.com/jacalvoag/aquasense-database.git
cd aquasense-database
docker compose up --build -d --wait --wait-timeout 300
```

Abre **http://localhost:5173**. API: http://127.0.0.1:3000.
Acceso de operador de la demostración: **operador** / **aquasense-operador-local**.
No necesitas Node, PostgreSQL, MongoDB o Neo4j instalados en tu equipo.

## Qué inicia

Compose inicia PostgreSQL, MongoDB, Neo4j, la inicialización, la API, el
sincronizador y el frontend estático con Nginx. Incluye las migraciones 35/36.
La carga inicial contiene 14 espacios, 20 componentes, 22 conexiones y 7
lecturas; comienza sin reportes y con versión de red 0. Puedes registrar nuevos
datos siguiendo [red-dinamica.md](red-dinamica.md).

La inicialización comprueba que componentes y conexiones coincidan entre
PostgreSQL y Neo4j antes de confirmar el grafo. Una marca en un volumen indica
que terminó. Después conserva los datos y verifica los controles de arranque.
Si una primera carga se interrumpe parcialmente, no sobrescribe los datos:
consulta sus logs antes de reiniciar el entorno vacío.

Este Compose usa sus propios volúmenes; no importa ni modifica tus bases
locales aquasense/aquasense_reconstruccion. Los motores no publican puertos al
host. Solo frontend y API se publican en loopback. Es una demostración local,
con credenciales predeterminadas y MongoDB en la red interna de Compose.
No es una configuración para publicarla directamente en Internet.

## Uso cotidiano

```powershell
docker compose ps
docker compose logs --tail=80 inicializar api sincronizador
docker compose down
docker compose up -d --wait --wait-timeout 300
```

`down` conserva los volúmenes. Evita `down -v` si necesitas tus registros.
Para empezar completamente de cero **eliminando los datos de este Compose**:

```powershell
docker compose down -v
docker compose up --build -d --wait --wait-timeout 300
```

No elimines volúmenes de motores individuales: la marca de inicialización y
las tres bases deben conservarse o reiniciarse juntas.

## Cambiar puertos o credenciales

Los valores predeterminados permiten arrancar sin archivos adicionales. Si los
puertos están ocupados por tu ejecución local, detén esas aplicaciones o usa
un archivo `.env` en la raíz (ignorado por Git):

```dotenv
API_PORT=3002
FRONTEND_PORT=5174
API_OPERATOR_USER=operador
API_OPERATOR_PASSWORD=una-clave-local-propia
```

Ejecuta de nuevo `docker compose up --build -d --wait --wait-timeout 300` y
abre http://localhost:5174. Por defecto, el navegador usa `/api` en su mismo origen y Nginx lo dirige al
servicio interno. No necesitas repetir el puerto de API ni configurar CORS
para esa ruta. Si defines VITE_API_BASE_URL con una API externa, su valor se
fija al construir la imagen y debes autorizar el origen en CORS_ORIGINS.
También puedes definir POSTGRES_PASSWORD y NEO4J_PASSWORD **antes del primer
arranque**. Cambiar esas variables no cambia las claves guardadas en volúmenes
ya inicializados. Conserva los valores empleados o administra las claves con
los clientes de los motores.

Si falla un servicio, revisa `docker compose logs nombre-del-servicio`.
La inicialización parcial requiere revisar el error y, si el entorno aún no
contiene trabajo que conservar, reiniciar sus cuatro volúmenes juntos.
Las actualizaciones futuras de estructuras existentes deben aplicar sus
migraciones; el inicializador no vuelve a sembrar ni migra datos automáticamente.

La prueba automatizada construye las imágenes, registra un ramal y un reporte,
verifica MongoDB y Neo4j mediante la API, recrea los contenedores y comprueba
que los registros sigan disponibles.

Puedes definir POSTGRES_DB y MONGODB_DATABASE antes del primer arranque.
El esquema SQL aquasense y la base neo4j de Community pertenecen al modelo
instalado. VITE_ESCENARIO y VITE_INSTITUCION personalizan los rótulos al construir.
