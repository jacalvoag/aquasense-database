import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import type { Espacio } from '../api/dominio'
import { useCambioRed } from '../api/cambios-red'
import { ConfirmacionRed, AvisoEscritura, RequiereOperador } from '../ui'
import { conFormulario, etiqueta, texto, useEscritura } from '../operaciones'
import type { Operador } from '../operaciones'

function EspaciosOpciones({ espacios }: { espacios?: Espacio[] }) {
  return <>{espacios?.map((e) => <option key={e.espacio_id} value={e.espacio_id}>{e.nombre}</option>)}</>
}

export function AltaEspacio({ credencial, espacios, alGuardar }: Operador & { espacios?: Espacio[]; alGuardar: () => void }) {
  const escritura = useEscritura(credencial), cambio = useCambioRed()
  function guardar(evento: FormEvent<HTMLFormElement>) {
    const { form, datos } = conFormulario(evento)
    void escritura.enviar<{ eventoId: string }>('/espacios', {
      nombre: texto(datos, 'nombre'), tipo: texto(datos, 'tipo'),
      espacioContenedorId: texto(datos, 'contenedor') || undefined,
      descripcion: texto(datos, 'descripcion') || undefined,
    }, 'Espacio registrado.', (r) => { form.reset(); cambio.seguir(r.eventoId); alGuardar() })
  }
  return <section className="panel"><h2>Registrar espacio</h2>
    <p className="ayuda-formulario">Registra un lugar y, si corresponde, el edificio o espacio que lo contiene. Aparecerá en el diagrama cuando reciba una conexión de agua.</p>
    <RequiereOperador credencial={credencial} />
    <form onSubmit={guardar}><fieldset disabled={!credencial || escritura.ocupado || cambio.pendiente}>
      <label>Nombre del espacio<input name="nombre" required maxLength={150} /></label>
      <label>Tipo de espacio<select name="tipo" defaultValue="OTRO">
        {['EDIFICIO', 'BAÑO', 'LABORATORIO', 'OFICINA', 'CAFETERIA', 'ZONA_RIEGO', 'OTRO'].map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}
      </select></label>
      <label>Espacio contenedor<select name="contenedor"><option value="">Sin contenedor</option><EspaciosOpciones espacios={espacios} /></select></label>
      <label>Descripción<textarea name="descripcion" maxLength={4000} rows={2} /></label>
      <button type="submit" className="primario">Registrar espacio</button>
    </fieldset></form>
    <AvisoEscritura aviso={escritura.aviso} /><ConfirmacionRed cambio={cambio} />
  </section>
}

export function AltaComponente({ credencial, espacios, alGuardar }: Operador & { espacios?: Espacio[]; alGuardar: () => void }) {
  const [tipo, setTipo] = useState('TUBERIA')
  const escritura = useEscritura(credencial), cambio = useCambioRed()
  function guardar(evento: FormEvent<HTMLFormElement>) {
    const { form, datos } = conFormulario(evento)
    void escritura.enviar<{ eventoId: string }>('/componentes', {
      codigo: texto(datos, 'codigo'), nombre: texto(datos, 'nombre'), tipo,
      espacioId: texto(datos, 'espacio') || undefined, descripcion: texto(datos, 'descripcion') || undefined,
      ...(tipo === 'VALVULA' ? { posicion: texto(datos, 'posicion') } : {}),
    }, 'Componente registrado sin conexiones.', (r) => { form.reset(); cambio.seguir(r.eventoId); alGuardar() })
  }
  return <section className="panel"><h2>Registrar componente</h2>
    <p className="ayuda-formulario">El componente se registra sin conexiones. Después puedes <Link to="/conexiones">conectarlo a la red</Link>. Si es una tubería, también puedes instalarla mediante «Reemplazar tubería» en un reporte.</p>
    <RequiereOperador credencial={credencial} />
    <form onSubmit={guardar}><fieldset disabled={!credencial || escritura.ocupado || cambio.pendiente}>
      <label>Tipo de componente<select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        {['CISTERNA', 'TUBERIA', 'UNION', 'VALVULA', 'MEDIDOR'].map((t) => <option key={t} value={t}>{etiqueta(t)}</option>)}
      </select></label>
      <label>Código<input name="codigo" maxLength={40} required /></label>
      <label>Nombre<input name="nombre" maxLength={150} required /></label>
      <label>Ubicación<select name="espacio"><option value="">Sin ubicación</option><EspaciosOpciones espacios={espacios} /></select></label>
      {tipo === 'VALVULA' && <label>Posición registrada<select name="posicion" defaultValue="DESCONOCIDA">
        {['DESCONOCIDA', 'ABIERTA', 'CERRADA'].map((p) => <option value={p} key={p}>{etiqueta(p)}</option>)}
      </select></label>}
      {tipo === 'MEDIDOR' && <p>Las lecturas se registrarán en m³ desde Lecturas.</p>}
      <label>Descripción<textarea name="descripcion" rows={2} maxLength={4000} /></label>
      <button type="submit" className="primario">Registrar componente</button>
    </fieldset></form>
    <AvisoEscritura aviso={escritura.aviso} /><ConfirmacionRed cambio={cambio} />
  </section>
}
