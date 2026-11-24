UNWIND [
  // Sistema supuesto de UD1.
  {id: '001', codigo: 'CIS-01', nombre: 'Cisterna del sistema UD1', tipo: 'CISTERNA'},
  {id: '002', codigo: 'MED-01', nombre: 'Medidor del sistema UD1', tipo: 'MEDIDOR'},
  {id: '003', codigo: 'UNI-01', nombre: 'Unión del sistema UD1', tipo: 'UNION'},
  {id: '004', codigo: 'TUB-01', nombre: 'Tubería de cisterna a medidor UD1', tipo: 'TUBERIA'},
  {id: '005', codigo: 'TUB-02', nombre: 'Tubería de medidor a unión UD1', tipo: 'TUBERIA'},
  {id: '006', codigo: 'TUB-03', nombre: 'Tubería hacia baños de UD1', tipo: 'TUBERIA'},
  {id: '007', codigo: 'TUB-04', nombre: 'Tubería hacia zona de riego UD1', tipo: 'TUBERIA'},

  // Sistema supuesto de UD2.
  {id: '008', codigo: 'CIS-02', nombre: 'Cisterna del sistema UD2', tipo: 'CISTERNA'},
  {id: '009', codigo: 'MED-02', nombre: 'Medidor del sistema UD2', tipo: 'MEDIDOR'},
  {id: '010', codigo: 'UNI-02', nombre: 'Unión del sistema UD2', tipo: 'UNION'},
  {id: '011', codigo: 'TUB-05', nombre: 'Tubería de cisterna a medidor UD2', tipo: 'TUBERIA'},
  {id: '012', codigo: 'TUB-06', nombre: 'Tubería de medidor a unión UD2', tipo: 'TUBERIA'},
  {id: '013', codigo: 'TUB-07', nombre: 'Tubería hacia baños de UD2', tipo: 'TUBERIA'},
  {id: '014', codigo: 'TUB-08', nombre: 'Tubería hacia zona de riego UD2', tipo: 'TUBERIA'},

  // Sistema supuesto de riego cercano a biblioteca.
  {id: '015', codigo: 'CIS-03', nombre: 'Cisterna del sistema de biblioteca', tipo: 'CISTERNA'},
  {id: '016', codigo: 'MED-03', nombre: 'Medidor del sistema de biblioteca', tipo: 'MEDIDOR'},
  {id: '017', codigo: 'VAL-01', nombre: 'Válvula de riego cercana a biblioteca', tipo: 'VALVULA'},
  {id: '018', codigo: 'TUB-09', nombre: 'Tubería de cisterna a medidor de biblioteca', tipo: 'TUBERIA'},
  {id: '019', codigo: 'TUB-10', nombre: 'Tubería de medidor a válvula de biblioteca', tipo: 'TUBERIA'},
  {id: '020', codigo: 'TUB-11', nombre: 'Tubería hacia zona de riego de biblioteca', tipo: 'TUBERIA'}
] AS componente

MERGE (c:Componente {
  componenteId: '20000000-0000-0000-0000-000000000' + componente.id
})
ON CREATE SET
  c.codigo = componente.codigo,
  c.nombre = componente.nombre,
  c.tipo = componente.tipo,
  c.estado = 'ACTIVO'

RETURN count(c) AS componentes_procesados;