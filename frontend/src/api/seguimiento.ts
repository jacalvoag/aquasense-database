import { useEffect, useState } from 'react'
import { solicitar } from './cliente'
import type { EventoReporte } from './dominio'

type Seguimiento = { clave: string; eventos: EventoReporte[]; fin: boolean; agotado: boolean; error?: Error }

export function useSeguimiento(id: string, documental: string | null, grafo: string | null, vigilar: boolean) {
  const [intento, setIntento] = useState(0)
  const [estado, setEstado] = useState<Seguimiento | null>(null)
  const clave = [id, documental, grafo, intento].join('/')
  useEffect(() => {
    const ids = [documental, grafo].filter((valor): valor is string => Boolean(valor))
    if (!vigilar || ids.length === 0) return
    const control = new AbortController()
    let eventos: EventoReporte[] = []
    let siguiente: number | undefined
    const limite = window.setTimeout(() => {
      window.clearTimeout(siguiente)
      control.abort()
      setEstado({ clave, eventos, fin: false, agotado: true })
    }, 60_000)
    async function comprobar() {
      try {
        eventos = await Promise.all(ids.map((evento) =>
          solicitar<EventoReporte>(`/reportes/${id}/eventos/${evento}`, { signal: control.signal })))
        if (control.signal.aborted) return
        const fin = eventos.every((evento) => evento.estado !== 'PENDIENTE')
        setEstado({ clave, eventos, fin, agotado: false })
        if (fin) window.clearTimeout(limite)
        else siguiente = window.setTimeout(() => { void comprobar() }, 5_000)
      } catch (error) {
        if (control.signal.aborted) return
        window.clearTimeout(limite)
        setEstado({ clave, eventos, fin: false, agotado: false, error: error as Error })
      }
    }
    void comprobar()
    return () => {
      control.abort()
      window.clearTimeout(siguiente)
      window.clearTimeout(limite)
    }
  }, [id, documental, grafo, vigilar, clave])
  return { actual: estado?.clave === clave ? estado : null, reanudar: () => setIntento((valor) => valor + 1) }
}
