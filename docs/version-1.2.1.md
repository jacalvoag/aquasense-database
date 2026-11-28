# AquaSense 1.2.1 — configuración y documentación

Actualiza el README y elimina dependencias innecesarias del escenario inicial.
Docker usa /api en el mismo origen; los nombres de bases, puertos y credenciales
pueden configurarse. El lanzador y Vite admiten FRONTEND_PORT. Los rótulos del
escenario se personalizan con VITE_ESCENARIO y VITE_INSTITUCION.

La prueba Docker crea su propia fuente de agua y se ejecuta con configuración
alternativa. Se mantienen los datos explícitos de pruebas y los contratos del
modelo. Consulta docs/revision-configuracion.md para el alcance de la revisión.

No requiere nuevas migraciones SQL. Para Docker, actualiza el código y ejecuta
`docker compose up --build -d --wait --wait-timeout 300`; conserva los volúmenes.
