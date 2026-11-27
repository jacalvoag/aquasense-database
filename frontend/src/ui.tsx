import type { ReactNode } from 'react'
import { etiqueta, motivo } from './operaciones'
import type { EstadoConsulta, Operador, useEscritura } from './operaciones'

export function Badge({ valor }: { valor?: string | null }) {
  return <span className="badge" data-valor={valor ?? 'SIN_DATOS'}>{valor ? etiqueta(valor) : 'Sin datos'}</span>
}

export function Aviso({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p className={`aviso ${error ? 'aviso-error' : ''}`} role={error ? 'alert' : 'status'}>{children}</p>
}

export function AvisoEscritura({ aviso }: { aviso: ReturnType<typeof useEscritura>['aviso'] }) {
  return aviso && <Aviso error={aviso.error}>{aviso.texto}</Aviso>
}

export function EstadoLista({ consulta, vacio, children }: {
  consulta: EstadoConsulta<unknown> & { recargar: () => void }
  vacio?: string
  children: ReactNode
}) {
  if (consulta.cargando) return <Aviso>Cargando…</Aviso>
  if (consulta.error) return <><Aviso error>{motivo(consulta.error)}</Aviso><button type="button" onClick={consulta.recargar}>Reintentar</button></>
  return vacio ? <Aviso>{vacio}</Aviso> : children
}

export function RequiereOperador({ credencial }: Operador) {
  return !credencial && <Aviso>Para guardar cambios, ingresa tu credencial en <a href="#acceso-operador">Acceso de operador</a>. Los formularios se habilitarán al continuar.</Aviso>
}
