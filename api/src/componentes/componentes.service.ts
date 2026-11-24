import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service.js';
import { Neo4jService } from '../neo4j/neo4j.service.js';

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
        c.descripcion
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
}