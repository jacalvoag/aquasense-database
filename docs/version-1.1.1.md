# AquaSense 1.1.1 — arranque del frontend en PowerShell

Corrige el envío de opciones de Vite desde el lanzador de Windows. Las opciones
de host, puerto y puerto estricto se definen ahora en el script npm
`dev:local`; PowerShell solo ejecuta `npm run dev:local`.

Añade una prueba real en Windows PowerShell que inicia Vite desde una carpeta
con espacios, comprueba su respuesta HTTP en 127.0.0.1:5173 y verifica que una
segunda instancia sea rechazada por tener el puerto ocupado.

## Actualizar

Desde la raíz del repositorio:

```powershell
git switch main
git pull --ff-only
```

Si ya aplicaste las migraciones 35 y 36 de la versión 1.1.0, no necesitas
repetirlas para esta corrección. No hay cambios de estructura ni de datos.

Puedes mantener la API y el sincronizador encendidos y arrancar solo el
frontend desde su carpeta:

```powershell
npm run dev:local
```

Para usar el lanzador completo en el siguiente arranque, cierra las tres
aplicaciones y ejecuta `.\iniciar.ps1` desde la raíz.
