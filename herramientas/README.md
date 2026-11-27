# Comparar la estructura PostgreSQL

La consulta `exportar-estructura.sql` es de solo lectura. Exporta tablas y sus
columnas, restricciones, índices, funciones, triggers, vistas, secuencias y
enumeraciones del esquema `aquasense`. No exporta filas, contraseñas ni propietarios.
Usa la misma versión mayor de PostgreSQL y un usuario que pueda consultar las
definiciones completas en ambas bases.

Desde la raíz del repositorio, en PowerShell, con las dependencias del
sincronizador instaladas. Reutiliza sus credenciales locales, pero selecciona
explícitamente cada base. Las consultas se ejecutan en una transacción de solo
lectura y no requieren tener `psql` en PATH:

```powershell
node --env-file=sincronizador/.env herramientas/exportar-estructura.mjs aquasense pruebas/resultados/estructura-original.json
node --env-file=sincronizador/.env herramientas/exportar-estructura.mjs aquasense_reconstruccion pruebas/resultados/estructura-reconstruccion.json
node herramientas/comparar-estructura.mjs pruebas/resultados/estructura-original.json pruebas/resultados/estructura-reconstruccion.json pruebas/resultados/comparacion-original.json
```

Si prefieres usar `psql`:

```powershell
New-Item -ItemType Directory -Force pruebas/resultados | Out-Null
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '5432'
$env:PGUSER = 'postgres'
# psql solicitará la contraseña si hace falta.
psql -X -A -t -v ON_ERROR_STOP=1 -d aquasense -f herramientas/exportar-estructura.sql -o pruebas/resultados/estructura-original.json
psql -X -A -t -v ON_ERROR_STOP=1 -d aquasense_reconstruccion -f herramientas/exportar-estructura.sql -o pruebas/resultados/estructura-reconstruccion.json
node herramientas/comparar-estructura.mjs pruebas/resultados/estructura-original.json pruebas/resultados/estructura-reconstruccion.json pruebas/resultados/comparacion-original.json
```

No continúes con una exportación si `psql` termina con error. `-o` evita que la
redirección de PowerShell cambie la codificación; el comparador también acepta
archivos UTF-16LE de PowerShell 5.1.

El comparador devuelve código 0 si coinciden, 1 si hay diferencias y 2 si el
archivo o formato es inválido. El JSON identifica objetos faltantes, adicionales
y modificados, junto con las definiciones que deben revisarse. Incluye hashes de
los dos archivos usados. Las diferencias textuales en funciones se informan sin
intentar deducir equivalencia de código.

Pruebas del comparador, sin conectarse a bases:

```powershell
node --test herramientas/comparar-estructura.test.mjs
```

Comparar dos reconstrucciones nuevas sirve para comprobar la reproducibilidad
de los scripts. Ese resultado no demuestra coincidencia con la base original.
