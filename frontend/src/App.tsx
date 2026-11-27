import { Conexiones } from './paginas/Conexiones'
import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router'
import { Activity, ArrowUpRight, Building2, CircleGauge, Droplets, FileText, Home, Network, UserRound, Wrench } from 'lucide-react'
import { solicitar } from './api/cliente'
import type { CredencialOperador } from './api/cliente'
import type { FormEvent } from 'react'
import { Componentes, Espacios, Lecturas } from './paginas/Catalogos'
import { NuevoReporte, ReporteDetalle, Reportes } from './paginas/Reportes'
import { Red } from './paginas/Red'
import type { Componente, Lectura, Reporte } from './api/dominio'
import { fechaLocal, useConsulta } from './operaciones'
import { Aviso, EstadoLista } from './ui'

const secciones = [
  { ruta: '/reportes', nombre: 'Reportes', descripcion: 'Seguimiento de mantenimiento', icono: FileText },
  { ruta: '/red', nombre: 'Red de agua', descripcion: 'Conexiones y recorridos', icono: Network },
  { ruta: '/conexiones', nombre: 'Conexiones', descripcion: 'Crear y modificar ramales', icono: Network },
  { ruta: '/componentes', nombre: 'Componentes', descripcion: 'Tuberías, medidores y válvulas', icono: Wrench },
  { ruta: '/lecturas', nombre: 'Lecturas', descripcion: 'Registro y consumo de agua', icono: CircleGauge },
  { ruta: '/espacios', nombre: 'Espacios', descripcion: 'Lugares del campus', icono: Building2 },
]

const servicios = [
  { ruta: '/salud/postgres', nombre: 'PostgreSQL' },
  { ruta: '/salud/mongodb', nombre: 'MongoDB' },
  { ruta: '/salud/neo4j', nombre: 'Neo4j' },
]

function Inicio() {
  const [intento, setIntento] = useState(0)
  const [estados, setEstados] = useState<boolean[] | null>(null)
  const reportes = useConsulta<Reporte[]>('/reportes')
  const componentes = useConsulta<Componente[]>('/componentes')
  const lecturas = useConsulta<Lectura[]>('/lecturas')
  const ultimaLectura = lecturas.datos?.reduce<Lectura | null>((ultima, lectura) =>
    !ultima || Date.parse(lectura.fecha_hora) > Date.parse(ultima.fecha_hora) ? lectura : ultima, null)
  const metricas = [
    { clave: 'pendientes', titulo: 'Reportes pendientes', ruta: '/reportes', cargando: reportes.cargando,
      valor: reportes.error ? undefined : reportes.datos?.filter((r) => r.estado === 'PENDIENTE').length },
    { clave: 'atencion', titulo: 'Reportes en atención', ruta: '/reportes', cargando: reportes.cargando,
      valor: reportes.error ? undefined : reportes.datos?.filter((r) => r.estado === 'EN_ATENCION').length },
    { clave: 'activos', titulo: 'Componentes activos', ruta: '/componentes', cargando: componentes.cargando,
      valor: componentes.error ? undefined : componentes.datos?.filter((c) => c.estado === 'ACTIVO').length },
  ]
  function actualizarDatos() {
    reportes.recargar()
    componentes.recargar()
    lecturas.recargar()
    setEstados(null)
    setIntento((actual) => actual + 1)
  }
  useEffect(() => {
    const control = new AbortController()
    void Promise.allSettled(servicios.map(({ ruta }) =>
      solicitar<{ estado: string }>(ruta, { signal: control.signal })))
      .then((resultados) => {
        if (!control.signal.aborted) setEstados(resultados.map((resultado) =>
          resultado.status === 'fulfilled' && resultado.value?.estado === 'ok'))
      })
    return () => control.abort()
  }, [intento])

  return (
    <>
      <header className="cabecera inicio-cabecera">
        <p className="campus">Campus UPChiapas <span> / </span> Inicio</p>
        <h1>Operación de la red de agua</h1>
        <p>Consulta las lecturas y da seguimiento al mantenimiento del campus.</p>
      </header>
      <section className="resumen-inicio" aria-labelledby="resumen-titulo">
        <div className="fila resumen-cabecera">
          <div><span className="eyebrow">VISTA GENERAL</span><h2 id="resumen-titulo">Estado de la operación</h2></div>
          <button type="button" onClick={actualizarDatos}
            disabled={reportes.cargando || componentes.cargando || lecturas.cargando}>Actualizar datos</button>
        </div>
        <div className="resumen-metricas">
          {metricas.map((metrica) => <NavLink className="resumen-metrica" key={metrica.clave}
            data-metrica={metrica.clave} to={metrica.ruta} aria-busy={metrica.cargando}>
            <span>{metrica.titulo}</span>
            <strong aria-live="polite">{metrica.cargando ? '…' : metrica.valor ?? '—'}</strong>
            <small>Ver listado <ArrowUpRight size={14} aria-hidden="true" /></small>
          </NavLink>)}
        </div>
        {(reportes.error || componentes.error) &&
          <Aviso error>Algunas cifras no están disponibles. Comprueba la conexión y actualiza los datos.</Aviso>}
        <p className="nota-resumen">Cifras obtenidas de los registros actuales. Los componentes activos incluyen los registrados sin conexiones.</p>
      </section>
      <div className="inicio-columnas">
      <section className="inicio-accesos" aria-labelledby="accesos-titulo">
        <div className="seccion-titulo"><div><span className="eyebrow">AQUASENSE</span><h2 id="accesos-titulo">Explorar</h2></div></div>
        <div className="tarjetas">
          {secciones.map(({ ruta, nombre, descripcion, icono: Icono }) => (
            <NavLink className="tarjeta-acceso" key={ruta} to={ruta}>
              <span className="tarjeta-icono"><Icono size={23} strokeWidth={1.8} /></span>
              <span className="tarjeta-flecha"><ArrowUpRight size={17} /></span>
              <span className="tarjeta-contenido"><strong>{nombre}</strong><small>{descripcion}</small></span>
            </NavLink>
          ))}
        </div>
        <section className="panel lectura-reciente" aria-labelledby="lectura-titulo">
          <div className="fila"><h2 id="lectura-titulo">Lectura más reciente</h2><NavLink to="/lecturas">Ver lecturas</NavLink></div>
          <EstadoLista consulta={lecturas} vacio={lecturas.datos?.length === 0 ? 'Aún no hay lecturas registradas.' : undefined}>
            {ultimaLectura && <dl className="lectura-resumen">
              <div><dt>Medidor</dt><dd>{ultimaLectura.codigo_medidor}</dd></div>
              <div><dt>Fecha de lectura</dt><dd>{fechaLocal(ultimaLectura.fecha_hora)}</dd></div>
              <div><dt>Acumulado</dt><dd>{ultimaLectura.valor_acumulado} m³</dd></div>
              <div><dt>Consumo del intervalo</dt><dd>{ultimaLectura.consumo_m3 === null ? 'Sin lectura anterior' : ultimaLectura.consumo_m3 + ' m³'}</dd></div>
            </dl>}
          </EstadoLista>
        </section>
      </section>
      <section className="panel estado-panel" aria-labelledby="estado-titulo">
        <div className="fila">
          <div><span className="eyebrow">ESTADO DEL SISTEMA</span><h2 id="estado-titulo">Conexiones</h2></div>
          <Activity size={19} aria-hidden="true" />
        </div>
        <ul className="servicios" aria-live="polite">
          {servicios.map(({ nombre }, i) => (
            <li key={nombre}>
              <strong>{nombre}</strong>
              <span data-estado={estados?.[i] ? 'ok' : estados ? 'error' : 'carga'}>
                {estados === null ? 'Comprobando…' : estados[i] ? 'Disponible' : 'Sin conexión'}
              </span>
            </li>
          ))}
        </ul>
        <button className="comprobar" type="button" disabled={estados === null} onClick={() => {
          setEstados(null)
          setIntento((actual) => actual + 1)
        }}>Comprobar de nuevo</button>
      </section>
      </div>
    </>
  )
}

function AccesoOperador({ credencial, cambiar }: {
  credencial: CredencialOperador | null
  cambiar: (valor: CredencialOperador | null) => void
}) {
  const [abierto, setAbierto] = useState(false)
  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const datos = new FormData(evento.currentTarget)
    const usuario = String(datos.get('usuario')).trim()
    const clave = String(datos.get('clave'))
    if (!usuario || !clave) return
    cambiar({ usuario, clave })
    evento.currentTarget.reset()
    setAbierto(false)
  }

  return (
    <aside className="acceso">
      {credencial ? (
        <>
          <span>{credencial.usuario} · Credencial en memoria</span>
          <button type="button" onClick={() => cambiar(null)}>Salir</button>
        </>
      ) : (
        <>
          <button id="acceso-operador" className="acceso-boton" type="button" aria-expanded={abierto} aria-controls="credencial"
            onClick={() => setAbierto((actual) => !actual)}><UserRound size={18} />Acceso de operador</button>
          {abierto && (
            <form id="credencial" className="credencial panel" onSubmit={guardar}>
              <label>Usuario<input name="usuario" required pattern="[^:]+" autoComplete="username" /></label>
              <label>Clave<input name="clave" type="password" required autoComplete="current-password" /></label>
              <p>La API comprobará la credencial al enviar una operación.</p>
              <button type="submit">Continuar</button>
            </form>
          )}
        </>
      )}
    </aside>
  )
}

export default function App() {
  const [credencial, cambiarCredencial] = useState<CredencialOperador | null>(null)
  return (
    <BrowserRouter>
      <a className="salto" href="#contenido">Saltar al contenido</a>
      <div className="aplicacion">
      <header className="barra">
        <NavLink className="marca" to="/" end><span className="marca-icono"><Droplets size={21} /></span><span>AquaSense<small>Red de agua</small></span></NavLink>
        <p className="nav-etiqueta">NAVEGACIÓN</p>
        <nav aria-label="Navegación principal">
          <NavLink to="/" end><Home size={19} />Inicio</NavLink>
          {secciones.map(({ ruta, nombre, icono: Icono }) => <NavLink key={ruta} to={ruta}><Icono size={19} />{nombre}</NavLink>)}
        </nav>
        <div className="barra-pie"><span className="barra-campus">UPChiapas <small>Campus universitario</small></span>
        <AccesoOperador credencial={credencial} cambiar={cambiarCredencial} />
        </div>
      </header>
      <main id="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/reportes/nuevo" element={<NuevoReporte credencial={credencial} />} />
          <Route path="/reportes/:id" element={<ReporteDetalle credencial={credencial} />} />
          <Route path="/componentes" element={<Componentes credencial={credencial} />} />
          <Route path="/lecturas" element={<Lecturas credencial={credencial} />} />
          <Route path="/espacios" element={<Espacios credencial={credencial} />} />
          <Route path="/conexiones" element={<Conexiones credencial={credencial} />} />
          <Route path="/red" element={<Red />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      </div>
    </BrowserRouter>
  )
}
