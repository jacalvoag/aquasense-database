import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router'
import { solicitar } from './api/cliente'
import type { CredencialOperador } from './api/cliente'
import type { FormEvent } from 'react'
import { Componentes, Espacios, Lecturas } from './paginas/Catalogos'
import { NuevoReporte, ReporteDetalle, Reportes } from './paginas/Reportes'
import { Red } from './paginas/Red'

const secciones = [
  { ruta: '/reportes', nombre: 'Reportes' },
  { ruta: '/red', nombre: 'Red de agua' },
  { ruta: '/componentes', nombre: 'Componentes' },
  { ruta: '/lecturas', nombre: 'Lecturas' },
  { ruta: '/espacios', nombre: 'Espacios' },
]

const servicios = [
  { ruta: '/salud/postgres', nombre: 'PostgreSQL' },
  { ruta: '/salud/mongodb', nombre: 'MongoDB' },
  { ruta: '/salud/neo4j', nombre: 'Neo4j' },
]

function Inicio() {
  const [intento, setIntento] = useState(0)
  const [estados, setEstados] = useState<boolean[] | null>(null)
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
      <header className="cabecera">
        <p className="campus">Campus UPChiapas</p>
        <h1>Operación de la red de agua</h1>
      </header>
      <section className="panel" aria-labelledby="estado-titulo">
        <div className="fila">
          <h2 id="estado-titulo">Conexión con la API</h2>
          <button type="button" disabled={estados === null} onClick={() => {
            setEstados(null)
            setIntento((actual) => actual + 1)
          }}>Comprobar de nuevo</button>
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
      </section>
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
          <button type="button" aria-expanded={abierto} aria-controls="credencial"
            onClick={() => setAbierto((actual) => !actual)}>Acceso de operador</button>
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
      <header className="barra">
        <NavLink className="marca" to="/" end>AquaSense</NavLink>
        <nav aria-label="Navegación principal">
          {secciones.map(({ ruta, nombre }) => <NavLink key={ruta} to={ruta}>{nombre}</NavLink>)}
        </nav>
        <AccesoOperador credencial={credencial} cambiar={cambiarCredencial} />
      </header>
      <main id="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/reportes/nuevo" element={<NuevoReporte credencial={credencial} />} />
          <Route path="/reportes/:id" element={<ReporteDetalle credencial={credencial} />} />
          <Route path="/componentes" element={<Componentes credencial={credencial} />} />
          <Route path="/lecturas" element={<Lecturas credencial={credencial} />} />
          <Route path="/espacios" element={<Espacios />} />
          <Route path="/red" element={<Red />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
