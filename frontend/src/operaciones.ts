import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorApi, solicitar } from './api/cliente'
import type { CredencialOperador } from './api/cliente'

export type Operador = { credencial: CredencialOperador | null }

export type EstadoConsulta<T> = { datos?: T; error?: Error; cargando: boolean }

export function motivo(error: unknown) {
  return error instanceof ErrorApi ? error.message
    : error instanceof TypeError ? 'No se pudo comunicar con la API.'
    : error instanceof Error ? error.message : 'No se pudo completar la operación.'
}

export function useConsulta<T>(ruta: string | null) {
  const [intento, cambiarIntento] = useState(0)
  const [resultado, guardar] = useState<EstadoConsulta<T> & { ruta: string | null }>({ ruta: null, cargando: false })
  useEffect(() => {
    if (ruta === null) return
    const control = new AbortController()
    solicitar<T>(ruta, { signal: control.signal })
      .then((datos) => {
        if (!control.signal.aborted) guardar({ ruta, datos, cargando: false })
      })
      .catch((error: Error) => {
        if (!control.signal.aborted) guardar({ ruta, error, cargando: false })
      })
    return () => control.abort()
  }, [ruta, intento])

  return {
    ...(ruta !== null && resultado.ruta === ruta ? resultado : { datos: undefined, error: undefined, cargando: ruta !== null }),
    recargar() {
      guardar((actual) => ({ ...actual, ruta, error: undefined, cargando: ruta !== null }))
      cambiarIntento((valor) => valor + 1)
    },
  }
}

export function useEscritura(credencial: CredencialOperador | null) {
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null)
  const enCurso = useRef(false)
  const montado = useRef(false)

  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  async function enviar<T>(
    ruta: string, cuerpo: unknown, exito: string, alGuardar: (respuesta: T) => void,
  ) {
    if (!credencial || enCurso.current) return
    enCurso.current = true
    setOcupado(true)
    setAviso(null)
    try {
      const datos = await solicitar<T>(ruta, {
        escritura: { credencial, cuerpo },
        signal: AbortSignal.timeout(15_000),
      })
      if (montado.current) {
        alGuardar(datos)
        setAviso({ texto: exito, error: false })
      }
    } catch (error) {
      if (montado.current) {
        const incierto = error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')
        setAviso({
          error: true,
          texto: incierto
            ? 'No llegó la confirmación. Consulta el listado antes de volver a enviar la operación.'
            : motivo(error),
        })
      }
    } finally {
      enCurso.current = false
      if (montado.current) setOcupado(false)
    }
  }

  return { ocupado, aviso, enviar, invalidar: (texto: string) => setAviso({ texto, error: true }) }
}

const nombres: Record<string, string> = {
  PENDIENTE: 'Pendiente', PROCESADO: 'Procesado', ERROR: 'Error',
  EN_ATENCION: 'En atención', CERRADO: 'Cerrado', INSPECCION: 'Inspección',
  REPARACION: 'Reparación', VERIFICACION: 'Verificación', SIN_INDICIOS: 'Sin indicios',
  PERSISTE: 'Persiste', NO_CONCLUYENTE: 'No concluyente',
  TUBERIA: 'Tubería', UNION: 'Unión', VALVULA: 'Válvula', ZONA_RIEGO: 'Zona de riego',
}
export function etiqueta(valor: string) {
  return nombres[valor] ?? valor.toLowerCase().replaceAll('_', ' ').replace(/^./, (letra) => letra.toUpperCase())
}

export function fechaLocal(fecha?: string | null) {
  if (!fecha) return '—'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(fecha))
}

export function fechaFormularioAhora() {
  const ahora = new Date()
  return new Date(ahora.valueOf() - ahora.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function texto(datos: FormData, campo: string) {
  return String(datos.get(campo) ?? '').trim()
}

export function materiales(datos: FormData) {
  return texto(datos, 'materiales').split('\n').map((linea) => linea.trim()).filter(Boolean)
}

export function conFormulario(evento: FormEvent<HTMLFormElement>) {
  evento.preventDefault()
  return { form: evento.currentTarget, datos: new FormData(evento.currentTarget) }
}
