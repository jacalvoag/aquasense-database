# AquaSense Frontend

La interfaz local usa React, TypeScript y Vite. Sigue la [guía de ejecución local](../docs/ejecucion-local.md) para arrancar la API, el sincronizador y las bases.

```powershell
npm ci
npm run dev
```

Abre la URL que muestra Vite. Por defecto se usa `http://localhost:5173` y se consulta la API en `http://127.0.0.1:3000`. Si la URL cambia, copia `.env.example` a `.env.local` y ajusta `VITE_API_BASE_URL`. Esa variable es pública.

La portada comprueba la conexión de la API a las tres bases. Los listados se consultan desde los enlaces de navegación. Para guardar reportes, atenciones, reemplazos, tuberías o lecturas, usa «Acceso de operador». La credencial se conserva en memoria y la API la verifica cuando se envía un POST.

El detalle del reporte muestra por separado el estado del reporte, del expediente y de la red. Tras un reemplazo, el cierre se habilita cuando los dos eventos estén procesados y la última verificación documental indique «Sin indicios».

«Red de agua» consulta el esquema instalado mediante `GET /red`. El diagrama usa React Flow y Dagre. Seleccionar un componente consulta su alcance aguas abajo en la API. La vista de lista permite consultar los mismos nodos y el panel de detalle.

El esquema representa cisternas, tuberías, medidores, uniones, válvulas y espacios mediante figuras SVG. Los sistemas sin conexión entre sí se separan automáticamente y toman el nombre de su componente de origen. Las figuras son simbólicas: no indican niveles de agua ni mediciones en tiempo real. Los códigos, estados, conexiones y recorridos proceden de la API.

Para revisar la vista:

- Selecciona una figura con el ratón o con Tab y Enter. Comprueba el panel de detalle y el recorrido aguas abajo en turquesa.
- Usa los controles de zoom, el ajuste a la vista y «Limpiar selección».
- Cambia entre diagrama y lista. En pantallas pequeñas se abre inicialmente la lista, con las mismas figuras y datos.
- Actualiza la red después de un reemplazo confirmado. Si la API informa de cambios pendientes o indisponibilidad, se muestra el error y se permite reintentar.

Verifica con `npm run lint` y `npm run build`.

La prueba de navegador `npm run test:visual` consulta servicios reales. Requiere
el estado final de `test:sistema`, la API en el puerto 3001 y Chromium instalado
mediante `npx playwright install chromium`. Consulta los comandos completos en
[pruebas/README.md](../pruebas/README.md). El resultado y las capturas quedan en
`pruebas/resultados/`, fuera del control de versiones.
