// Identificador único de cada espacio.
CREATE CONSTRAINT espacio_id_unico IF NOT EXISTS
FOR (espacio:Espacio)
REQUIRE espacio.espacioId IS UNIQUE;

// Identificador único de cada componente.
CREATE CONSTRAINT componente_id_unico IF NOT EXISTS
FOR (componente:Componente)
REQUIRE componente.componenteId IS UNIQUE;

// Identificador único de cada conexión de agua.
CREATE CONSTRAINT conexion_id_unico IF NOT EXISTS
FOR ()-[conexion:CONECTA_CON]-()
REQUIRE conexion.conexionId IS UNIQUE;

// Identificador del control de versión de la red.
CREATE CONSTRAINT control_red_id_unico IF NOT EXISTS
FOR (control:ControlRed)
REQUIRE control.id IS UNIQUE;

// Identificador único de cada evento aplicado al grafo.
CREATE CONSTRAINT evento_aplicado_id_unico IF NOT EXISTS
FOR (evento:EventoAplicado)
REQUIRE evento.eventoId IS UNIQUE;