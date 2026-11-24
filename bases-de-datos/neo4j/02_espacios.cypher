UNWIND [
  {id: '001', nombre: 'UD1', tipo: 'EDIFICIO'},
  {id: '002', nombre: 'UD2', tipo: 'EDIFICIO'},
  {id: '003', nombre: 'UD3', tipo: 'EDIFICIO'},
  {id: '004', nombre: 'UD4', tipo: 'EDIFICIO'},
  {id: '005', nombre: 'UD5', tipo: 'EDIFICIO'},
  {id: '006', nombre: 'Cafetería', tipo: 'CAFETERIA'},
  {id: '007', nombre: 'Biblioteca', tipo: 'OTRO'},
  {id: '008', nombre: 'Laboratorios', tipo: 'LABORATORIO'},
  {id: '009', nombre: 'Taller de mecatrónica y manufactura', tipo: 'OTRO'},
  {id: '010', nombre: 'Baños de estudiantes de UD1', tipo: 'BAÑO'},
  {id: '011', nombre: 'Baños de docentes de UD2', tipo: 'BAÑO'},
  {id: '012', nombre: 'Zona de riego cercana a UD1', tipo: 'ZONA_RIEGO'},
  {id: '013', nombre: 'Zona de riego cercana a UD2', tipo: 'ZONA_RIEGO'},
  {id: '014', nombre: 'Zona de riego cercana a la biblioteca', tipo: 'ZONA_RIEGO'}
] AS espacio

MERGE (e:Espacio {
  espacioId: '10000000-0000-0000-0000-000000000' + espacio.id
})
ON CREATE SET
  e.nombre = espacio.nombre,
  e.tipo = espacio.tipo

RETURN count(e) AS espacios_procesados;