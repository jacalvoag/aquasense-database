import { contexto } from '../contexto'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { List, Network, RotateCw } from 'lucide-react'
import { Link } from 'react-router'
import { ErrorApi, solicitar } from '../api/cliente'
import type { AlcanceRed, Espacio, NodoRed, SnapshotRed } from '../api/dominio'
import { Aviso, Badge, EstadoLista } from '../ui'
import { etiqueta, motivo, useConsulta } from '../operaciones'
import { FiguraNodo } from '../red/FiguraNodo'
import '../red/red.css'

const Diagrama = lazy(() => import('../red/Diagrama'))

function PanelNodo({ nodo, alcance, buscando, error }: {
  nodo?: NodoRed; alcance?: AlcanceRed; buscando: boolean; error?: string
}) {
  const espacios = useConsulta<Espacio[]>(nodo?.clase === 'COMPONENTE' && nodo.espacioId ? '/espacios' : null)
  if (!nodo) return <aside className="panel detalle-red"><h2>Explora la red</h2><p className="seleccion-vacia">Selecciona una figura para consultar sus datos y los espacios que se encuentran aguas abajo.</p></aside>
  return (
    <aside className="panel detalle-red" aria-label="Detalle del nodo" aria-live="polite">
      <p className="detalle-identidad">{nodo.clase === 'COMPONENTE' ? 'Componente seleccionado' : 'Espacio seleccionado'}</p>
      <div className="detalle-figura"><FiguraNodo nodo={nodo} /></div>
      <div className="fila">
        <h2 className="detalle-codigo">{nodo.clase === 'COMPONENTE' ? nodo.codigo : etiqueta(nodo.tipo)}</h2>
        <Badge valor={nodo.tipo} />
      </div>
      <p className="detalle-nombre">{nodo.nombre}</p>
      {nodo.clase === 'COMPONENTE' && <>
        <dl>
          <div><dt>Estado</dt><dd><Badge valor={nodo.estado} /></dd></div>
          <div><dt>Ubicación</dt><dd>{espacios.datos?.find((e) => e.espacio_id === nodo.espacioId)?.nombre
            ?? (espacios.cargando ? 'Consultando…' : nodo.espacioId ? 'Sin información disponible' : 'Sin ubicación registrada')}</dd></div>
        </dl>
        <h3>Espacios aguas abajo</h3>
        {buscando && <Aviso>Consultando recorrido…</Aviso>}
        {error && <Aviso error>{error}</Aviso>}
        {alcance && (alcance.espacios.length ? <ul className="espacios-alcanzables">
          {alcance.espacios.map((espacio) => <li key={espacio.espacioId}><strong>{espacio.nombre}</strong><small>{etiqueta(espacio.tipo)}</small></li>)}
        </ul> : <p>No hay espacios alcanzables desde este componente.</p>)}
      </>}
      <Link className="boton crear-reporte-red" to="/reportes/nuevo">Crear reporte</Link>
    </aside>
  )
}

export function Red() {
  const [controlRed, setControlRed] = useState<{ pendientes: number; errores: number } | null>(null)
  const [errorControl, setErrorControl] = useState(false)
  const actualizando = useRef(false)
  const versionVisible = useRef<string | undefined>(undefined)
  const [vista, setVista] = useState<'diagrama' | 'lista'>(() => matchMedia('(max-width: 680px)').matches ? 'lista' : 'diagrama')
  const [nodoId, setNodoId] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [snapshot, setSnapshot] = useState<{ intento: number; datos?: SnapshotRed; error?: Error } | null>(null)
  const [seleccion, setSeleccion] = useState<{ clave: string; datos?: AlcanceRed; error?: string } | null>(null)
  const versionReintentada = useRef<string | null>(null)
  const red = snapshot?.intento === intento ? snapshot.datos : undefined
  const error = snapshot?.intento === intento ? snapshot.error : undefined
  const cargando = snapshot?.intento !== intento
  const nodo = red?.nodos.find((e) => e.id === nodoId)
  const clave = `${intento}/${nodo?.id ?? ''}`
  const alcance = seleccion?.clave === clave ? seleccion.datos : undefined
  const errorAlcance = seleccion?.clave === clave ? seleccion.error : undefined

  useEffect(() => { versionVisible.current = red?.versionRed }, [red])
  useEffect(() => {
    const control = new AbortController()
    let siguiente: number | undefined
    async function comprobar() {
      try {
        const estado = await solicitar<{ versionRed: string; pendientes: number; errores: number }>('/red/estado', {
          signal: AbortSignal.any([control.signal, AbortSignal.timeout(8_000)]),
        })
        if (control.signal.aborted) return
        setControlRed(estado)
        setErrorControl(false)
        if (!estado.pendientes && !estado.errores && !actualizando.current && estado.versionRed !== versionVisible.current) setIntento((n) => n + 1)
      } catch { if (!control.signal.aborted) setErrorControl(true) }
      if (!control.signal.aborted) siguiente = window.setTimeout(() => { void comprobar() }, 2_000)
    }
    void comprobar()
    return () => { control.abort(); window.clearTimeout(siguiente) }
  }, [])

  useEffect(() => {
    const control = new AbortController()
    actualizando.current = true
    solicitar<SnapshotRed>('/red', { signal: control.signal })
      .then((datos) => {
        if (control.signal.aborted) return
        setSnapshot({ intento, datos })
        setNodoId((id) => datos.nodos.some((nodo) => nodo.id === id) ? id : null)
      })
      .catch((error: Error) => { if (!control.signal.aborted) setSnapshot({ intento, error }) })
      .finally(() => { if (!control.signal.aborted) actualizando.current = false })
    return () => control.abort()
  }, [intento])

  useEffect(() => {
    if (!red || nodo?.clase !== 'COMPONENTE') return
    const control = new AbortController()
    solicitar<AlcanceRed>(`/red/componentes/${nodo.entidadId}/alcance`, { signal: control.signal })
      .then((datos) => {
        if (control.signal.aborted) return
        if (red.versionRed !== datos.versionRed) {
          if (versionReintentada.current === nodo.id) {
            setSeleccion({ clave, error: 'La versión de la red sigue cambiando. Actualiza para volver a consultar.' })
          } else {
            versionReintentada.current = nodo.id
            setIntento((valor) => valor + 1)
          }
          return
        }
        setSeleccion({ clave, datos })
      })
      .catch((error: Error) => {
        if (control.signal.aborted) return
        if (error instanceof ErrorApi && error.estado === 503) {
          setSnapshot({ intento, error })
          return
        }
        setSeleccion({ clave, error: motivo(error) })
      })
    return () => control.abort()
  }, [red, nodo, clave, intento])

  function elegir(id: string | null) {
    if (id === nodoId) return
    versionReintentada.current = null
    setSeleccion(null)
    setNodoId(id)
  }

  function actualizar() {
    versionReintentada.current = null
    setIntento((valor) => valor + 1)
  }

  return (
    <>
      <div className="encabezado">
        <div><p className="campus">{contexto.escenario}</p><h1>Red de agua</h1></div>
        <div className="acciones"><Link className="boton" to="/conexiones">Administrar conexiones</Link><Link className="boton" to="/componentes">Catálogo de componentes</Link></div>
      </div>
      <div className="panel barra-red">
        <div className="fila">
          <div className="segmentado" aria-label="Vista de red">
            <button type="button" onClick={() => setVista('diagrama')} aria-pressed={vista === 'diagrama'}><Network size={16} />Diagrama</button>
            <button type="button" onClick={() => setVista('lista')} aria-pressed={vista === 'lista'}><List size={16} />Lista</button>
          </div>
          <div className="acciones">
            {red && <small>Versión {red.versionRed} · {red.nodos.length} nodos · {red.conexiones.length} conexiones</small>}
            <button type="button" onClick={actualizar} disabled={cargando}><RotateCw size={15} />Actualizar red</button>
            <button type="button" onClick={() => elegir(null)} disabled={!nodoId}>Limpiar selección</button>
          </div>
        </div>
      </div>
      <p className="ayuda-formulario">La red comprueba los cambios cada dos segundos. Los registros sin conexiones se consultan en los catálogos.</p>
      {errorControl && <Aviso error>No fue posible comprobar el estado actual de la red. Se volverá a intentar automáticamente.</Aviso>}
      {!!controlRed?.pendientes && <Aviso>Hay {controlRed.pendientes} cambios pendientes. El diagrama volverá a mostrarse al confirmar la sincronización.</Aviso>}
      {!!controlRed?.errores && <Aviso error>Hay cambios de red con error. Solicita revisar el sincronizador antes de continuar.</Aviso>}
      <EstadoLista consulta={{ cargando, error, recargar: actualizar }} vacio={red?.nodos.length === 0 ? 'La red sincronizada no tiene conexiones.' : undefined}>
        {red && !errorControl && !controlRed?.pendientes && !controlRed?.errores && <div className="explorador">
          <section className="panel panel-red">
            {vista === 'diagrama' ? <>
              <Suspense fallback={<Aviso>Cargando diagrama…</Aviso>}>
                <Diagrama red={red} seleccionado={nodo?.id ?? null} alcance={alcance} alSeleccionar={elegir} />
              </Suspense>
              <div className="leyenda leyenda-red">
                <span><i />Conexión de agua</span><span><i className="marca-alcance" />Recorrido aguas abajo</span><span><i className="marca-espacio" />Espacio</span>
                <small>Esquema de conexiones · Figuras simbólicas</small>
              </div>
            </> : <div className="lista-nodos">
              {red.nodos.map((n) => <button type="button" key={n.id} onClick={() => elegir(n.id)}
                aria-pressed={n.id === nodo?.id} data-resaltado={alcance?.nodoIds.includes(n.id) ?? false}>
                <span className="nodo-lista"><FiguraNodo nodo={n} /><span>
                  <strong>{n.clase === 'COMPONENTE' ? n.codigo : etiqueta(n.tipo)}</strong><small>{n.nombre}</small>
                </span></span>
              </button>)}
            </div>}
          </section>
          <PanelNodo nodo={nodo} alcance={alcance} error={errorAlcance}
            buscando={nodo?.clase === 'COMPONENTE' && seleccion?.clave !== clave} />
        </div>}
      </EstadoLista>
    </>
  )
}
