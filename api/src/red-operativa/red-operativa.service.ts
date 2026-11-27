import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../postgres/postgres.service.js';

const tiposEspacio = ['EDIFICIO', 'BAÑO', 'LABORATORIO', 'OFICINA', 'CAFETERIA', 'ZONA_RIEGO', 'OTRO'];
const tiposComponente = ['CISTERNA', 'TUBERIA', 'UNION', 'VALVULA', 'MEDIDOR'];
const posiciones = ['ABIERTA', 'CERRADA', 'DESCONOCIDA'];
function cuerpo(valor: unknown) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new BadRequestException('El cuerpo debe ser un objeto.');
  return valor as Record<string, unknown>;
}
function texto(valor: unknown, campo: string, maximo: number, opcional = false): string | null {
  if (opcional && valor == null) return null;
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) throw new BadRequestException(`${campo} debe contener texto de hasta ${maximo} caracteres.`);
  return valor.trim();
}
function id(valor: unknown, campo: string, opcional = false): string | null {
  if (opcional && valor == null) return null;
  if (typeof valor !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) {
    throw new BadRequestException(`${campo} debe ser un UUID válido.`);
  }
  return valor.toLowerCase();
}
function opcion(valor: unknown, campo: string, opciones: string[]) {
  if (typeof valor !== 'string' || !opciones.includes(valor)) throw new BadRequestException(`${campo} no está entre las opciones admitidas.`);
  return valor;
}

@Injectable()
export class RedOperativaService {
  constructor(private readonly postgres: PostgresService) {}

  async crearEspacio(entrada: unknown) {
    const d = cuerpo(entrada);
    const nombre = texto(d.nombre, 'nombre', 150);
    const tipo = opcion(d.tipo, 'tipo', tiposEspacio);
    const contenedor = id(d.espacioContenedorId, 'espacioContenedorId', true);
    const descripcion = texto(d.descripcion, 'descripcion', 4000, true);
    const espacioId = randomUUID(), eventoId = randomUUID();
    await this.postgres.consultar('SELECT aquasense.registrar_espacio_red($1::uuid, $2::uuid, $3, $4, $5::uuid, $6)',
      [espacioId, eventoId, nombre, tipo, contenedor, descripcion]);
    return { espacioId, eventoId, nombre, tipo, estadoGrafoInicial: 'PENDIENTE' };
  }

  async crearComponente(entrada: unknown) {
    const d = cuerpo(entrada);
    const codigo = texto(d.codigo, 'codigo', 40)!.toUpperCase();
    if (codigo.length > 40) throw new BadRequestException('El código normalizado supera 40 caracteres.');
    const nombre = texto(d.nombre, 'nombre', 150);
    const tipo = opcion(d.tipo, 'tipo', tiposComponente);
    const espacioId = id(d.espacioId, 'espacioId', true);
    const descripcion = texto(d.descripcion, 'descripcion', 4000, true);
    if (tipo !== 'VALVULA' && d.posicion !== undefined) throw new BadRequestException('La posición solo corresponde a una válvula.');
    const posicion = opcion(d.posicion ?? 'DESCONOCIDA', 'posicion', posiciones);
    const componenteId = randomUUID(), eventoId = randomUUID();
    await this.postgres.consultar('SELECT aquasense.registrar_componente_red($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, $7, $8)',
      [componenteId, eventoId, codigo, nombre, tipo, espacioId, descripcion, posicion]);
    return { componenteId, eventoId, codigo, nombre, tipo, estado: 'ACTIVO', estadoGrafoInicial: 'PENDIENTE' };
  }

  async listarConexiones() {
    return (await this.postgres.consultar(`SELECT c.conexion_id, c.componente_origen_id, c.componente_destino_id,
      c.espacio_destino_id, o.codigo AS origen_codigo, o.nombre AS origen_nombre,
      d.codigo AS destino_codigo, COALESCE(d.nombre, e.nombre) AS destino_nombre,
      CASE WHEN d.componente_id IS NULL THEN 'ESPACIO' ELSE 'COMPONENTE' END AS destino_clase
      FROM aquasense.conexion c JOIN aquasense.componente o ON o.componente_id = c.componente_origen_id
      LEFT JOIN aquasense.componente d ON d.componente_id = c.componente_destino_id
      LEFT JOIN aquasense.espacio e ON e.espacio_id = c.espacio_destino_id
      ORDER BY o.codigo, destino_nombre, c.conexion_id`)).rows;
  }

  private async cambiarConexion(entrada: unknown, conexionId?: string) {
    const d = cuerpo(entrada);
    const origen = id(d.componenteOrigenId, 'componenteOrigenId');
    const componente = id(d.componenteDestinoId, 'componenteDestinoId', true);
    const espacio = id(d.espacioDestinoId, 'espacioDestinoId', true);
    if ((componente === null) === (espacio === null)) throw new BadRequestException('Elige un solo destino: componente o espacio.');
    if (origen === componente) throw new BadRequestException('Un componente no puede conectarse consigo mismo.');
    const identificador = conexionId === undefined ? randomUUID() : id(conexionId, 'conexionId')!;
    const eventoId = randomUUID();
    const funcion = conexionId === undefined ? 'crear_conexion_red' : 'actualizar_conexion_red';
    try {
      await this.postgres.consultar(`SELECT aquasense.${funcion}($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)`,
        [identificador, origen, componente, espacio, eventoId]);
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23514') {
        const mensaje = 'message' in error ? String(error.message) : '';
        const razon = mensaje.includes('ciclo') ? 'La conexión formaría un ciclo.'
          : mensaje.includes('salida registrada') ? 'El origen ya tiene una salida; solo una unión permite ramales.'
          : mensaje.includes('no presenta cambios') ? 'La conexión no presenta cambios.'
          : 'La conexión no cumple las reglas de tipos, destinos o componentes activos.';
        throw new UnprocessableEntityException(razon);
      }
      throw error;
    }
    return { conexionId: identificador, eventoId, estadoGrafoInicial: 'PENDIENTE' };
  }

  crearConexion(entrada: unknown) { return this.cambiarConexion(entrada); }
  actualizarConexion(conexionId: string, entrada: unknown) { return this.cambiarConexion(entrada, conexionId); }

  async eliminarConexion(conexionId: string) {
    const identificador = id(conexionId, 'conexionId'), eventoId = randomUUID();
    await this.postgres.consultar('SELECT aquasense.eliminar_conexion_red($1::uuid, $2::uuid)', [identificador, eventoId]);
    return { conexionId: identificador, eventoId, estadoGrafoInicial: 'PENDIENTE' };
  }

  async evento(eventoId: string) {
    const identificador = id(eventoId, 'eventoId');
    const resultado = await this.postgres.consultar(`SELECT evento_id AS "eventoId", estado, secuencia::text,
      intentos, datos->'cambio'->>'operacion' AS operacion FROM aquasense.evento_salida
      WHERE evento_id = $1::uuid AND destino = 'GRAFO'`, [identificador]);
    if (!resultado.rows[0]) throw new NotFoundException('El evento de red no existe.');
    return resultado.rows[0];
  }

  async estado() {
    const r = await this.postgres.consultar(`SELECT version_red::text AS "versionRed",
      (SELECT count(*)::int FROM aquasense.evento_salida WHERE destino = 'GRAFO' AND estado = 'PENDIENTE') AS pendientes,
      (SELECT count(*)::int FROM aquasense.evento_salida WHERE destino = 'GRAFO' AND estado = 'ERROR') AS errores
      FROM aquasense.control_red WHERE control_id = 1`);
    if (!r.rows[0]) throw new NotFoundException('No existe el control de red.');
    return r.rows[0];
  }
}
