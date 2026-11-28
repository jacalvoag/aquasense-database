import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const web = process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173';
const headers = { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${process.env.API_OPERATOR_USER ?? 'operador'}:${process.env.API_OPERATOR_PASSWORD ?? 'aquasense-operador-local'}`).toString('base64') };
async function api(path, body) {
  const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json(); assert.ok(r.ok, JSON.stringify(data)); return data;
}
async function confirmar(id, reporte) {
  for (let i = 0; i < 45; i++) {
    const e = await api(reporte ? `/reportes/${reporte}/eventos/${id}` : `/red/eventos/${id}`);
    assert.notEqual(e.estado, 'ERROR'); if (e.estado === 'PROCESADO') return;
    await new Promise(r => setTimeout(r, 1000));
  }
  assert.fail('Evento sin confirmar');
}
for (const motor of ['postgres', 'mongodb', 'neo4j']) assert.equal((await api('/salud/' + motor)).estado, 'ok');
assert.match(await (await fetch(web + '/reportes')).text(), /AquaSense/);
assert.equal((await (await fetch(web + '/api/salud/postgres')).json()).estado, 'ok');
let ids;
if (process.argv.includes('--verificar')) ids = JSON.parse(await readFile('docker-resultado.json', 'utf8'));
else {
  const espacio = await api('/espacios', { nombre: 'Zona Docker', tipo: 'ZONA_RIEGO' }); await confirmar(espacio.eventoId);
  const tubo = await api('/componentes', { codigo: 'TUB-DOCKER', nombre: 'Tubería Docker', tipo: 'TUBERIA', espacioId: espacio.espacioId }); await confirmar(tubo.eventoId);
  const fuente = await api('/componentes', { codigo: 'CIS-DOCKER', nombre: 'Cisterna Docker', tipo: 'CISTERNA' }); await confirmar(fuente.eventoId);
  for (const cuerpo of [{ componenteOrigenId: fuente.componenteId, componenteDestinoId: tubo.componenteId },
    { componenteOrigenId: tubo.componenteId, espacioDestinoId: espacio.espacioId }]) await confirmar((await api('/conexiones', cuerpo)).eventoId);
  const reporte = await api('/reportes', { espacioId: espacio.espacioId, descripcionInicial: 'Reporte persistente Docker.' });
  await confirmar(reporte.eventoId, reporte.reporteId);
  ids = { espacio: espacio.espacioId, tubo: tubo.componenteId, reporte: reporte.reporteId };
  await writeFile('docker-resultado.json', JSON.stringify(ids));
}
assert.equal((await api(`/reportes/${ids.reporte}/expediente`)).expediente.descripcionInicial, 'Reporte persistente Docker.');
assert.ok((await api('/red')).nodos.some(n => n.entidadId === ids.tubo));
assert.equal((await api(`/red/componentes/${ids.tubo}/alcance`)).espacios[0].espacioId, ids.espacio);
assert.equal((await api('/lecturas')).length, 7);
console.log(process.argv.includes('--verificar') ? 'Persistencia tras recrear contenedores: aprobada.' : 'Aplicación Docker, tres motores y sincronización: aprobados.');
