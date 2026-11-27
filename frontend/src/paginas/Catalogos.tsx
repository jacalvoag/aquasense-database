import { AltaEspacio, AltaComponente } from './AltasRed'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import type { Componente, Espacio, Lectura, EspacioAlcanzable } from '../api/dominio'
import { AvisoEscritura, Badge, EstadoLista, RequiereOperador } from '../ui'
import { conFormulario, etiqueta, fechaFormularioAhora, fechaLocal, texto, useConsulta, useEscritura } from '../operaciones'
import type { Operador } from '../operaciones'

export function OpcionesEspacios({ espacios }: { espacios?: Espacio[] }) {
  return <>{espacios?.map((espacio) => <option key={espacio.espacio_id} value={espacio.espacio_id}>{espacio.nombre}</option>)}</>
}

export function Espacios({ credencial }: Operador) {
  const consulta = useConsulta<Espacio[]>('/espacios')
  const espacios = consulta.datos ?? []
  const nombres = new Map(espacios.map((espacio) => [espacio.espacio_id, espacio.nombre]))
  return (
    <>
      <h1>Espacios</h1>
      <div className="columnas"><section className="panel"><h2>Catálogo de espacios</h2>
      <EstadoLista consulta={consulta} vacio={!espacios.length ? 'No hay espacios registrados.' : undefined}>
        <div className="tabla"><table>
          <thead><tr><th>Espacio</th><th>Tipo</th><th>Espacio contenedor</th><th>Descripción</th></tr></thead>
          <tbody>{espacios.map((espacio) => <tr key={espacio.espacio_id}>
            <th scope="row">{espacio.nombre}</th><td>{etiqueta(espacio.tipo)}</td>
            <td>{nombres.get(espacio.espacio_contenedor_id ?? '') ?? '—'}</td><td>{espacio.descripcion ?? '—'}</td>
          </tr>)}</tbody>
        </table></div>
      </EstadoLista>
      </section><AltaEspacio credencial={credencial} espacios={espacios} alGuardar={consulta.recargar} /></div>
    </>
  )
}

export function Componentes({ credencial }: Operador) {
  const consulta = useConsulta<Componente[]>('/componentes')
  const espacios = useConsulta<Espacio[]>('/espacios')
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const alcance = useConsulta<{ espacios: EspacioAlcanzable[] }>(seleccion ? `/componentes/${seleccion}/espacios-afectados` : null)
  const componentes = consulta.datos ?? []
  return (
    <>
      <div className="encabezado"><h1>Componentes</h1><Link className="boton" to="/red">Ver red de agua</Link></div>
      <div className="columnas">
        <section className="panel">
          <h2>Catálogo</h2>
          <EstadoLista consulta={consulta} vacio={!componentes.length ? 'No hay componentes.' : undefined}>
            <div className="tabla"><table>
              <thead><tr><th>Componente</th><th>Tipo</th><th>Ubicación</th><th>Estado</th><th>Conexión a la red</th></tr></thead>
              <tbody>{componentes.map((c) => <tr key={c.componente_id}>
                <th scope="row"><strong>{c.codigo}</strong><small>{c.nombre}</small></th>
                <td>{etiqueta(c.tipo)}</td><td>{c.espacio_nombre ?? '—'}</td>
                <td><Badge valor={c.estado} /></td>
                <td>{c.tiene_conexiones ? 'Con conexiones' : 'Sin conexiones'}
                  {c.tipo === 'TUBERIA' && c.estado === 'ACTIVO' && !c.tiene_conexiones &&
                    <small className="pista-catalogo">Disponible para conectar o reemplazar</small>}
                  {c.estado === 'ACTIVO' && !c.tiene_conexiones && <Link className="boton compacto" to={`/conexiones?origen=${c.componente_id}`}>Conectar {c.codigo}</Link>}
                  {c.estado === 'ACTIVO' && c.tiene_conexiones &&
                  <button className="compacto" type="button" aria-pressed={seleccion === c.componente_id} onClick={() => setSeleccion(c.componente_id)}>Ver alcance de {c.codigo}</button>}</td>
              </tr>)}</tbody>
            </table></div>
          </EstadoLista>
          {seleccion && <section className="bloque">
            <div className="fila"><h3>Alcance de {componentes.find((c) => c.componente_id === seleccion)?.codigo ?? 'componente'}</h3>
              <button type="button" onClick={() => setSeleccion(null)}>Ocultar</button></div>
            <EstadoLista consulta={alcance} vacio={alcance.datos?.espacios.length === 0 ? 'No se alcanzan espacios desde este componente.' : undefined}>
              <ul>{alcance.datos?.espacios.map((espacio) => <li key={espacio.espacioId}>{espacio.nombre} · {etiqueta(espacio.tipo)}</li>)}</ul>
            </EstadoLista>
          </section>}
        </section>
        <AltaComponente credencial={credencial} espacios={espacios.datos} alGuardar={consulta.recargar} />
      </div>
    </>
  )
}

export function Lecturas({ credencial }: Operador) {
  const consulta = useConsulta<Lectura[]>('/lecturas')
  const catalogo = useConsulta<Componente[]>('/componentes')
  const [filtro, setFiltro] = useState('')
  const escritura = useEscritura(credencial)
  const lecturas = (consulta.datos ?? []).filter((lectura) => !filtro || lectura.medidor_id === filtro)
  const medidores = catalogo.datos?.filter((componente) => componente.tipo === 'MEDIDOR') ?? []
  function guardar(evento: FormEvent<HTMLFormElement>) {
    const { form, datos } = conFormulario(evento)
    const valorAcumulado = texto(datos, 'valor').replace(',', '.')
    if (!/^\d{1,11}(\.\d{1,3})?$/.test(valorAcumulado)) {
      escritura.invalidar('Usa un valor no negativo con hasta 11 cifras enteras y 3 decimales.')
      return
    }
    void escritura.enviar('/lecturas', {
      medidorId: texto(datos, 'medidor'), fechaHora: new Date(texto(datos, 'fecha')).toISOString(), valorAcumulado,
    }, 'Lectura registrada.', () => {
      form.reset()
      consulta.recargar()
    })
  }
  return (
    <>
      <h1>Lecturas</h1>
      <div className="columnas">
        <section className="panel">
          <div className="fila">
            <h2>Historial</h2>
            <label className="filtro">Filtrar por medidor<select value={filtro} onChange={(evento) => setFiltro(evento.target.value)}>
              <option value="">Todos</option>
              {medidores.map((m) => <option key={m.componente_id} value={m.componente_id}>{m.codigo}</option>)}
            </select></label>
          </div>
          <EstadoLista consulta={consulta} vacio={!lecturas.length ? 'No hay lecturas para esta selección.' : undefined}>
            <div className="tabla"><table>
              <thead><tr><th>Medidor</th><th>Fecha</th><th>Acumulado (m³)</th><th>Consumo (m³)</th></tr></thead>
              <tbody>{lecturas.map((l) => <tr key={l.lectura_id}>
                <th scope="row">{l.codigo_medidor}</th><td>{fechaLocal(l.fecha_hora)}</td>
                <td>{l.valor_acumulado}</td><td>{l.consumo_m3 ?? 'Sin lectura anterior'}</td>
              </tr>)}</tbody>
            </table></div>
          </EstadoLista>
        </section>
        <section className="panel">
          <h2>Registrar lectura</h2>
          <RequiereOperador credencial={credencial} />
          <EstadoLista consulta={catalogo} vacio={!medidores.some((m) => m.estado === 'ACTIVO') ? 'No hay medidores activos.' : undefined}>
            <form onSubmit={guardar}><fieldset disabled={!credencial || escritura.ocupado}>
              <label>Medidor<select name="medidor" required defaultValue=""><option value="">Elige un medidor</option>
                {medidores.filter((m) => m.estado === 'ACTIVO').map((m) =>
                  <option key={m.componente_id} value={m.componente_id}>{m.codigo} · {m.nombre}</option>)}
              </select></label>
              <label>Fecha y hora<input name="fecha" type="datetime-local" required defaultValue={fechaFormularioAhora()} /></label>
              <label>Valor acumulado (m³)<input name="valor" inputMode="decimal" required placeholder="120.000" /></label>
              <button className="primario" type="submit">{escritura.ocupado ? 'Guardando…' : 'Guardar lectura'}</button>
            </fieldset></form>
          </EstadoLista>
          <AvisoEscritura aviso={escritura.aviso} />
        </section>
      </div>
    </>
  )
}
