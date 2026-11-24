UNWIND [
  {componente: '001', espacio: '001'},
  {componente: '002', espacio: '001'},
  {componente: '003', espacio: '001'},
  {componente: '004', espacio: '001'},
  {componente: '005', espacio: '001'},
  {componente: '006', espacio: '010'},
  {componente: '007', espacio: '012'},

  {componente: '008', espacio: '002'},
  {componente: '009', espacio: '002'},
  {componente: '010', espacio: '002'},
  {componente: '011', espacio: '002'},
  {componente: '012', espacio: '002'},
  {componente: '013', espacio: '011'},
  {componente: '014', espacio: '013'},

  {componente: '015', espacio: '007'},
  {componente: '016', espacio: '007'},
  {componente: '017', espacio: '014'},
  {componente: '018', espacio: '007'},
  {componente: '019', espacio: '007'},
  {componente: '020', espacio: '014'}
] AS ubicacion

MATCH (componente:Componente {
  componenteId: '20000000-0000-0000-0000-000000000' + ubicacion.componente
})
MATCH (espacio:Espacio {
  espacioId: '10000000-0000-0000-0000-000000000' + ubicacion.espacio
})

MERGE (componente)-[:UBICADO_EN]->(espacio)

RETURN count(*) AS ubicaciones_procesadas;