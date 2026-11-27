import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { configurar } from './configuracion.mjs';

const raiz = new URL('../', import.meta.url);
const require = createRequire(new URL('../sincronizador/package.json', import.meta.url));
async function leer(ruta) {
  let texto;
  try { texto = await readFile(new URL(ruta, raiz), 'utf8'); }
  catch { throw new Error('Falta ' + ruta + '. Crea y configura el archivo desde su .env.example.'); }
  const valores = parseEnv(texto);
  // La API y Node dan prioridad a las variables ya presentes en la sesión.
  const comunes = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
    'MONGODB_URI', 'MONGODB_DATABASE', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'NEO4J_DATABASE'];
  for (const clave of new Set([...Object.keys(valores), ...comunes])) {
    if (process.env[clave] !== undefined) valores[clave] = process.env[clave];
  }
  for (const clave of ['API_OPERATOR_USER', 'API_OPERATOR_PASSWORD', 'PORT', 'CORS_ORIGINS']) {
    if (process.env[clave] !== undefined) valores[clave] = process.env[clave];
  }
  return valores;
}
async function comprobar(config, nombre) {
  const { Client } = require('pg');
  const { MongoClient } = require('mongodb');
  const neo4j = require('neo4j-driver');
  const postgres = new Client({ host: config.PGHOST, port: Number(config.PGPORT),
    database: config.PGDATABASE, user: config.PGUSER, password: config.PGPASSWORD, connectionTimeoutMillis: 5_000 });
  const mongo = new MongoClient(config.MONGODB_URI, { serverSelectionTimeoutMS: 5_000, connectTimeoutMS: 5_000 });
  const driver = neo4j.driver(config.NEO4J_URI, neo4j.auth.basic(config.NEO4J_USER, config.NEO4J_PASSWORD),
    { connectionTimeout: 5_000, maxTransactionRetryTime: 0, connectionAcquisitionTimeout: 5_000 });
  const sesion = driver.session({ database: config.NEO4J_DATABASE });
  try {
    const verificaciones = await Promise.allSettled([
      (async () => { await postgres.connect(); await postgres.query('SELECT 1'); })(),
      (async () => { await mongo.connect(); await mongo.db(config.MONGODB_DATABASE).command({ ping: 1 }); })(),
      sesion.run('RETURN 1 AS prueba'),
    ]);
    const motores = ['PostgreSQL', 'MongoDB', 'Neo4j'];
    const fallos = verificaciones.flatMap((resultado, i) => resultado.status === 'rejected' ? [motores[i]] : []);
    if (fallos.length) throw new Error(nombre + ': no se pudo conectar a ' + fallos.join(', ') + '. Revisa el servicio, la base y sus credenciales.');
  } finally {
    await Promise.allSettled([postgres.end(), mongo.close(), sesion.close(), driver.close()]);
  }
}
try {
  const [api, sincronizador] = await Promise.all([leer('api/.env'), leer('sincronizador/.env')]);
  const configuracion = configurar(api, sincronizador);
  if (!process.argv.includes('--solo-configuracion')) {
    await comprobar(api, 'API');
    await comprobar(sincronizador, 'Sincronizador');
  }
  console.log(JSON.stringify(configuracion));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
