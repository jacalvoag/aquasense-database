const base = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/+$/, '')

export type CredencialOperador = { usuario: string; clave: string }

export class ErrorApi extends Error {
  readonly estado: number

  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
  }
}

export async function solicitar<T>(ruta: string, opciones: {
  signal?: AbortSignal
  escritura?: { credencial: CredencialOperador; cuerpo?: unknown }
} = {}): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' })
  const { escritura, signal } = opciones
  if (escritura) {
    const { usuario, clave } = escritura.credencial
    const bytes = new TextEncoder().encode(`${usuario}:${clave}`)
    headers.set('Authorization', `Basic ${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))}`)
    if (escritura.cuerpo !== undefined) headers.set('Content-Type', 'application/json')
  }

  const respuesta = await fetch(`${base}${ruta}`, {
    method: escritura ? 'POST' : 'GET',
    headers,
    signal,
    body: escritura?.cuerpo === undefined ? undefined : JSON.stringify(escritura.cuerpo),
  })
  const contenido = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    const mensaje: unknown = contenido?.message
    throw new ErrorApi(respuesta.status, typeof mensaje === 'string'
      ? mensaje
      : Array.isArray(mensaje) && mensaje.every((item) => typeof item === 'string')
        ? mensaje.join(' ')
        : `La API respondió con el código ${respuesta.status}.`)
  }
  return contenido as T
}
