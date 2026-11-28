import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import pg from 'pg';
import { MongoClient, type IndexSpecification } from 'mongodb';
import neo4j from 'neo4j-driver';
const raiz = resolve(__dirname, '..');
const postgres = new pg.Client();
const mongo = new MongoClient(process.env.MONGODB_URI!);
const baseMongo = mongo.db(process.env.MONGODB_DATABASE);
const driver = neo4j.driver(process.env.NEO4J_URI!, neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!));
const sesion = driver.session({ database: process.env.NEO4J_DATABASE });
async function iniciar() {
try {
  await postgres.connect(); await mongo.connect();
  const esquema = (await postgres.query("SELECT to_regnamespace('aquasense') AS existe")).rows[0].existe;
  const marca = await readFile('/estado/completo', 'utf8').catch(() => null);
  if (marca) {
    assert.ok(esquema, 'Falta PostgreSQL: no elimines volúmenes individuales.');
    assert.ok(await baseMongo.collection('expedientes').indexExists('expediente_por_reporte_unico'));
    assert.equal((await sesion.run("MATCH (c:ControlRed {id:'red-principal', estado:'INICIALIZADO'}) RETURN count(c) AS n")).records[0].get('n').toNumber(), 1);
    console.log('Bases existentes conservadas.');
  } else {
    assert.equal(esquema, null, 'Inicialización parcial detectada. Consulta docs/docker.md; no se sobrescriben datos.');
    assert.equal((await baseMongo.listCollections().toArray()).length, 0);
    assert.equal((await sesion.run('MATCH (n) RETURN count(n) AS n')).records[0].get('n').toNumber(), 0);
  const carpetaSql = join(raiz, 'bases-de-datos/postgresql');
  const archivosSql = (await readdir(carpetaSql)).filter((archivo) => {
    const numero = Number(archivo.slice(0, 2));
    return archivo.endsWith('.sql') && (numero <= 28 || numero >= 32);
  }).sort();
  for (const archivo of archivosSql) await postgres.query(await readFile(join(carpetaSql, archivo), 'utf8'));

  const tareas: Promise<unknown>[] = [];
  const adaptadorMongo = {
    getSiblingDB(nombre: string) {
      assert.equal(nombre, 'aquasense');
      // El nombre lógico de los scripts se dirige únicamente a aquasense_pruebas.
      return {
        createCollection: (nombre: string, opciones: object) => tareas.push(baseMongo.createCollection(nombre, opciones)),
        expedientes: { createIndex: (claves: IndexSpecification, opciones: object) => tareas.push(baseMongo.collection('expedientes').createIndex(claves, opciones)) },
      };
    },
  };
  for (const archivo of ['01_coleccion_expedientes.js', '02_indice_expedientes.js']) {
    vm.runInNewContext(await readFile(join(raiz, 'bases-de-datos/mongodb', archivo), 'utf8'), { db: adaptadorMongo });
    await Promise.all(tareas.splice(0));
  }
  const carpetaCypher = join(raiz, 'bases-de-datos/neo4j');
  for (const archivo of (await readdir(carpetaCypher)).filter((a) => a.endsWith('.cypher') && !a.startsWith('08')).sort()) {
    for (const consulta of (await readFile(join(carpetaCypher, archivo), 'utf8')).split(';').filter((s) => s.trim())) await sesion.run(consulta);
  }
  const componentesPg = (await postgres.query('SELECT componente_id AS id FROM aquasense.componente ORDER BY id')).rows.map((r) => r.id);
  const componentesNeo = (await sesion.run('MATCH (c:Componente) RETURN c.componenteId AS id ORDER BY id')).records.map((r) => r.get('id'));
  assert.deepEqual(componentesNeo, componentesPg);
  const conexionesPg = (await postgres.query('SELECT conexion_id AS id, componente_origen_id AS origen, COALESCE(componente_destino_id, espacio_destino_id) AS destino FROM aquasense.conexion ORDER BY id')).rows;
  const conexionesNeo = (await sesion.run('MATCH (o)-[c:CONECTA_CON]->(d) RETURN c.conexionId AS id, o.componenteId AS origen, coalesce(d.componenteId, d.espacioId) AS destino ORDER BY id')).records.map((r) => ({ id: r.get('id'), origen: r.get('origen'), destino: r.get('destino') }));
  assert.deepEqual(conexionesNeo, conexionesPg);
  await sesion.run(await readFile(join(carpetaCypher, '08_confirmar_version_inicial.cypher'), 'utf8'));

    await writeFile('/estado/completo', '1\n');
    console.log('Carga inicial verificada y confirmada.');
  }
} finally { await Promise.allSettled([postgres.end(), mongo.close(), sesion.close(), driver.close()]); }

}
iniciar().catch(error => { console.error(error.message); process.exitCode = 1; });
