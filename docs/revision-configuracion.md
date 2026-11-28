# Revisión de configuración y datos fijos

Se revisaron API, interfaz, sincronizador, lanzador y Compose. No se encontraron
UUID de ejemplo ni códigos de componentes específicos en la lógica operativa.
Las consultas y formularios usan datos de las bases. Los valores esperados y
UUID de las pruebas permanecen en archivos de pruebas y carga de demostración.

Correcciones aplicadas:

- Docker usa /api en el mismo origen, evitando compilar localhost y su puerto
  como dirección obligatoria del navegador. Nginx dirige esa ruta a la API.
- FRONTEND_PORT permite configurar el lanzador nativo y Vite; el valor por
  defecto 5173 ya no es una restricción obligatoria de la validación.
- VITE_ESCENARIO y VITE_INSTITUCION permiten personalizar los rótulos visuales.
- La prueba Docker crea su propia cisterna en lugar de usar un UUID de la carga.
- Compose admite nombres de bases PostgreSQL y MongoDB configurables.
- La validación Docker usa puertos, credenciales y bases alternativos y comprueba
  también el proxy /api y la persistencia tras recrear los contenedores.

Se conservan como contratos del modelo el esquema SQL aquasense, sus tipos y
el registro de control principal. No son registros de ejemplo. También se
conservan valores locales predeterminados, sobrescribibles mediante variables.
Las credenciales de demostración no sirven como configuración de producción.
Solo están rastreados archivos .env de ejemplo; los archivos locales se ignoran.
Esta revisión no equivale a una auditoría exhaustiva de seguridad.
