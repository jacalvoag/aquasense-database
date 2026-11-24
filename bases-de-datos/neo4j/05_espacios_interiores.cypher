UNWIND [
  {interior: '010', edificio: '001'},
  {interior: '011', edificio: '002'}
] AS relacion

MATCH (interior:Espacio {
  espacioId: '10000000-0000-0000-0000-000000000' + relacion.interior
})
MATCH (edificio:Espacio {
  espacioId: '10000000-0000-0000-0000-000000000' + relacion.edificio
})

MERGE (interior)-[:ESTA_DENTRO_DE]->(edificio)

RETURN count(*) AS relaciones_procesadas;