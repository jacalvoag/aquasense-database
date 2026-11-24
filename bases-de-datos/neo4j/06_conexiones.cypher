UNWIND [
  // Sistema UD1.
  {id: '001', origen: '001', destino: '004', esEspacio: false},
  {id: '002', origen: '004', destino: '002', esEspacio: false},
  {id: '003', origen: '002', destino: '005', esEspacio: false},
  {id: '004', origen: '005', destino: '003', esEspacio: false},
  {id: '005', origen: '003', destino: '006', esEspacio: false},
  {id: '006', origen: '006', destino: '010', esEspacio: true},
  {id: '007', origen: '003', destino: '007', esEspacio: false},
  {id: '008', origen: '007', destino: '012', esEspacio: true},

  // Sistema UD2.
  {id: '009', origen: '008', destino: '011', esEspacio: false},
  {id: '010', origen: '011', destino: '009', esEspacio: false},
  {id: '011', origen: '009', destino: '012', esEspacio: false},
  {id: '012', origen: '012', destino: '010', esEspacio: false},
  {id: '013', origen: '010', destino: '013', esEspacio: false},
  {id: '014', origen: '013', destino: '011', esEspacio: true},
  {id: '015', origen: '010', destino: '014', esEspacio: false},
  {id: '016', origen: '014', destino: '013', esEspacio: true},

  // Sistema de riego cercano a biblioteca.
  {id: '017', origen: '015', destino: '018', esEspacio: false},
  {id: '018', origen: '018', destino: '016', esEspacio: false},
  {id: '019', origen: '016', destino: '019', esEspacio: false},
  {id: '020', origen: '019', destino: '017', esEspacio: false},
  {id: '021', origen: '017', destino: '020', esEspacio: false},
  {id: '022', origen: '020', destino: '014', esEspacio: true}
] AS conexion

MATCH (origen:Componente {
  componenteId: '20000000-0000-0000-0000-000000000' + conexion.origen
})

MATCH (destino)
WHERE
  (
    conexion.esEspacio = false
    AND destino:Componente
    AND destino.componenteId =
      '20000000-0000-0000-0000-000000000' + conexion.destino
  )
  OR
  (
    conexion.esEspacio = true
    AND destino:Espacio
    AND destino.espacioId =
      '10000000-0000-0000-0000-000000000' + conexion.destino
  )

MERGE (origen)-[relacion:CONECTA_CON {
  conexionId: '30000000-0000-0000-0000-000000000' + conexion.id
}]->(destino)

RETURN count(relacion) AS conexiones_procesadas;