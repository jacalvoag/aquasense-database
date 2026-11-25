import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { Atencion, Componente, Espacio, Expediente, Reporte, TipoAtencion } from '../api/dominio'
import { useSeguimiento } from '../api/seguimiento'
import { Aviso, AvisoEscritura, Badge, EstadoLista, RequiereOperador } from '../ui'
import { conFormulario, etiqueta, fechaFormularioAhora, fechaLocal, materiales, motivo, texto, useConsulta, useEscritura } from '../operaciones'
import type { Operador } from '../operaciones'
import { OpcionesEspacios } from './Catalogos'

export function Reportes() {
  const consulta = useConsulta<Reporte[]>('/reportes')
  return (
    <>
      <div className="encabezado"><h1>Reportes</h1><Link className="boton primario" to="/reportes/nuevo">Crear reporte</Link></div>
      <EstadoLista consulta={consulta} vacio={!consulta.datos?.length ? 'Aún no hay reportes. Los nuevos aparecerán aquí.' : undefined}>
        <div className="tabla panel"><table>
          <thead><tr><th>Espacio</th><th>Registro</th><th>Reporte</th><th>Expediente</th><th>Red</th></tr></thead>
          <tbody>{consulta.datos?.map((r) => <tr key={r.reporte_id}>
            <th scope="row"><Link to={`/reportes/${r.reporte_id}`}>{r.espacio_nombre}</Link></th>
            <td>{fechaLocal(r.registrado_en)}</td><td><Badge valor={r.estado} /></td>
            <td><Badge valor={r.estado_evento_documental} /></td>
            <td>{r.evento_grafo_id ? <Badge valor={r.estado_evento_grafo} /> : '—'}</td>
          </tr>)}</tbody>
        </table></div>
      </EstadoLista>
    </>
  )
}

export function NuevoReporte({ credencial }: Operador) {
  const espacios = useConsulta<Espacio[]>('/espacios')
  const escritura = useEscritura(credencial)
  const navegar = useNavigate()
  function guardar(evento: FormEvent<HTMLFormElement>) {
    const { datos } = conFormulario(evento)
    const descripcionInicial = texto(datos, 'descripcion')
    if (!descripcionInicial) {
      escritura.invalidar('Escribe una descripción de la incidencia.')
      return
    }
    void escritura.enviar<{ reporteId: string }>('/reportes', {
      espacioId: texto(datos, 'espacio'),
      descripcionInicial,
      referenciaUbicacion: texto(datos, 'referencia') || undefined,
    }, 'Reporte registrado.', (r) => navegar(`/reportes/${r.reporteId}`))
  }
  return (
    <>
      <Link className="volver" to="/reportes">Volver a reportes</Link>
      <h1>Crear reporte</h1>
      <section className="panel formulario">
        <RequiereOperador credencial={credencial} />
        <EstadoLista consulta={espacios} vacio={espacios.datos?.length === 0 ? 'No hay espacios para registrar un reporte.' : undefined}>
          <form onSubmit={guardar}><fieldset disabled={!credencial || escritura.ocupado}>
            <label>Espacio<select name="espacio" defaultValue="" required><option value="">Elige el espacio donde observaste la incidencia</option>
              <OpcionesEspacios espacios={espacios.datos} />
            </select></label>
            <label>Descripción<textarea name="descripcion" rows={4} required /></label>
            <label>Referencia de ubicación<input name="referencia" /></label>
            <button className="primario" type="submit">{escritura.ocupado ? 'Guardando…' : 'Guardar reporte'}</button>
          </fieldset></form>
        </EstadoLista>
        <AvisoEscritura aviso={escritura.aviso} />
      </section>
    </>
  )
}

function Atenciones({ atenciones, componentes }: { atenciones: Atencion[]; componentes: Componente[] }) {
  return atenciones.length ? <ol className="atenciones">
    {atenciones.map((a) => <li key={a.atencionId}>
      <div className="fila"><strong>{etiqueta(a.tipo)}</strong><time dateTime={a.fecha}>{fechaLocal(a.fecha)}</time></div>
      <p>{a.descripcion}</p>
      {a.componenteId && <p>Componente · {componentes.find((c) => c.componente_id === a.componenteId)?.codigo ?? a.componenteId}</p>}
      {a.hallazgos && <p>Hallazgos · {a.hallazgos}</p>}
      {!!a.materiales?.length && <p>Materiales · {a.materiales.join(', ')}</p>}
      {a.resultado && <p>Resultado · <Badge valor={a.resultado} /></p>}
    </li>)}
  </ol> : <p className="suave">Aún no hay atenciones.</p>
}

function AtencionForm({ componentes, guardar, bloqueado }: {
  componentes: Componente[]
  guardar: (evento: FormEvent<HTMLFormElement>, tipo: TipoAtencion) => void
  bloqueado: boolean
}) {
  const [tipo, setTipo] = useState<TipoAtencion>('INSPECCION')
  return <form onSubmit={(evento) => guardar(evento, tipo)}>
    <fieldset disabled={bloqueado}>
      <label>Tipo de atención<select value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoAtencion)}>
        <option value="INSPECCION">Inspección</option><option value="REPARACION">Reparación</option><option value="VERIFICACION">Verificación</option>
      </select></label>
      <label>Fecha y hora<input name="fecha" type="datetime-local" defaultValue={fechaFormularioAhora()} required /></label>
      <label>Descripción<textarea name="descripcion" rows={2} required /></label>
      {tipo === 'INSPECCION' && <label>Hallazgos<textarea name="hallazgos" rows={2} required /></label>}
      {tipo === 'REPARACION' && <label>Materiales<textarea name="materiales" rows={2} placeholder="Uno por línea" /></label>}
      {tipo === 'VERIFICACION' && <label>Resultado<select name="resultado" required defaultValue=""><option value="">Elige el resultado</option>
        <option value="SIN_INDICIOS">Sin indicios</option><option value="PERSISTE">Persiste</option><option value="NO_CONCLUYENTE">No concluyente</option>
      </select></label>}
      <label>Componente<select name="componente" defaultValue=""><option value="">Sin especificar</option>
        {componentes.map((c) => <option value={c.componente_id} key={c.componente_id}>{c.codigo} · {c.nombre}</option>)}
      </select></label>
      <button type="submit" className="primario">Guardar atención</button>
    </fieldset>
  </form>
}

function ReemplazoForm({ componentes, guardar, bloqueado }: {
  componentes: Componente[]
  guardar: (evento: FormEvent<HTMLFormElement>) => void
  bloqueado: boolean
}) {
  const tuberias = componentes.filter((c) => c.tipo === 'TUBERIA' && c.estado === 'ACTIVO')
  const anteriores = tuberias.filter((c) => c.tiene_conexiones)
  const nuevas = tuberias.filter((c) => !c.tiene_conexiones)
  if (!anteriores.length || !nuevas.length) return <p>Se requiere una tubería activa conectada y una sin conexiones. <Link to="/componentes">Ir al catálogo</Link></p>
  return <form onSubmit={guardar}>
    <fieldset disabled={bloqueado}>
      <label>Tubería anterior<select name="anterior" required defaultValue=""><option value="">Elige una tubería conectada</option>
        {anteriores.map((c) => <option value={c.componente_id} key={c.componente_id}>{c.codigo} · {c.nombre}</option>)}
      </select></label>
      <label>Tubería nueva<select name="nueva" required defaultValue=""><option value="">Elige una tubería sin conexiones</option>
        {nuevas.map((c) => <option value={c.componente_id} key={c.componente_id}>{c.codigo} · {c.nombre}</option>)}
      </select></label>
      <label>Fecha y hora<input name="fecha" type="datetime-local" defaultValue={fechaFormularioAhora()} required /></label>
      <label>Descripción<textarea name="descripcion" rows={2} required /></label>
      <label>Materiales<textarea name="materiales" rows={2} placeholder="Uno por línea" /></label>
      <button type="submit" className="primario">Confirmar reemplazo</button>
    </fieldset>
  </form>
}

export function ReporteDetalle({ credencial }: Operador) {
  const { id = '' } = useParams()
  return <Detalle key={id} id={id} credencial={credencial} />
}

function Detalle({ id, credencial }: Operador & { id: string }) {
  const base = `/reportes/${encodeURIComponent(id)}`
  const reportes = useConsulta<Reporte[]>('/reportes')
  const expediente = useConsulta<Expediente>(`${base}/expediente`)
  const catalogo = useConsulta<Componente[]>('/componentes')
  const escritura = useEscritura(credencial)
  const reporte = reportes.datos?.find((r) => r.reporte_id === id)
  const [eventosNuevos, setEventosNuevos] = useState<{ documento: string; grafo?: string } | null>(null)
  const documento = eventosNuevos?.documento ?? reporte?.evento_documental_id ?? null
  const grafo = eventosNuevos?.grafo ?? reporte?.evento_grafo_id ?? null
  const vigilar = !!eventosNuevos || reporte?.estado_evento_documental === 'PENDIENTE' || reporte?.estado_evento_grafo === 'PENDIENTE'
  const seguimiento = useSeguimiento(id, documento, grafo, vigilar)
  const fin = seguimiento.actual?.fin ?? false
  const refrescos = useRef({ reporte: reportes.recargar, expediente: expediente.recargar, catalogo: catalogo.recargar })
  useEffect(() => {
    refrescos.current = { reporte: reportes.recargar, expediente: expediente.recargar, catalogo: catalogo.recargar }
  })
  useEffect(() => {
    if (fin) {
      refrescos.current.reporte()
      refrescos.current.expediente()
      refrescos.current.catalogo()
    }
  }, [fin])
  const estadoDocumento = seguimiento.actual?.eventos.find((e) => e.eventoId === documento)?.estado
    ?? (eventosNuevos ? 'PENDIENTE' : reporte?.estado_evento_documental)
  const estadoGrafo = seguimiento.actual?.eventos.find((e) => e.eventoId === grafo)?.estado
    ?? (eventosNuevos?.grafo ? 'PENDIENTE' : reporte?.estado_evento_grafo)
  const info = estadoDocumento === 'PROCESADO' ? expediente.datos?.expediente : null
  const ultima = info?.atenciones.at(-1)
  const puedeCerrar = ultima?.tipo === 'VERIFICACION' && ultima.resultado === 'SIN_INDICIOS' && reporte?.estado === 'EN_ATENCION'
  const bloqueado = !credencial || escritura.ocupado || !info || estadoDocumento !== 'PROCESADO' || (!!grafo && estadoGrafo !== 'PROCESADO')
  function refrescar() {
    setEventosNuevos(null)
    reportes.recargar()
    expediente.recargar()
    catalogo.recargar()
    seguimiento.reanudar()
  }
  function registrar(evento: FormEvent<HTMLFormElement>, tipo: TipoAtencion) {
    const { form, datos } = conFormulario(evento)
    const descripcion = texto(datos, 'descripcion')
    const hallazgos = texto(datos, 'hallazgos')
    if (!descripcion || (tipo === 'INSPECCION' && !hallazgos)) {
      escritura.invalidar('Completa la descripción y los hallazgos requeridos.')
      return
    }
    void escritura.enviar<{ eventoId: string }>(`${base}/atenciones`, {
      tipo, fecha: new Date(texto(datos, 'fecha')).toISOString(), descripcion,
      componenteId: texto(datos, 'componente') || undefined,
      ...(tipo === 'INSPECCION' ? { hallazgos } : tipo === 'REPARACION' ? { materiales: materiales(datos) } : { resultado: texto(datos, 'resultado') }),
    }, 'Atención guardada. Esperando la confirmación del expediente.', (respuesta) => {
      form.reset()
      setEventosNuevos({ documento: respuesta.eventoId })
      expediente.recargar()
    })
  }
  function reemplazar(evento: FormEvent<HTMLFormElement>) {
    const { form, datos } = conFormulario(evento)
    const descripcion = texto(datos, 'descripcion')
    if (!descripcion) {
      escritura.invalidar('Escribe qué se hizo durante el reemplazo.')
      return
    }
    void escritura.enviar<{ eventoDocumentalId: string; eventoGrafoId: string }>(`${base}/reemplazo`, {
      tuberiaAnteriorId: texto(datos, 'anterior'), tuberiaNuevaId: texto(datos, 'nueva'),
      fecha: new Date(texto(datos, 'fecha')).toISOString(), descripcion, materiales: materiales(datos),
    }, 'Reemplazo guardado. Esperando la confirmación del expediente y de la red.', (respuesta) => {
      form.reset()
      setEventosNuevos({ documento: respuesta.eventoDocumentalId, grafo: respuesta.eventoGrafoId })
      expediente.recargar()
      catalogo.recargar()
    })
  }
  return (
    <>
      <Link className="volver" to="/reportes">Volver a reportes</Link>
      <div className="encabezado"><h1>{reporte?.espacio_nombre ?? 'Detalle del reporte'}</h1><button type="button" onClick={refrescar}>Actualizar</button></div>
      <AvisoEscritura aviso={escritura.aviso} />
      <EstadoLista consulta={reportes} vacio={!reporte ? 'No se encontró el reporte.' : undefined}>
        {reporte && <>
          <div className="estados panel">
            <p>Reporte <Badge valor={reporte.estado} /></p>
            <p>Expediente <Badge valor={estadoDocumento} /></p>
            {grafo && <p>Red <Badge valor={estadoGrafo} /></p>}
            <time dateTime={reporte.registrado_en}>{fechaLocal(reporte.registrado_en)}</time>
          </div>
          {(estadoDocumento === 'PENDIENTE' || estadoGrafo === 'PENDIENTE') &&
            <Aviso>{seguimiento.actual?.agotado ? 'La sincronización sigue pendiente. Puedes actualizar el estado.' : 'Esperando la sincronización.'}</Aviso>}
          {(estadoDocumento === 'ERROR' || estadoGrafo === 'ERROR') &&
            <Aviso error>La sincronización requiere revisión del responsable del backend.</Aviso>}
          {seguimiento.actual?.error && <Aviso error>{motivo(seguimiento.actual.error)} Usa Actualizar para continuar el seguimiento.</Aviso>}
          {grafo && estadoGrafo === 'PROCESADO' && estadoDocumento === 'PROCESADO' && <Link className="volver" to="/red">Ver red actualizada</Link>}
          <div className="columnas">
            <section className="panel">
              <h2>Expediente</h2>
              <EstadoLista consulta={expediente} vacio={!info ? 'El expediente estará disponible al confirmarse la sincronización.' : undefined}>
                <p>{info?.descripcionInicial}</p>
                {info?.referenciaUbicacion && <p>Referencia · {info.referenciaUbicacion}</p>}
                <h3>Atenciones</h3>
                <Atenciones atenciones={info?.atenciones ?? []} componentes={catalogo.datos ?? []} />
              </EstadoLista>
            </section>
            {reporte.estado !== 'CERRADO' && <div className="apilado">
              <RequiereOperador credencial={credencial} />
              <details className="panel" open><summary>Registrar atención</summary>
                <AtencionForm componentes={catalogo.datos ?? []} guardar={registrar} bloqueado={bloqueado} />
              </details>
              <details className="panel"><summary>Reemplazar tubería</summary>
                <EstadoLista consulta={catalogo}><ReemplazoForm componentes={catalogo.datos ?? []} guardar={reemplazar} bloqueado={bloqueado} /></EstadoLista>
              </details>
              <section className="panel"><h2>Cerrar reporte</h2>
                {!puedeCerrar && <p>Registra una verificación «Sin indicios» y espera la confirmación.</p>}
                <button type="button" disabled={bloqueado || !puedeCerrar} onClick={() => {
                  void escritura.enviar(`${base}/cerrar`, undefined, 'Reporte cerrado.', refrescar)
                }}>Cerrar reporte</button>
              </section>
            </div>}
          </div>
        </>}
      </EstadoLista>
    </>
  )
}
