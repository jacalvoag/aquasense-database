import neo4j, { type ManagedTransaction, type Session } from 'neo4j-driver';

type Objeto = Record<string, unknown>;
type Evento = { evento_id: string; secuencia: string; datos: Objeto };
const tipos = ['CISTERNA', 'TUBERIA', 'UNION', 'VALVULA', 'MEDIDOR'];
const espacios = ['EDIFICIO', 'BAÑO', 'LABORATORIO', 'OFICINA', 'CAFETERIA', 'ZONA_RIEGO', 'OTRO'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function objeto(valor: unknown): Objeto {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Snapshot de nodo inválido.');
  return valor as Objeto;
}
export function validarNodo(valor: unknown, clase: 'Componente' | 'Espacio') {
  const dato = objeto(valor);
  const id = clase === 'Componente' ? dato.componente_id : dato.espacio_id;
  const padre = clase === 'Componente' ? dato.espacio_id : dato.espacio_contenedor_id;
  if (typeof id !== 'string' || !uuid.test(id) || typeof dato.nombre !== 'string' || !dato.nombre.trim()
    || !(clase === 'Componente' ? tipos : espacios).includes(String(dato.tipo))
    || (padre !== null && (typeof padre !== 'string' || !uuid.test(padre)))) throw new Error('Datos de nodo inválidos.');
  if (clase === 'Componente' && (dato.estado !== 'ACTIVO' || typeof dato.codigo !== 'string' || !dato.codigo.trim())) {
    throw new Error('El componente del evento debe estar activo y tener código.');
  }
  return { dato, id, padre: padre as string | null };
}

export async function asegurarNodo(tx: ManagedTransaction, valor: unknown, clase: 'Componente' | 'Espacio', crear = true) {
  const { dato, id, padre } = validarNodo(valor, clase);
  const clave = clase === 'Componente' ? 'componenteId' : 'espacioId';
  const relacion = clase === 'Componente' ? 'UBICADO_EN' : 'ESTA_DENTRO_DE';
  const propiedades = clase === 'Componente'
    ? { codigo: dato.codigo, nombre: dato.nombre, tipo: dato.tipo, estado: dato.estado }
    : { nombre: dato.nombre, tipo: dato.tipo };
  if (padre) {
    const resultado = await tx.run('MATCH (p:Espacio {espacioId: $padre}) RETURN p', { padre });
    if (resultado.records.length !== 1) throw new Error('La ubicación o el contenedor no está sincronizado.');
  }
  const resultado = await tx.run(`${crear ? 'MERGE' : 'MATCH'} (n:${clase} {${clave}: $id})
    ${crear ? 'ON CREATE SET n += $propiedades' : ''}
    RETURN properties(n) AS propiedades`, { id, propiedades });
  if (resultado.records.length !== 1) throw new Error('Falta el nodo aplicado.');
  const existentes = resultado.records[0].get('propiedades');
  if (Object.entries(propiedades).some(([k, v]) => existentes[k] !== v)) throw new Error('El nodo no coincide con su evento.');
  const vinculos = await tx.run(`MATCH (n:${clase} {${clave}: $id})
    OPTIONAL MATCH (n)-[:${relacion}]->(p:Espacio)
    RETURN collect(p.espacioId) AS padres`, { id });
  const padres = vinculos.records[0].get('padres') as string[];
  if (padres.length > 1 || (padres.length === 1 && padres[0] !== padre)) throw new Error('El vínculo del nodo no coincide.');
  if (padre && !padres.length) {
    if (!crear) throw new Error('Falta el vínculo aplicado.');
    await tx.run(`MATCH (n:${clase} {${clave}: $id}), (p:Espacio {espacioId: $padre})
      MERGE (n)-[:${relacion}]->(p)`, { id, padre });
  }
}

export async function asegurarExtremos(tx: ManagedTransaction, cambio: Objeto) {
  // Los eventos históricos no incluyen snapshots y conservan su tratamiento.
  if (cambio.origen === undefined) return;
  const conexion = objeto(cambio.despues ?? cambio.conexion);
  const origen = validarNodo(cambio.origen, 'Componente');
  const clase = conexion.componente_destino_id ? 'Componente' : 'Espacio';
  const valor = clase === 'Componente' ? cambio.destinoComponente : cambio.destinoEspacio;
  const destino = validarNodo(valor, clase);
  if (origen.id !== conexion.componente_origen_id || destino.id !== (conexion.componente_destino_id ?? conexion.espacio_destino_id)) {
    throw new Error('Los extremos no coinciden con la conexión.');
  }
  await asegurarNodo(tx, cambio.origen, 'Componente');
  await asegurarNodo(tx, valor, clase);
}

export async function aplicarAlta(sesion: Session, evento: Evento) {
  const cambio = objeto(evento.datos.cambio);
  const clase = cambio.operacion === 'CREAR_ESPACIO' ? 'Espacio' : 'Componente';
  const valor = clase === 'Espacio' ? cambio.espacio : cambio.componente;
  validarNodo(valor, clase);
  if (!Number.isSafeInteger(evento.datos.versionRed) || BigInt(evento.datos.versionRed as number) !== BigInt(evento.secuencia)) {
    throw new Error('Versión de alta inválida.');
  }
  await sesion.executeWrite(async (tx) => {
    const control = await tx.run(`MATCH (c:ControlRed {id: 'red-principal', estado: 'INICIALIZADO'})
      OPTIONAL MATCH (e:EventoAplicado {eventoId: $id})
      RETURN toString(c.versionAplicada) AS version, toString(e.secuencia) AS aplicada`, { id: evento.evento_id });
    if (control.records.length !== 1) throw new Error('Falta el control de red.');
    const registro = control.records[0];
    const aplicado = registro.get('aplicada') !== null;
    if (registro.get('version') !== (aplicado ? evento.secuencia : (BigInt(evento.secuencia) - 1n).toString())
      || (aplicado && registro.get('aplicada') !== evento.secuencia)) throw new Error('Secuencia de alta incorrecta.');
    await asegurarNodo(tx, valor, clase, !aplicado);
    if (!aplicado) await tx.run(`MATCH (c:ControlRed {id: 'red-principal'})
      CREATE (:EventoAplicado {eventoId: $id, secuencia: $version, aplicadoEn: datetime()})
      SET c.versionAplicada = $version`, { id: evento.evento_id, version: neo4j.int(evento.secuencia) });
  });
}
