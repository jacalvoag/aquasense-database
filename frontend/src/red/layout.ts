import dagre from '@dagrejs/dagre'
import type { SnapshotRed } from '../api/dominio'

export const anchoNodo = 172
export const altoNodo = 176

interface Sector {
  id: string
  titulo: string
  x: number
  y: number
  ancho: number
  alto: number
}

export function distribuir(red: SnapshotRed) {
  // Separar redes desconectadas evita mezclar los ramales de distintas cisternas.
  // Los grupos se deducen de las conexiones; no dependen de códigos del campus.
  const vecinos = new Map(red.nodos.map(({ id }) => [id, new Set<string>()]))
  red.conexiones.forEach(({ origen, destino }) => {
    vecinos.get(origen)?.add(destino)
    vecinos.get(destino)?.add(origen)
  })
  const visitados = new Set<string>()
  const posiciones = new Map<string, { x: number; y: number }>()
  const sectores: Sector[] = []
  let inicioY = 16

  for (const nodo of red.nodos) {
    if (visitados.has(nodo.id)) continue
    const ids = new Set<string>()
    const pendientes = [nodo.id]
    while (pendientes.length) {
      const id = pendientes.pop()!
      if (visitados.has(id)) continue
      visitados.add(id)
      ids.add(id)
      vecinos.get(id)?.forEach((vecino) => {
        if (!visitados.has(vecino)) pendientes.push(vecino)
      })
    }

    const nodos = red.nodos.filter(({ id }) => ids.has(id))
    const conexiones = red.conexiones.filter(({ origen, destino }) => ids.has(origen) && ids.has(destino))
    const destinos = new Set(conexiones.map(({ destino }) => destino))
    const raiz = nodos.find((n) => !destinos.has(n.id) && n.clase === 'COMPONENTE' && ['CISTERNA', 'TANQUE'].includes(n.tipo))
      ?? nodos.find((n) => !destinos.has(n.id)) ?? nodo
    const grafo = new dagre.graphlib.Graph({ multigraph: true })
    grafo.setGraph({ rankdir: 'LR', nodesep: 18, ranksep: 30, marginx: 20, marginy: 0 })
    grafo.setDefaultEdgeLabel(() => ({}))
    nodos.forEach(({ id }) => grafo.setNode(id, { width: anchoNodo, height: altoNodo }))
    conexiones.forEach(({ id, origen, destino }) => grafo.setEdge(origen, destino, {}, id))
    dagre.layout(grafo)

    nodos.forEach(({ id }) => {
      const { x, y } = grafo.node(id)
      posiciones.set(id, { x: x - anchoNodo / 2, y: inicioY + 48 + y - altoNodo / 2 })
    })
    const { width, height } = grafo.graph()
    sectores.push({
      id: `sector:${nodo.id}`, titulo: raiz.clase === 'COMPONENTE' ? `${raiz.codigo} · ${raiz.nombre}` : raiz.nombre,
      x: 8, y: inicioY, ancho: width + 16, alto: height + 68,
    })
    inicioY += height + 90
  }

  const ancho = Math.max(0, ...sectores.map((sector) => sector.ancho))
  sectores.forEach((sector) => { sector.ancho = ancho })
  return { posiciones, sectores }
}
