export function configurar(api, sincronizador) {
  const comunes = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD',
    'MONGODB_URI', 'MONGODB_DATABASE', 'NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'NEO4J_DATABASE'];
  for (const [nombre, valores] of [['api/.env', api], ['sincronizador/.env', sincronizador]]) {
    const faltantes = comunes.filter((clave) => !valores[clave]?.trim());
    if (faltantes.length) throw new Error(nombre + ': faltan ' + faltantes.join(', ') + '.');
  }
  if (!api.API_OPERATOR_USER?.trim() || !api.API_OPERATOR_PASSWORD?.trim() || api.API_OPERATOR_PASSWORD === 'CAMBIAR') {
    throw new Error('Configura API_OPERATOR_USER y una API_OPERATOR_PASSWORD propia en api/.env.');
  }
  if (api.API_OPERATOR_USER.includes(':')) throw new Error('API_OPERATOR_USER no puede incluir dos puntos.');
  function puerto(valor, nombre) {
    if (!/^\d+$/.test(String(valor)) || Number(valor) < 1 || Number(valor) > 65535) throw new Error(nombre + ' debe ser un puerto válido.');
    return Number(valor);
  }
  const apiPuerto = puerto(api.PORT || '3000', 'PORT');
  if (apiPuerto === 5173) throw new Error('La API y Vite necesitan puertos distintos; 5173 está reservado al frontend.');
  const host = (valor) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(valor.toLowerCase()) ? 'local' : valor.toLowerCase();
  function destinoUri(valor, nombre, protocolos, predeterminado) {
    let uri;
    try { uri = new URL(valor); } catch { throw new Error(nombre + ' no tiene una URI válida.'); }
    if (!protocolos.includes(uri.protocol)) throw new Error(nombre + ' tiene un protocolo no admitido.');
    return [host(uri.hostname), puerto(uri.port || predeterminado, nombre)];
  }
  const destinos = (valores) => [
    host(valores.PGHOST), puerto(valores.PGPORT, 'PGPORT'), valores.PGDATABASE,
    ...destinoUri(valores.MONGODB_URI, 'MONGODB_URI', ['mongodb:', 'mongodb+srv:'], '27017'),
    valores.MONGODB_DATABASE,
    ...destinoUri(valores.NEO4J_URI, 'NEO4J_URI', ['bolt:', 'bolt+s:', 'bolt+ssc:', 'neo4j:', 'neo4j+s:', 'neo4j+ssc:'], '7687'),
    valores.NEO4J_DATABASE,
  ];
  if (JSON.stringify(destinos(api)) !== JSON.stringify(destinos(sincronizador))) {
    throw new Error('La API y el sincronizador deben apuntar a los mismos servidores, puertos y bases.');
  }
  const origenes = (api.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173').split(',').map((o) => o.trim());
  const frontendUrl = ['http://localhost:5173', 'http://127.0.0.1:5173'].find((o) => origenes.includes(o));
  if (!frontendUrl) throw new Error('CORS_ORIGINS debe incluir http://localhost:5173 o http://127.0.0.1:5173.');
  return { apiPuerto, apiUrl: 'http://127.0.0.1:' + apiPuerto, frontendUrl };
}
