import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';

function inventario(snapshot) {
  if (snapshot.formato !== 1 || snapshot.esquema !== 'aquasense' || !Array.isArray(snapshot.objetos)) {
    throw new Error('Formato inválido: exporta con herramientas/exportar-estructura.sql.');
  }
  if (!snapshot.objetos.some((o) => o.clase === 'tabla')) throw new Error('La exportación no contiene tablas de aquasense.');
  const mapa = new Map();
  for (const objeto of snapshot.objetos) {
    if (typeof objeto.clase !== 'string' || typeof objeto.identificador !== 'string' || !objeto.definicion) throw new Error('Objeto de estructura incompleto.');
    const clave = `${objeto.clase}:${objeto.identificador}`;
    if (mapa.has(clave)) throw new Error(`Objeto duplicado: ${clave}`);
    mapa.set(clave, objeto);
  }
  return mapa;
}

export function comparar(original, reconstruccion) {
  const a = inventario(original);
  const b = inventario(reconstruccion);
  if (!Number.isInteger(original.postgresMayor) || original.postgresMayor !== reconstruccion.postgresMayor) {
    throw new Error('Exporta ambas estructuras desde la misma versión mayor de PostgreSQL.');
  }
  const faltantes = [...a.keys()].filter((k) => !b.has(k)).sort();
  const adicionales = [...b.keys()].filter((k) => !a.has(k)).sort();
  const diferentes = [...a.keys()].filter((k) => b.has(k) && !isDeepStrictEqual(a.get(k).definicion, b.get(k).definicion))
    .sort().map((clave) => ({ clave, original: a.get(clave).definicion, reconstruccion: b.get(clave).definicion }));
  const cantidades = (mapa) => [...mapa.values()].reduce((r, o) => ({ ...r, [o.clase]: (r[o.clase] ?? 0) + 1 }), {});
  return { coinciden: !faltantes.length && !adicionales.length && !diferentes.length,
    cantidades: { original: cantidades(a), reconstruccion: cantidades(b) }, faltantes, adicionales, diferentes };
}

async function cargar(ruta) {
  const bytes = await readFile(ruta);
  const texto = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.toString('utf16le') : bytes.toString('utf8');
  return { snapshot: JSON.parse(texto.replace(/^\uFEFF/, '').trim()), hash: createHash('sha256').update(bytes).digest('hex') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [original, reconstruccion, salida] = process.argv.slice(2);
    if (!original || !reconstruccion || !salida) throw new Error('Uso: node herramientas/comparar-estructura.mjs original.json reconstruccion.json resultado.json');
    const [a, b] = await Promise.all([cargar(original), cargar(reconstruccion)]);
    const reporte = { fecha: new Date().toISOString(), hashes: { original: a.hash, reconstruccion: b.hash }, ...comparar(a.snapshot, b.snapshot) };
    await mkdir(dirname(resolve(salida)), { recursive: true });
    await writeFile(salida, JSON.stringify(reporte, null, 2) + '\n');
    console.log(JSON.stringify({ coinciden: reporte.coinciden, cantidades: reporte.cantidades,
      faltantes: reporte.faltantes.length, adicionales: reporte.adicionales.length, diferentes: reporte.diferentes.length }, null, 2));
    process.exitCode = reporte.coinciden ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
