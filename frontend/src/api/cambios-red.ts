import { useEffect, useState } from 'react'
import { solicitar } from './cliente'
import type { EstadoEvento } from './dominio'

type EventoRed = { eventoId: string; estado: EstadoEvento; intentos: number; secuencia: string }
export function useCambioRed() {
  const [eventoId, seguir] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [resultado, setResultado] = useState<{ id: string; evento?: EventoRed; error?: Error; agotado?: boolean } | null>(null)
  useEffect(() => {
    if (!eventoId) return
    const id = eventoId
    const control = new AbortController()
    let siguiente: number | undefined
    const limite = window.setTimeout(() => {
      control.abort()
      window.clearTimeout(siguiente)
      setResultado({ id, agotado: true })
    }, 60_000)
    async function consultar() {
      try {
        const evento = await solicitar<EventoRed>(`/red/eventos/${id}`, { signal: control.signal })
        if (control.signal.aborted) return
        setResultado({ id, evento })
        if (evento.estado === 'PENDIENTE') siguiente = window.setTimeout(() => { void consultar() }, 2_000)
        else {
          window.clearTimeout(limite)
        }
      } catch (error) {
        if (!control.signal.aborted) {
          window.clearTimeout(limite)
          setResultado({ id, error: error as Error })
        }
      }
    }
    void consultar()
    return () => { control.abort(); window.clearTimeout(siguiente); window.clearTimeout(limite) }
  }, [eventoId, intento])
  const actual = resultado?.id === eventoId ? resultado : null
  return { eventoId, actual, seguir, pendiente: !!eventoId && actual?.evento?.estado !== 'PROCESADO',
    reanudar: () => setIntento((n) => n + 1) }
}

