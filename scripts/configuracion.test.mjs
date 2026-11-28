import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configurar } from './configuracion.mjs';

function ejemplo() {
  return { PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'aquasense_reconstruccion',
    PGUSER: 'postgres', PGPASSWORD: 'solo-prueba', MONGODB_URI: 'mongodb://127.0.0.1:27017',
    MONGODB_DATABASE: 'aquasense_reconstruccion', NEO4J_URI: 'neo4j://127.0.0.1:7687',
    NEO4J_USER: 'neo4j', NEO4J_PASSWORD: 'solo-prueba', NEO4J_DATABASE: 'aquasense-reconstruccion',
    API_OPERATOR_USER: 'operador', API_OPERATOR_PASSWORD: 'clave-solo-pruebas' };
}
test('configuración local válida y puerto configurable', () => {
  const api = { ...ejemplo(), PORT: '3001' };
  const resultado = configurar(api, ejemplo());
  assert.equal(resultado.apiUrl, 'http://127.0.0.1:3001');
  assert.equal(resultado.frontendUrl, 'http://localhost:5173');
});
test('permite credenciales distintas y alias de loopback para el mismo destino', () => {
  const sincronizador = { ...ejemplo(), PGHOST: 'localhost', PGUSER: 'escritura', PGPASSWORD: 'otra',
    MONGODB_URI: 'mongodb://usuario:clave@localhost:27017', NEO4J_URI: 'bolt://localhost:7687' };
  assert.equal(configurar(ejemplo(), sincronizador).apiPuerto, 3000);
});
test('rechaza una base o servidor diferente antes de abrir procesos', () => {
  assert.throws(() => configurar(ejemplo(), { ...ejemplo(), PGDATABASE: 'otra' }), /mismos servidores/);
  assert.throws(() => configurar(ejemplo(), { ...ejemplo(), NEO4J_URI: 'bolt://localhost:9999' }), /mismos servidores/);
});
test('identifica variables ausentes sin revelar credenciales', () => {
  const api = { ...ejemplo(), PGHOST: '', PGPASSWORD: 'NO-MOSTRAR-ESTO' };
  assert.throws(() => configurar(api, ejemplo()), (error) =>
    error.message.includes('PGHOST') && !error.message.includes('NO-MOSTRAR-ESTO'));
  assert.throws(() => configurar({ ...ejemplo(), API_OPERATOR_PASSWORD: 'CAMBIAR' }, ejemplo()), /API_OPERATOR/);
});
test('rechaza puertos inválidos y el conflicto entre API y frontend', () => {
  assert.throws(() => configurar({ ...ejemplo(), PORT: 'abc' }, ejemplo()), /puerto válido/);
  assert.throws(() => configurar({ ...ejemplo(), PGPORT: '70000' }, ejemplo()), /puerto válido/);
  assert.throws(() => configurar({ ...ejemplo(), PORT: '5173' }, ejemplo()), /puertos distintos/);
});
test('exige un origen de Vite permitido por CORS', () => {
  assert.throws(() => configurar({ ...ejemplo(), CORS_ORIGINS: 'https://otro.invalid' }, ejemplo()), /CORS_ORIGINS/);
  assert.equal(configurar({ ...ejemplo(), CORS_ORIGINS: 'http://127.0.0.1:5173' }, ejemplo()).frontendUrl, 'http://127.0.0.1:5173');
});

test('admite puertos personalizados sin confundir el origen de CORS', () => {
  const api = { ...ejemplo(), PORT: '5173', FRONTEND_PORT: '5180', CORS_ORIGINS: 'http://localhost:5180' };
  assert.equal(configurar(api, ejemplo()).frontendPuerto, 5180);
  assert.equal(configurar(api, ejemplo()).frontendUrl, 'http://localhost:5180');
  assert.throws(() => configurar({ ...api, FRONTEND_PORT: '5173' }, ejemplo()), /puertos distintos/);
});
