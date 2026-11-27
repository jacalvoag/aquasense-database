import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { Componente, Espacio } from '../api/dominio'
import { useCambioRed } from '../api/cambios-red'
import { ConfirmacionRed, AvisoEscritura, EstadoLista, RequiereOperador } from '../ui'
import { conFormulario, texto, useConsulta, useEscritura } from '../operaciones'
import type { Operador } from '../operaciones'

interface Conexion {
  conexion_id: string; componente_origen_id: string; componente_destino_id: string | null; espacio_destino_id: string | null
  origen_codigo: string; destino_codigo: string | null; destino_nombre: string; destino_clase: 'ESPACIO' | 'COMPONENTE'
}
const permitidos: Record<string, string[]> = {
  CISTERNA: ['TUBERIA'], TUBERIA: ['TUBERIA', 'UNION', 'VALVULA', 'MEDIDOR'],
  UNION: ['TUBERIA'], VALVULA: ['TUBERIA'], MEDIDOR: ['TUBERIA'],
}
function FormularioConexion({ componentes, espacios, conexiones, editando, origenInicial, bloqueado, guardar }: {
  componentes: Componente[]; espacios: Espacio[]; conexiones: Conexion[]; editando: Conexion | null
  origenInicial: string; bloqueado: boolean; guardar: (e: FormEvent<HTMLFormElement>) => void
}) {
  const [origen, setOrigen] = useState(editando?.componente_origen_id ?? origenInicial)
  const [clase, setClase] = useState(editando?.destino_clase ?? 'COMPONENTE')
  const activos = componentes.filter((c) => c.estado === 'ACTIVO')
  const otras = conexiones.filter((c) => c.conexion_id !== editando?.conexion_id)
  const tipo = activos.find((c) => c.componente_id === origen)?.tipo
  const destinos = activos.filter((c) => c.componente_id !== origen && (permitidos[tipo ?? ''] ?? []).includes(c.tipo)
    && !otras.some((v) => v.componente_destino_id === c.componente_id))
  const destinosEspacio = espacios.filter((e) => !otras.some((c) => c.espacio_destino_id === e.espacio_id))
  return <form onSubmit={guardar}><fieldset disabled={bloqueado}>
    <label>Componente de origen<select aria-label="Componente de origen" name="origen" value={origen} required onChange={(e) => { setOrigen(e.target.value); setClase('COMPONENTE') }}>
      <option value="">Elige el origen del agua</option>
      {activos.filter((c) => c.tipo === 'UNION' || !otras.some((v) => v.componente_origen_id === c.componente_id))
        .map((c) => <option key={c.componente_id} value={c.componente_id}>{c.codigo} · {c.nombre}</option>)}
    </select></label>
    <label>Tipo de destino<select aria-label="Tipo de destino" name="clase" value={clase} onChange={(e) => setClase(e.target.value as typeof clase)}>
      <option value="COMPONENTE">Componente</option><option value="ESPACIO" disabled={tipo !== 'TUBERIA'}>Espacio abastecido</option>
    </select></label>
    {clase === 'COMPONENTE' ? <label>Componente de destino<select aria-label="Componente de destino" key={origen} name="destino" required defaultValue={editando?.componente_destino_id ?? ''}>
      <option value="">Elige un componente compatible</option>{destinos.map((c) => <option key={c.componente_id} value={c.componente_id}>{c.codigo} · {c.nombre}</option>)}
    </select></label> : <label>Espacio de destino<select aria-label="Espacio de destino" name="destino" required defaultValue={editando?.espacio_destino_id ?? ''}>
      <option value="">Elige el espacio abastecido</option>{destinosEspacio.map((e) => <option key={e.espacio_id} value={e.espacio_id}>{e.nombre}</option>)}
    </select></label>}
    <p className="ayuda-formulario">Solo las uniones permiten ramales y solo una tubería puede abastecer directamente a un espacio. Cada destino admite una entrada. La base rechaza ciclos y combinaciones incompatibles.</p>
    <button type="submit" className="primario">{editando ? 'Guardar cambios de conexión' : 'Crear conexión'}</button>
  </fieldset></form>
}

export function Conexiones({ credencial }: Operador) {
  const consulta = useConsulta<Conexion[]>('/conexiones')
  const componentes = useConsulta<Componente[]>('/componentes'), espacios = useConsulta<Espacio[]>('/espacios')
  const [parametros] = useSearchParams()
  const [editando, setEditando] = useState<Conexion | null>(null)
  const [formulario, setFormulario] = useState(0)
  const escritura = useEscritura(credencial), cambio = useCambioRed()
  const bloqueado = !credencial || escritura.ocupado || cambio.pendiente || consulta.cargando || componentes.cargando || espacios.cargando
    || !!consulta.error || !!componentes.error || !!espacios.error
  function recargar() { consulta.recargar(); componentes.recargar(); espacios.recargar() }
  function confirmado(r: { eventoId: string }) {
    cambio.seguir(r.eventoId); setEditando(null); setFormulario((n) => n + 1); recargar()
  }
  function guardar(evento: FormEvent<HTMLFormElement>) {
    const { datos } = conFormulario(evento)
    const ruta = editando ? `/conexiones/${editando.conexion_id}/actualizar` : '/conexiones'
    void escritura.enviar(ruta, { componenteOrigenId: texto(datos, 'origen'),
      ...(texto(datos, 'clase') === 'ESPACIO' ? { espacioDestinoId: texto(datos, 'destino') } : { componenteDestinoId: texto(datos, 'destino') }),
    }, 'Conexión guardada.', confirmado)
  }
  function eliminar(c: Conexion) {
    if (!window.confirm(`¿Eliminar la conexión de ${c.origen_codigo} a ${c.destino_codigo ?? c.destino_nombre}? Se desconectará este tramo de la red.`)) return
    void escritura.enviar(`/conexiones/${c.conexion_id}/eliminar`, undefined, 'Conexión eliminada.', confirmado)
  }
  return <>
    <div className="encabezado"><h1>Conexiones</h1><Link className="boton" to="/red">Ver red de agua</Link></div>
    <p className="ayuda-formulario">Los cambios modifican la red guardada. Tras confirmarlos, el diagrama y los recorridos se actualizan automáticamente. Los componentes aislados siguen en el catálogo.</p>
    <RequiereOperador credencial={credencial} />
    <AvisoEscritura aviso={escritura.aviso} /><ConfirmacionRed cambio={cambio} />
    <div className="columnas">
      <section className="panel"><div className="fila"><h2>Conexiones registradas</h2><button type="button" onClick={recargar}>Actualizar catálogos</button></div>
        <EstadoLista consulta={consulta} vacio={consulta.datos?.length === 0 ? 'No hay conexiones registradas.' : undefined}>
          <div className="tabla"><table><thead><tr><th>Origen</th><th>Destino</th><th>Acciones</th></tr></thead>
            <tbody>{consulta.datos?.map((c) => <tr key={c.conexion_id}><th scope="row">{c.origen_codigo}</th>
              <td>{c.destino_codigo && <strong>{c.destino_codigo} · </strong>}{c.destino_nombre}</td>
              <td><div className="acciones"><button type="button" disabled={bloqueado} onClick={() => setEditando(c)}
                aria-label={`Modificar ${c.origen_codigo} a ${c.destino_codigo ?? c.destino_nombre}`}>Modificar</button>
                <button type="button" disabled={bloqueado} onClick={() => eliminar(c)}
                  aria-label={`Eliminar ${c.origen_codigo} a ${c.destino_codigo ?? c.destino_nombre}`}>Eliminar</button></div></td>
            </tr>)}</tbody></table></div>
        </EstadoLista>
      </section>
      <section className="panel"><div className="fila"><h2>{editando ? 'Modificar conexión' : 'Nueva conexión'}</h2>
        {editando && <button type="button" onClick={() => setEditando(null)}>Cancelar edición</button>}</div>
        <EstadoLista consulta={componentes}><EstadoLista consulta={espacios}>
          <FormularioConexion key={`${editando?.conexion_id ?? 'nueva'}/${formulario}`} componentes={componentes.datos ?? []} espacios={espacios.datos ?? []}
            conexiones={consulta.datos ?? []} editando={editando} origenInicial={parametros.get('origen') ?? ''} bloqueado={bloqueado} guardar={guardar} />
        </EstadoLista></EstadoLista>
        <p><Link to="/componentes">Registrar componente</Link> · <Link to="/espacios">Registrar espacio</Link></p>
      </section>
    </div>
  </>
}
