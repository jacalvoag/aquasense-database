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

## Pruebas

Para ejecutar las pruebas unitarias:

```powershell
npm test
```

Para probar la consulta de eventos contra PostgreSQL:

```powershell
npm run test:integracion
```

La prueba de integración requiere la base `aquasense_reconstruccion`, sin
eventos pendientes disponibles y con el sincronizador detenido. Sus eventos
de prueba se crean dentro de una transacción que termina en `ROLLBACK`.

## Operaciones implementadas

- Crear expedientes y agregar atenciones en MongoDB.
- Crear, actualizar y eliminar conexiones en Neo4j.
- Aplicar reemplazos de tuberías en Neo4j.

Los eventos se confirman en PostgreSQL después de verificar su aplicación.
Ante un fallo de procesamiento, se registra el intento en PostgreSQL; después
de tres fallos, el evento pasa a `ERROR` y requiere reactivación.

## Alcance actual

El sincronizador usa un bloqueo de sesión en PostgreSQL para evitar que dos
instancias procesen eventos durante el mismo ciclo. Se recomienda ejecutar
una sola instancia: el bloqueo se libera si se pierde la sesión de PostgreSQL
y todavía no cubre por completo una interrupción durante una operación en
otra base.

El sincronizador se ha probado localmente con las bases de reconstrucción.
Las pruebas realizadas no cubren todas las posibles fallas o configuraciones.