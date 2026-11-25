export type EstadoEvento = 'PENDIENTE' | 'PROCESADO' | 'ERROR'
export type EstadoReporte = 'PENDIENTE' | 'EN_ATENCION' | 'CERRADO'
export type TipoAtencion = 'INSPECCION' | 'REPARACION' | 'VERIFICACION'
export type Resultado = 'SIN_INDICIOS' | 'PERSISTE' | 'NO_CONCLUYENTE'

export interface Espacio {
  espacio_id: string
  nombre: string
  tipo: string
  espacio_contenedor_id: string | null
  descripcion: string | null
}

export interface Componente {
  componente_id: string
  codigo: string
  nombre: string
  tipo: string
  estado: string
  espacio_id: string | null
  espacio_nombre: string | null
  descripcion: string | null
  tiene_conexiones: boolean
}

export interface Lectura {
  lectura_id: string
  medidor_id: string
  codigo_medidor: string
  fecha_hora: string
  fecha_hora_anterior: string | null
  valor_acumulado: string
  valor_anterior: string | null
  consumo_m3: string | null
}

export interface Reporte {
  reporte_id: string
  espacio_id: string
  espacio_nombre: string
  estado: EstadoReporte
  registrado_en: string
  cerrado_en: string | null
  estado_evento_documental: EstadoEvento | null
  evento_documental_id: string | null
  evento_grafo_id: string | null
  estado_evento_grafo: EstadoEvento | null
}

export interface Atencion {
  atencionId: string
  tipo: TipoAtencion
  fecha: string
  descripcion: string
  componenteId?: string | null
  hallazgos?: string
  materiales?: string[]
  resultado?: Resultado
}

export interface Expediente {
  estadoDocumental: EstadoEvento
  expediente: {
    descripcionInicial: string
    referenciaUbicacion: string | null
    atenciones: Atencion[]
  } | null
}

export interface EventoReporte {
  eventoId: string
  destino: 'DOCUMENTAL' | 'GRAFO'
  estado: EstadoEvento
  intentos: number
}

export type EspacioAlcanzable = { espacioId: string; nombre: string; tipo: string }

export type NodoRed =
  | { id: string; clase: 'ESPACIO'; entidadId: string; nombre: string; tipo: string }
  | { id: string; clase: 'COMPONENTE'; entidadId: string; nombre: string; tipo: string;
      codigo: string; estado: string; espacioId: string | null }

export interface SnapshotRed {
  versionRed: string
  nodos: NodoRed[]
  conexiones: { id: string; origen: string; destino: string }[]
}

export interface AlcanceRed {
  componenteId: string
  versionRed: string
  nodoIds: string[]
  conexionIds: string[]
  espacios: EspacioAlcanzable[]
}
