import { useMemo } from 'react'
import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from '@xyflow/react'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import { Building2, CircleGauge, Cylinder, GitFork, Pipette, SlidersHorizontal, Waypoints } from 'lucide-react'
import '@xyflow/react/dist/style.css'
import type { AlcanceRed, NodoRed, SnapshotRed } from '../api/dominio'
import { etiqueta } from '../operaciones'
import { altoNodo, anchoNodo, distribuir } from './layout'

type NodoDiagrama = Node<{ entidad: NodoRed; resaltado: boolean; seleccionar: (id: string) => void }, 'red'>

const iconos = {
  CISTERNA: Cylinder, MEDIDOR: CircleGauge, UNION: GitFork, VALVULA: SlidersHorizontal, TUBERIA: Pipette,
}

function TarjetaNodo({ data, selected }: NodeProps<NodoDiagrama>) {
  const { entidad, resaltado, seleccionar } = data
  const Icono = entidad.clase === 'ESPACIO' ? Building2 : iconos[entidad.tipo as keyof typeof iconos] ?? Waypoints
  return (
    <div className="nodo-red" data-clase={entidad.clase} data-resaltado={resaltado} data-elegido={selected} title={entidad.nombre}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <button type="button" className="boton-nodo nodrag nopan" aria-pressed={selected}
        onClick={() => seleccionar(entidad.id)}>
        <span className="icono-nodo"><Icono size={17} aria-hidden="true" /></span>
        <span className="texto-nodo">
          <b>{entidad.clase === 'COMPONENTE' ? entidad.codigo : etiqueta(entidad.tipo)}</b>
          <span>{entidad.nombre}</span>
        </span>
      </button>
      {entidad.clase === 'COMPONENTE' && <Handle type="source" position={Position.Right} isConnectable={false} />}
    </div>
  )
}

const tipos = { red: TarjetaNodo }

export default function Diagrama({ red, alcance, seleccionado, alSeleccionar }: {
  red: SnapshotRed
  alcance?: AlcanceRed
  seleccionado: string | null
  alSeleccionar: (id: string) => void
}) {
  const posiciones = useMemo(() => distribuir(red), [red])
  const nodosMarcados = new Set(alcance?.nodoIds)
  const conexionesMarcadas = new Set(alcance?.conexionIds)
  const nodos: NodoDiagrama[] = red.nodos.map((entidad) => ({
    id: entidad.id,
    type: 'red',
    data: { entidad, resaltado: nodosMarcados.has(entidad.id), seleccionar: alSeleccionar },
    position: posiciones.get(entidad.id)!,
    width: anchoNodo, height: altoNodo,
    selected: seleccionado === entidad.id,
    ariaLabel: entidad.clase === 'COMPONENTE' ? `${entidad.codigo}, ${entidad.nombre}` : entidad.nombre,
  }))
  const conexiones: Edge[] = red.conexiones.map(({ id, origen, destino }) => {
    const destacado = conexionesMarcadas.has(id)
    const color = destacado ? '#127a6e' : '#8caaae'
    return {
      id, source: origen, target: destino, type: 'smoothstep', selectable: false,
      className: destacado ? 'conexion-activa' : undefined,
      style: { stroke: color, strokeWidth: destacado ? 3.2 : 1.65, opacity: alcance && !destacado ? 0.5 : 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
      zIndex: destacado ? 1 : 0,
    }
  })

  return (
    <div className="lienzo" aria-label="Diagrama de la red de agua">
      <ReactFlow nodes={nodos} edges={conexiones} nodeTypes={tipos}
        fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.27} maxZoom={2}
        nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false}
        deleteKeyCode={null} multiSelectionKeyCode={null} selectionKeyCode={null}
        nodesFocusable={false} edgesFocusable={false}
        ariaLabelConfig={{
          'controls.ariaLabel': 'Controles del diagrama',
          'controls.zoomIn.ariaLabel': 'Acercar', 'controls.zoomOut.ariaLabel': 'Alejar',
          'controls.fitView.ariaLabel': 'Ajustar a la vista',
        }}>
        <Background gap={18} size={1.2} color="#cbdcde" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
