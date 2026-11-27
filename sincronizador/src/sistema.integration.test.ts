import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import pg from 'pg';
import { MongoClient, type IndexSpecification } from 'mongodb';
import neo4j from 'neo4j-driver';

const ejecutar = promisify(execFile);
const raiz = resolve(__dirname, '../..');
const trabajador = join(raiz, 'sincronizador');
const resultados = join(raiz, 'pruebas/resultados');
const espacioId = '10000000-0000-0000-0000-000000000010';
const anteriorId = '20000000-0000-0000-0000-000000000006';
const medidorId = '20000000-0000-0000-0000-000000000002';
const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

async function detener(proceso: ChildProcess) {
  if (proceso.exitCode !== null || proceso.signalCode !== null) return;
  await new Promise<void>((resolver) => {
    const limite = setTimeout(() => proceso.kill('SIGKILL'), 5_000);
    proceso.once('exit', () => { clearTimeout(limite); resolver(); });
    proceso.kill('SIGTERM');
  });
}

test('flujo real entre API, sincronizador, PostgreSQL, MongoDB y Neo4j', { timeout: 180_000 }, async (t) => {
  // Se exige un entorno dedicado y vacío. La prueba no borra bases ni datos previos.
  assert.equal(process.env.AQUASENSE_PRUEBAS, '1', 'Usa .env.pruebas y el entorno aislado.');
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGPORT, '55432');
  assert.equal(process.env.PGDATABASE, 'aquasense_pruebas');
  assert.equal(process.env.MONGODB_DATABASE, 'aquasense_pruebas');
  assert.equal(new URL(process.env.MONGODB_URI!).hostname, '127.0.0.1');
  assert.equal(new URL(process.env.MONGODB_URI!).port, '57017');
  assert.equal(new URL(process.env.NEO4J_URI!).hostname, '127.0.0.1');
  assert.equal(new URL(process.env.NEO4J_URI!).port, '57687');
  assert.equal(process.env.NEO4J_DATABASE, 'neo4j');
  assert.equal(process.env.PORT, '3001');
  const postgres = new pg.Client({ connectionTimeoutMillis: 5_000 });
  const mongo = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5_000 });
  const grafo = neo4j.driver(process.env.NEO4J_URI!, neo4j.auth.basic(process.env.NEO4J_USER!, process.env.NEO4J_PASSWORD!));
  const sesion = grafo.session({ database: process.env.NEO4J_DATABASE });
  const baseMongo = mongo.db(process.env.MONGODB_DATABASE);
  const casos: { caso: string; estado: string }[] = [];
  const registrar = (caso: string) => { casos.push({ caso, estado: 'APROBADO' }); console.log(`Sistema: ${caso}`); };
  let servidor: ChildProcess | undefined;
  let logApi = '';
  const logsCiclos: string[] = [];
  let finalizado = false;
  let versiones: Record<string, unknown> = {};
  const fecha = () => new Date().toISOString();

  t.after(async () => {
    if (servidor) await detener(servidor);
    await Promise.allSettled([postgres.end(), mongo.close(), sesion.close(), grafo.close()]);
    await mkdir(resultados, { recursive: true });
    await writeFile(join(resultados, 'sistema.json'), JSON.stringify({
      fecha: fecha(), finalizado, escenario: 'Tres motores reales aislados; sin drivers simulados.',
      node: process.version, plataforma: process.platform, versiones, casos,
    }, null, 2));
    await writeFile(join(resultados, 'api.log'), logApi);
    await writeFile(join(resultados, 'sincronizador.log'), logsCiclos.join('\n'));
  });

  await postgres.connect();
  await mongo.connect();
  const esquema = await postgres.query("SELECT to_regnamespace('aquasense') AS existente");
  assert.equal(esquema.rows[0].existente, null, 'PostgreSQL debe estar vacío; no se modifica un esquema existente.');
  assert.equal((await baseMongo.listCollections().toArray()).length, 0, 'MongoDB debe estar vacío.');
  const existentes = await sesion.run('MATCH (n) RETURN count(n) AS cantidad');
  assert.equal(existentes.records[0].get('cantidad').toNumber(), 0, 'Neo4j debe estar vacío.');
  await readFile(join(raiz, 'api/dist/main.js')); // Exige compilar la API antes de preparar datos.
  versiones = {
    postgres: (await postgres.query('SHOW server_version')).rows[0].server_version,
    mongodb: (await baseMongo.admin().command({ buildInfo: 1 })).version,
    neo4j: (await sesion.run('CALL dbms.components() YIELD versions RETURN versions[0] AS version LIMIT 1')).records[0].get('version'),
  };

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
  registrar('carga base: identificadores y 22 conexiones coinciden entre PostgreSQL y Neo4j');

  servidor = spawn(process.execPath, [join(raiz, 'api/dist/main.js')], { cwd: join(raiz, 'api'), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  servidor.stdout?.on('data', (b) => { logApi += b.toString(); });
  servidor.stderr?.on('data', (b) => { logApi += b.toString(); });
  const url = 'http://127.0.0.1:3001';
  const credencial = Buffer.from(`${process.env.API_OPERATOR_USER}:${process.env.API_OPERATOR_PASSWORD}`).toString('base64');
  async function api(ruta: string, esperado: number, cuerpo?: unknown, metodo = cuerpo === undefined ? 'GET' : 'POST', autorizar = true) {
    const respuesta = await fetch(url + ruta, { method: metodo, headers: {
      ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(autorizar ? { Authorization: `Basic ${credencial}` } : {}),
    }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo), signal: AbortSignal.timeout(10_000) });
    const datos = await respuesta.json();
    assert.equal(respuesta.status, esperado, `${metodo} ${ruta}: ${JSON.stringify(datos)}`);
    return datos;
  }
  let lista = false;
  for (let i = 0; i < 100; i++) {
    if (servidor.exitCode !== null) throw new Error(`La API terminó antes de estar lista: ${logApi}`);
    try { await api('/salud/postgres', 200); lista = true; break; } catch { await esperar(100); }
  }
  assert.ok(lista, 'La API no inició.');
  for (const motor of ['postgres', 'mongodb', 'neo4j']) assert.equal((await api(`/salud/${motor}`, 200)).estado, 'ok');
  const inicial = await api('/red', 200);
  assert.equal(inicial.versionRed, '0');
  assert.equal(inicial.nodos.length, 25);
  assert.equal(inicial.conexiones.length, 22);
  registrar('API: salud de los tres motores y snapshot inicial');

  async function ciclo(esperarFallo = false) {
    try {
      const salida = await ejecutar(process.execPath, ['--import', 'tsx', 'src/index.ts', '--una-vez'], {
        cwd: trabajador, env: process.env, timeout: 30_000, maxBuffer: 2_000_000,
      });
      logsCiclos.push(salida.stdout, salida.stderr);
      assert.equal(esperarFallo, false, 'El fallo de confirmación previsto no ocurrió.');
    } catch (error) {
      const fallo = error as Error & { code?: number; stdout?: string; stderr?: string };
      logsCiclos.push(fallo.stdout ?? '', fallo.stderr ?? '');
      if (!esperarFallo || fallo.code !== 1) throw error;
    }
  }
  const baseReporte = { espacioId, descripcionInicial: 'Prueba integral reproducible.', referenciaUbicacion: 'Lavabos UD1' };
  await api('/reportes', 401, baseReporte, 'POST', false);
  await api('/reportes', 400, {});
  const reporte = await api('/reportes', 201, baseReporte);
  const ruta = `/reportes/${reporte.reporteId}`;
  assert.equal((await api(`${ruta}/expediente`, 200)).expediente, null);
  await ciclo();
  assert.equal((await api(`${ruta}/expediente`, 200)).estadoDocumental, 'PROCESADO');
  assert.equal(await baseMongo.collection('expedientes').countDocuments({ reporteId: reporte.reporteId }), 1);
  await api(`${ruta}/cerrar`, 409, undefined, 'POST');
  registrar('reporte: autorización, validación, sincronización y rechazo del cierre prematuro');

  const inspeccion = await api(`${ruta}/atenciones`, 201, { tipo: 'INSPECCION', fecha: fecha(), descripcion: 'Inspección integrada.', hallazgos: 'Fisura en TUB-03.' });
  // Fallo de confirmación posterior a escribir en MongoDB. Solo existe en la base de pruebas.
  await postgres.query(`CREATE FUNCTION aquasense.fallo_confirmacion_prueba() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.estado = 'PROCESADO' AND OLD.estado <> 'PROCESADO' THEN RAISE EXCEPTION 'Confirmación interrumpida para la prueba'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER fallo_confirmacion_prueba BEFORE UPDATE ON aquasense.evento_salida FOR EACH ROW EXECUTE FUNCTION aquasense.fallo_confirmacion_prueba()`);
  await ciclo(true);
  assert.equal((await api(`${ruta}/eventos/${inspeccion.eventoId}`, 200)).estado, 'PENDIENTE');
  await postgres.query('DROP TRIGGER fallo_confirmacion_prueba ON aquasense.evento_salida');
  await postgres.query('UPDATE aquasense.evento_salida SET proximo_intento_en = CURRENT_TIMESTAMP WHERE evento_id = $1', [inspeccion.eventoId]);
  await ciclo();
  const trasInspeccion = await api(`${ruta}/expediente`, 200);
  assert.equal(trasInspeccion.expediente.atenciones.length, 1);
  assert.equal(trasInspeccion.expediente.ultimaSecuenciaAplicada, '2');
  registrar('MongoDB: recuperación después de aplicar una atención, sin duplicarla');

  const nueva = await api('/componentes/tuberias', 201, { codigo: 'TUB-PRUEBA-INTEGRAL', nombre: 'Tubería de prueba integral', espacioId });
  await api(`/red/componentes/${nueva.componenteId}/alcance`, 409);
  const alcanceAntes = await api(`/red/componentes/${anteriorId}/alcance`, 200);
  const reemplazo = await api(`${ruta}/reemplazo`, 201, { tuberiaAnteriorId: anteriorId, tuberiaNuevaId: nueva.componenteId, fecha: fecha(), descripcion: 'Reemplazo integrado.', materiales: ['PVC'] });
  await api('/red', 503);
  await postgres.query('CREATE TRIGGER fallo_confirmacion_prueba BEFORE UPDATE ON aquasense.evento_salida FOR EACH ROW WHEN (NEW.destino = \'GRAFO\') EXECUTE FUNCTION aquasense.fallo_confirmacion_prueba()');
  await ciclo(true);
  assert.equal((await api(`${ruta}/eventos/${reemplazo.eventoDocumentalId}`, 200)).estado, 'PROCESADO');
  assert.equal((await api(`${ruta}/eventos/${reemplazo.eventoGrafoId}`, 200)).estado, 'PENDIENTE');
  const aplicados = await sesion.run('MATCH (e:EventoAplicado {eventoId: $id}) RETURN count(e) AS cantidad', { id: reemplazo.eventoGrafoId });
  assert.equal(aplicados.records[0].get('cantidad').toNumber(), 1);
  await postgres.query('DROP TRIGGER fallo_confirmacion_prueba ON aquasense.evento_salida; DROP FUNCTION aquasense.fallo_confirmacion_prueba()');
  await postgres.query('UPDATE aquasense.evento_salida SET proximo_intento_en = CURRENT_TIMESTAMP WHERE evento_id = $1', [reemplazo.eventoGrafoId]);
  await ciclo();
  const alcanceDespues = await api(`/red/componentes/${nueva.componenteId}/alcance`, 200);
  assert.deepEqual(alcanceDespues.espacios, alcanceAntes.espacios);
  const actualizado = await api('/red', 200);
  assert.equal(actualizado.versionRed, '1');
  assert.ok(actualizado.nodos.some((n: { entidadId: string }) => n.entidadId === nueva.componenteId));
  assert.ok(!actualizado.nodos.some((n: { entidadId: string }) => n.entidadId === anteriorId));
  const integridad = await sesion.run(`MATCH (n:Componente {componenteId: $nueva})
    OPTIONAL MATCH ()-[entrada:CONECTA_CON]->(n)
    OPTIONAL MATCH (n)-[salida:CONECTA_CON]->()
    OPTIONAL MATCH (n)-[r:REEMPLAZA_A]->(:Componente {componenteId: $anterior})
    RETURN count(DISTINCT n) AS tuberias, count(DISTINCT entrada) AS entradas, count(DISTINCT salida) AS salidas, count(DISTINCT r) AS reemplazos`, { nueva: nueva.componenteId, anterior: anteriorId });
  for (const campo of ['tuberias', 'entradas', 'salidas', 'reemplazos']) assert.equal(integridad.records[0].get(campo).toNumber(), 1);
  registrar('Neo4j: reemplazo y recuperación sin duplicar tubería, conexiones ni historial');

  const verificacion = await api(`${ruta}/atenciones`, 201, { tipo: 'VERIFICACION', fecha: fecha(), descripcion: 'Verificación integrada.', resultado: 'SIN_INDICIOS' });
  await ciclo();
  assert.equal((await api(`${ruta}/eventos/${verificacion.eventoId}`, 200)).estado, 'PROCESADO');
  assert.equal((await api(`${ruta}/cerrar`, 200, undefined, 'POST')).estado, 'CERRADO');
  const expediente = await api(`${ruta}/expediente`, 200);
  assert.equal(expediente.expediente.atenciones.length, 3);
  assert.equal(expediente.expediente.ultimaSecuenciaAplicada, '4');
  await api(`${ruta}/atenciones`, 422, { tipo: 'INSPECCION', fecha: fecha(), descripcion: 'Fuera de estado.', hallazgos: 'Prueba.' });
  registrar('verificación, cierre y rechazo de atención sobre reporte cerrado');

  await api('/lecturas', 201, { medidorId, fechaHora: fecha(), valorAcumulado: '120.500' });
  const lecturas = await api('/lecturas', 200);
  assert.equal(lecturas.find((r: { valor_acumulado: string }) => r.valor_acumulado === '120.500').consumo_m3, '2.500');
  const pendientes = await postgres.query("SELECT count(*)::int AS cantidad FROM aquasense.evento_salida WHERE estado <> 'PROCESADO'");
  assert.equal(pendientes.rows[0].cantidad, 0);
  await ciclo();
  assert.equal(await baseMongo.collection('expedientes').countDocuments({ reporteId: reporte.reporteId }), 1);
  registrar('lectura acumulada, consumo de 2.500 m³ y ciclo sin eventos pendientes');

  await mkdir(resultados, { recursive: true });
  await writeFile(join(resultados, 'identificadores.json'), JSON.stringify({ reporteId: reporte.reporteId, nuevaId: nueva.componenteId, codigoNueva: nueva.codigo, versionRed: '1' }, null, 2));
  const estructura = await postgres.query(await readFile(join(raiz, 'herramientas/exportar-estructura.sql'), 'utf8'));
  await writeFile(join(resultados, 'estructura-reconstruida.json'), JSON.stringify(estructura.rows[0].estructura, null, 2));
  finalizado = true;
});
