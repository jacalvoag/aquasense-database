import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparar } from './comparar-estructura.mjs';

const tabla = { clase: 'tabla', identificador: 'componente', definicion: { columnas: [{ nombre: 'codigo', obligatoria: true }] } };
const indice = { clase: 'indice', identificador: 'codigo_unico', definicion: { definicion: 'CREATE UNIQUE INDEX codigo_unico ON aquasense.componente (codigo)' } };
const snapshot = (objetos) => ({ formato: 1, esquema: 'aquasense', postgresMayor: 16, objetos });

test('compara objetos sin depender del orden de exportación', () => {
  assert.equal(comparar(snapshot([tabla, indice]), snapshot([indice, tabla])).coinciden, true);
});
test('detecta una restricción NOT NULL retirada', () => {
  const modificada = structuredClone(tabla);
  modificada.definicion.columnas[0].obligatoria = false;
  assert.equal(comparar(snapshot([tabla]), snapshot([modificada])).diferentes[0].clave, 'tabla:componente');
});
test('detecta índices faltantes y objetos adicionales', () => {
  const resultado = comparar(snapshot([tabla, indice]), snapshot([tabla, { ...indice, identificador: 'otro' }]));
  assert.equal(resultado.coinciden, false);
  assert.deepEqual(resultado.faltantes, ['indice:codigo_unico']);
  assert.deepEqual(resultado.adicionales, ['indice:otro']);
});
test('rechaza dos exportaciones vacías o de versiones incompatibles', () => {
  assert.throws(() => comparar(snapshot([]), snapshot([])), /no contiene tablas/);
  assert.throws(() => comparar(snapshot([tabla]), { ...snapshot([tabla]), postgresMayor: 17 }), /versión mayor/);
  assert.throws(() => comparar(snapshot([tabla, tabla]), snapshot([tabla])), /duplicado/);
});
