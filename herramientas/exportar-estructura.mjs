import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Reutiliza el driver instalado del sincronizador; no necesita psql en PATH.
const require = createRequire(new URL('../sincronizador/package.json', import.meta.url));
const { Client } = require('pg');
const [base, salida] = process.argv.slice(2);
let cliente;
try {
  if (!base || !salida) throw new Error('Uso: node --env-file=sincronizador/.env herramientas/exportar-estructura.mjs BASE salida.json');
  for (const nombre of ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD']) {
    if (!process.env[nombre]) throw new Error(`Falta ${nombre}; carga el .env del sincronizador.`);
  }
  cliente = new Client({ database: base, connectionTimeoutMillis: 5_000 });
  await cliente.connect();
  await cliente.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await cliente.query("SET LOCAL statement_timeout = '15s'");
  const consulta = await readFile(new URL('./exportar-estructura.sql', import.meta.url), 'utf8');
  const snapshot = (await cliente.query(consulta)).rows[0].estructura;
  if (!snapshot.objetos.some((o) => o.clase === 'tabla')) throw new Error(`No hay tablas del esquema aquasense en ${base}.`);
  await cliente.query('COMMIT');
  await mkdir(dirname(resolve(salida)), { recursive: true });
  await writeFile(salida, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Estructura exportada de ${base}: ${snapshot.objetos.length} objetos. No se modificaron datos.`);
} catch (error) { console.error(error.message); process.exitCode = 2; }
finally { if (cliente) await cliente.end(); }
