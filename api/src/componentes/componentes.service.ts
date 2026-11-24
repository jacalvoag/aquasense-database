import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service.js';
import { Neo4jService } from '../neo4j/neo4j.service.js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ComponentesService {
  constructor(
    private readonly postgres: PostgresService,
    private readonly neo4j: Neo4jService,
  ) {}

  async listar() {
    const resultado = await this.postgres.consultar(`
      SELECT
        c.componente_id,
        c.codigo,
        c.nombre,
        c.tipo,
        c.estado,
c.espacio_id,
e.nombre AS espacio_nombre,
c.descripcion,
EXISTS (
  SELECT 1
  FROM aquasense.conexion AS conexion
  WHERE conexion.componente_origen_id = c.componente_id
     OR conexion.componente_destino_id = c.componente_id
) AS tiene_conexiones
      FROM aquasense.componente AS c
      LEFT JOIN aquasense.espacio AS e
        ON e.espacio_id = c.espacio_id
      ORDER BY c.codigo
    `);

    return resultado.rows;
  }

  private async consultarEstado(componenteId: string) {
    const resultado = await this.postgres.consultar(
      `
      SELECT
        componente.componente_id,
        componente.codigo,
        componente.estado,
        (
          SELECT version_red
          FROM aquasense.control_red
          WHERE control_id = 1
        ) AS version_red,
        EXISTS (
          SELECT 1
          FROM aquasense.evento_salida
          WHERE destino = 'GRAFO'
            AND estado <> 'PROCESADO'
        ) AS eventos_sin_procesar
      FROM aquasense.componente AS componente
      WHERE componente.componente_id = $1::uuid
      `,
      [componenteId],
    );

    return resultado.rows[0];
  }

  async espaciosAfectados(componenteId: string) {
    const formatoUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!formatoUuid.test(componenteId)) {
      throw new BadRequestException(
        'El identificador del componente no es válido.',
      );
    }

    const id = componenteId.toLowerCase();
    const inicial = await this.consultarEstado(id);

    if (!inicial) {
      throw new NotFoundException('El componente no existe.');
    }

    if (inicial.estado !== 'ACTIVO') {
      throw new ConflictException('El componente no está activo.');
    }

    if (inicial.version_red == null || inicial.eventos_sin_procesar) {
      throw new ServiceUnavailableException(
        'La red tiene cambios pendientes o su control no está disponible.',
      );
    }

    let grafo: Awaited<ReturnType<Neo4jService['consultarEspaciosAlcanzables']>>;

    try {
      grafo = await this.neo4j.consultarEspaciosAlcanzables(id);
    } catch {
      throw new ServiceUnavailableException(
        'No fue posible consultar la red en Neo4j.',
      );
    }

    if (
      grafo.estadoRed !== 'INICIALIZADO' ||
      grafo.versionRed !== inicial.version_red ||
      !grafo.componenteEncontrado
    ) {
      throw new ServiceUnavailableException(
        'El grafo no coincide con el estado de la red en PostgreSQL.',
      );
    }

    // Volver a revisar PostgreSQL por si cambió durante la consulta.
    const final = await this.consultarEstado(id);

    if (
      !final ||
      final.estado !== 'ACTIVO' ||
      final.eventos_sin_procesar ||
      final.version_red !== inicial.version_red
    ) {
      throw new ServiceUnavailableException(
        'La red cambió durante la consulta. Inténtalo nuevamente.',
      );
    }

    return {
      componenteId: id,
      codigo: inicial.codigo,
      versionRed: grafo.versionRed,
      espacios: grafo.espacios,
    };
  }

  async crearTuberia(entrada: unknown) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw new BadRequestException('El cuerpo de la tubería no es válido.');
  }

  const datos = entrada as Record<string, unknown>;

  if (
    typeof datos.codigo !== 'string' ||
    datos.codigo.trim() === '' ||
    datos.codigo.trim().length > 40
  ) {
    throw new BadRequestException(
      'El código es obligatorio y debe tener hasta 40 caracteres.',
    );
  }

  if (
    typeof datos.nombre !== 'string' ||
    datos.nombre.trim() === '' ||
    datos.nombre.trim().length > 150
  ) {
    throw new BadRequestException(
      'El nombre es obligatorio y debe tener hasta 150 caracteres.',
    );
  }

  const formatoUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (
    datos.espacioId != null &&
    (
      typeof datos.espacioId !== 'string' ||
      !formatoUuid.test(datos.espacioId)
    )
  ) {
    throw new BadRequestException('El espacioId no es válido.');
  }

  if (datos.descripcion != null && typeof datos.descripcion !== 'string') {
    throw new BadRequestException('La descripción debe ser texto.');
  }

  const componenteId = randomUUID();
  const codigo = datos.codigo.trim().toUpperCase();
  const nombre = datos.nombre.trim();

  try {
    await this.postgres.consultar(
      `
      INSERT INTO aquasense.componente (
        componente_id,
        codigo,
        nombre,
        tipo,
        estado,
        espacio_id,
        descripcion
      )
      VALUES ($1::uuid, $2, $3, 'TUBERIA', 'ACTIVO', $4::uuid, $5)
      `,
      [
        componenteId,
        codigo,
        nombre,
        typeof datos.espacioId === 'string'
          ? datos.espacioId.toLowerCase()
          : null,
        typeof datos.descripcion === 'string'
          ? datos.descripcion.trim()
          : null,
      ],
    );
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === '23503') {
        throw new NotFoundException('El espacio indicado no existe.');
      }

      if (error.code === '23505') {
        throw new ConflictException('El código de componente ya existe.');
      }

      if (error.code === '23514') {
        throw new BadRequestException(
          'La tubería no cumple las restricciones de la base de datos.',
        );
      }
    }

    throw error;
  }

  return {
    componenteId,
    codigo,
    nombre,
    tipo: 'TUBERIA',
    estado: 'ACTIVO',
  };
}
}