import type { useCambioRed } from './api/cambios-red'
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

export function ConfirmacionRed({ cambio }: { cambio: ReturnType<typeof useCambioRed> }) {
  if (!cambio.eventoId) return null
  const estado = cambio.actual?.evento?.estado
  return <div className="confirmacion-red" aria-live="polite">
    {estado === 'PROCESADO' ? <Aviso>Cambio confirmado en la red. Ya puedes continuar.</Aviso>
      : estado === 'ERROR' ? <Aviso error>El cambio está guardado pero su sincronización falló. Solicita revisar el evento; no vuelvas a registrarlo.</Aviso>
      : cambio.actual?.error ? <Aviso error>{motivo(cambio.actual.error)} La operación ya fue registrada; vuelve a consultar su confirmación.</Aviso>
      : <Aviso>{cambio.actual?.agotado ? 'El cambio sigue sin confirmar. Revisa que el sincronizador esté encendido.' : 'Cambio guardado. Esperando confirmación del sincronizador…'}</Aviso>}
    {(cambio.actual?.agotado || cambio.actual?.error || estado === 'ERROR') &&
      <button type="button" onClick={cambio.reanudar}>Consultar confirmación</button>}
    <small>Evento: {cambio.eventoId}</small>
  </div>
}
