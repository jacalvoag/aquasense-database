import dagre from '@dagrejs/dagre'
import type { SnapshotRed } from '../api/dominio'

export const anchoNodo = 174
export const altoNodo = 80

export function distribuir(red: SnapshotRed) {
  const grafo = new dagre.graphlib.Graph({ multigraph: true })
  grafo.setGraph({ rankdir: 'LR', nodesep: 27, ranksep: 56, marginx: 16, marginy: 16 })
  grafo.setDefaultEdgeLabel(() => ({}))
  red.nodos.forEach(({ id }) => grafo.setNode(id, { width: anchoNodo, height: altoNodo }))
  red.conexiones.forEach(({ id, origen, destino }) => grafo.setEdge(origen, destino, {}, id))
  dagre.layout(grafo)
  return new Map(red.nodos.map(({ id }) => {
    const { x, y } = grafo.node(id)
    return [id, { x: x - anchoNodo / 2, y: y - altoNodo / 2 }]
  }))
}
