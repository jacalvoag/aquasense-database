import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(new URL('../sincronizador/package.json', import.meta.url));
const { Client } = require('pg');
const aplicar = process.argv.includes('--aplicar');
if (!aplicar && !process.argv.includes('--comprobar')) {
  console.error('Uso: node --env-file=sincronizador/.env herramientas/actualizar-red.mjs --comprobar | --aplicar');
  process.exit(1);
}
for (const clave of ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD']) {
  if (!process.env[clave]) { console.error(`Falta ${clave}.`); process.exit(1); }
}
const postgres = new Client({ connectionTimeoutMillis: 5_000 });
let transaccion = false;
try {
  await postgres.connect();
  if (aplicar) {
    const bloqueo = await postgres.query('SELECT pg_try_advisory_lock(710911, 1) AS adquirido');
    if (!bloqueo.rows[0].adquirido) throw new Error('El sincronizador está procesando. Detén su sesión y vuelve a ejecutar la migración.');
    await postgres.query("BEGIN; SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '30s'");
    transaccion = true;
    const control = await postgres.query('SELECT control_id FROM aquasense.control_red WHERE control_id = 1 FOR UPDATE');
    if (control.rows.length !== 1) throw new Error('Primero prepara la estructura y el control de red.');
    for (const archivo of ['35_registrar_nodos_red.sql', '36_extremos_conexiones_red.sql']) {
      const sql = await readFile(new URL('../bases-de-datos/postgresql/' + archivo, import.meta.url), 'utf8');
      await postgres.query(sql.replace(/^\s*BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''));
    }
    await postgres.query('COMMIT');
    transaccion = false;
  }
  const resultado = await postgres.query(`SELECT
    to_regprocedure('aquasense.registrar_espacio_red(uuid,uuid,text,text,uuid,text)') IS NOT NULL AS espacios,
    to_regprocedure('aquasense.registrar_componente_red(uuid,uuid,text,text,text,uuid,text,text)') IS NOT NULL AS componentes,
    coalesce(position('destinoComponente' IN pg_get_functiondef(to_regprocedure('aquasense.crear_conexion_red(uuid,uuid,uuid,uuid,uuid)'))) > 0, false) AS conexiones,
    coalesce(position('destinoComponente' IN pg_get_functiondef(to_regprocedure('aquasense.actualizar_conexion_red(uuid,uuid,uuid,uuid,uuid)'))) > 0, false) AS cambios`);
  if (!Object.values(resultado.rows[0]).every(Boolean)) throw new Error('Faltan las migraciones 35 o 36. Ejecuta --aplicar.');
  console.log(`Red dinámica preparada en ${process.env.PGDATABASE}. ${aplicar ? 'Migraciones 35 y 36 aplicadas; los datos se conservan.' : 'Comprobación de solo lectura.'}`);
} catch (error) {
  if (transaccion) await postgres.query('ROLLBACK').catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally { await postgres.end(); }
