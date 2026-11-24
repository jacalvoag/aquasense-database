# Sincronizador AquaSense

Programa que consulta los eventos pendientes de PostgreSQL y aplica los cambios
documentales en MongoDB o los cambios de red en Neo4j.

## Requisitos

- Node.js y npm. La prueba local se realizó con Node.js 26.13.0.
- PostgreSQL, MongoDB y Neo4j en ejecución.
- Bases de datos preparadas con los scripts de este repositorio.

## Configuración

Desde la carpeta `sincronizador`, instala las dependencias:

```powershell
npm ci
```

Copia la plantilla de configuración:

```powershell
Copy-Item .env.example .env
```

Edita `.env` y coloca las credenciales y los nombres de las bases que vas a
utilizar. No compartas ni subas ese archivo.

La plantilla apunta a las bases de reconstrucción usadas en las pruebas:
`aquasense_reconstruccion` en PostgreSQL y MongoDB, y
`aquasense-reconstruccion` en Neo4j.

## Ejecución

Comprueba TypeScript:

```powershell
npm run check
```

Inicia el sincronizador:

```powershell
npm run dev
```

El programa revisa los eventos aproximadamente cada cinco segundos. Para
detenerlo, presiona `Ctrl+C`.

## Operaciones implementadas

- Crear expedientes y agregar atenciones en MongoDB.
- Crear, actualizar y eliminar conexiones en Neo4j.
- Aplicar reemplazos de tuberías en Neo4j.

Los eventos se confirman en PostgreSQL después de verificar su aplicación.
Ante un fallo de procesamiento, se registra el intento en PostgreSQL; después
de tres fallos, el evento pasa a `ERROR` y requiere reactivación.

## Alcance actual

Ejecuta **una sola instancia** del sincronizador. Aún no hay coordinación entre
varios procesos para impedir que intenten procesar el mismo evento.

El sincronizador se ha probado localmente con las bases de reconstrucción.
Las pruebas realizadas no cubren todas las posibles fallas o configuraciones.