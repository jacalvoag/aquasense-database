import { useMemo } from 'react'
import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from '@xyflow/react'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { AlcanceRed, NodoRed, SnapshotRed } from '../api/dominio'
import { etiqueta } from '../operaciones'
import { altoNodo, anchoNodo, distribuir } from './layout'
import { FiguraNodo } from './FiguraNodo'
import './red.css'

type NodoDiagrama = Node<{ entidad: NodoRed; resaltado: boolean; atenuado: boolean; seleccionar: (id: string) => void }, 'red'>
type NodoSector = Node<{ titulo: string }, 'sector'>

function SectorRed({ data }: NodeProps<NodoSector>) {
  return <div className="sector-red"><h3>{data.titulo}</h3></div>
}

function NodoIlustrado({ data, selected }: NodeProps<NodoDiagrama>) {
  const { entidad, resaltado, atenuado, seleccionar } = data
  return (
    <div className="nodo-ilustrado" data-clase={entidad.clase} data-resaltado={resaltado}
      data-elegido={selected} data-atenuado={atenuado} title={entidad.nombre}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <button type="button" className="figura-boton nodrag nopan" aria-pressed={selected}
        aria-label={entidad.clase === 'COMPONENTE' ? `${entidad.codigo}, ${entidad.nombre}` : entidad.nombre}
        onClick={() => seleccionar(entidad.id)}>
        <FiguraNodo nodo={entidad} />
        <span className="figura-etiqueta">
          <b>{entidad.clase === 'COMPONENTE' ? entidad.codigo : etiqueta(entidad.tipo)}</b>
          <span>{entidad.nombre}</span>
        </span>
      </button>
      {entidad.clase === 'COMPONENTE' && <Handle type="source" position={Position.Right} isConnectable={false} />}
    </div>
  )
}

const tipos = { red: NodoIlustrado, sector: SectorRed }

export default function Diagrama({ red, alcance, seleccionado, alSeleccionar }: {
  red: SnapshotRed
  alcance?: AlcanceRed
  seleccionado: string | null
  alSeleccionar: (id: string) => void
}) {
  const { posiciones, sectores } = useMemo(() => distribuir(red), [red])
  const nodosMarcados = new Set(alcance?.nodoIds)
  const conexionesMarcadas = new Set(alcance?.conexionIds)
  const nodos: NodoDiagrama[] = red.nodos.map((entidad) => ({
    id: entidad.id,
    type: 'red',
    data: { entidad, resaltado: nodosMarcados.has(entidad.id),
      atenuado: Boolean(alcance) && !nodosMarcados.has(entidad.id) && seleccionado !== entidad.id, seleccionar: alSeleccionar },
    position: posiciones.get(entidad.id)!,
    width: anchoNodo, height: altoNodo,
    selected: seleccionado === entidad.id,
    ariaLabel: entidad.clase === 'COMPONENTE' ? `${entidad.codigo}, ${entidad.nombre}` : entidad.nombre,
  }))
  const fondos: NodoSector[] = sectores.map(({ id, titulo, x, y, ancho, alto }) => ({
    id, type: 'sector', data: { titulo }, position: { x, y },
    style: { width: ancho, height: alto }, width: ancho, height: alto,
    selectable: false, focusable: false, draggable: false, zIndex: -1,
  }))
  const conexiones: Edge[] = red.conexiones.map(({ id, origen, destino }) => {
    const destacado = conexionesMarcadas.has(id)
    const color = destacado ? '#159887' : '#7da4b7'
    return {
      id, source: origen, target: destino, type: 'smoothstep', selectable: false,
      className: destacado ? 'conexion-activa' : undefined,
      style: { stroke: color, strokeWidth: destacado ? 5 : 3, opacity: alcance && !destacado ? 0.3 : 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 13, height: 13 },
      zIndex: destacado ? 1 : 0,
    }
  })

  return (
    <div className="lienzo" aria-label="Diagrama de la red de agua">
      <ReactFlow nodes={[...fondos, ...nodos]} edges={conexiones} nodeTypes={tipos}
        forceColorMode="light" fitView fitViewOptions={{ padding: 0.07 }} minZoom={0.2} maxZoom={2}
        nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false}
        deleteKeyCode={null} multiSelectionKeyCode={null} selectionKeyCode={null}
        nodesFocusable={false} edgesFocusable={false}
        ariaLabelConfig={{
          'controls.ariaLabel': 'Controles del diagrama',
          'controls.zoomIn.ariaLabel': 'Acercar', 'controls.zoomOut.ariaLabel': 'Alejar',
          'controls.fitView.ariaLabel': 'Ajustar a la vista',
        }}>
        <Background gap={20} size={1} color="#c6dce7" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
