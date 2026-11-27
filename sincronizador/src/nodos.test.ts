import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarNodo } from './nodos';
const id = '10000000-0000-0000-0000-000000000010';
const espacio = { espacio_id: id, nombre: 'Riego', tipo: 'ZONA_RIEGO', espacio_contenedor_id: null };
const componente = { componente_id: id, codigo: 'TUB-NUEVA', nombre: 'Nueva', tipo: 'TUBERIA', estado: 'ACTIVO', espacio_id: id };
test('valida snapshots de espacio y componente sin confundir ubicación y conectividad', () => {
  assert.equal(validarNodo(espacio, 'Espacio').padre, null);
  assert.equal(validarNodo(componente, 'Componente').padre, id);
});
test('rechaza snapshots sin identidad o con referencia inválida', () => {
  for (const valor of [null, [], { ...espacio, espacio_id: 'otro' }, { ...espacio, espacio_contenedor_id: '' }]) {
    assert.throws(() => validarNodo(valor, 'Espacio'));
  }
});
test('rechaza tipos desconocidos y componentes retirados antes de escribir en el grafo', () => {
  assert.throws(() => validarNodo({ ...componente, tipo: 'OTRO' }, 'Componente'));
  assert.throws(() => validarNodo({ ...componente, estado: 'RETIRADO' }, 'Componente'));
});
