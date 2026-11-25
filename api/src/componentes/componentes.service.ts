import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ComponentesRepository } from './componentes.repository.js';
import { Neo4jService } from '../neo4j/neo4j.service.js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ComponentesService {
  constructor(
    private readonly repositorio: ComponentesRepository,
    private readonly neo4j: Neo4jService,
  ) {}

  async listar() {
    const resultado = await this.repositorio.listar();

    return resultado.rows;
  }

  private async consultarEstado(componenteId: string) {
    const resultado = await this.repositorio.consultarEstado([componenteId]);

    return resultado.rows[0];
  }

  async espaciosAfectados(componenteId: string) {
    const { id, codigo, grafo } = await this.consultarComponente(
      componenteId,
      (id) => this.neo4j.consultarEspaciosAlcanzables(id),
    );
    return { componenteId: id, codigo, versionRed: grafo.versionRed, espacios: grafo.espacios };
  }

  async alcance(componenteId: string) {
    const { id, grafo } = await this.consultarComponente(
      componenteId,
      (id) => this.neo4j.consultarRed(id),
    );
    return {
      componenteId: id,
      versionRed: grafo.versionRed,
      nodoIds: grafo.nodos.map((nodo) => nodo.id),
      conexionIds: grafo.conexiones.map((conexion) => conexion.id),
      espacios: grafo.espacios,
    };
  }

  async snapshotRed() {
    const consultarEstado = async () =>
      (await this.repositorio.consultarControlRed()).rows[0];
    const inicial = await consultarEstado();
    this.comprobarControl(inicial);
    const grafo = await this.leerGrafo(() => this.neo4j.consultarRed());
    this.comprobarGrafo(grafo, inicial.version_red);
    this.comprobarControlFinal(await consultarEstado(), inicial.version_red);
    return { versionRed: grafo.versionRed, nodos: grafo.nodos, conexiones: grafo.conexiones };
  }

  private async consultarComponente<T extends EstadoGrafo & { componenteEncontrado: boolean }>(
    componenteId: string,
    consultarGrafo: (id: string) => Promise<T>,
  ) {
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

    if (inicial.tipo === 'TUBERIA' && inicial.tiene_conexiones === false) {
      throw new ConflictException(
        'La tubería no tiene conexiones de agua. Todavía no permite consultar espacios afectados.',
      );
    }

    this.comprobarControl(inicial);
    const grafo = await this.leerGrafo(() => consultarGrafo(id));
    this.comprobarGrafo(grafo, inicial.version_red);
    const final = await this.consultarEstado(id);

    this.comprobarControlFinal(final?.estado === 'ACTIVO' ? final : undefined, inicial.version_red);
    return { id, codigo: inicial.codigo, grafo };
  }

  private comprobarControl(control: ControlRed | undefined) {
    if (control?.version_red == null || control.eventos_sin_procesar) {
      throw new ServiceUnavailableException(
        'La red tiene cambios pendientes o su control no está disponible.',
      );
    }
  }

  private comprobarControlFinal(control: ControlRed | undefined, version: string) {
    if (control?.version_red !== version || control.eventos_sin_procesar) {
      throw new ServiceUnavailableException('La red cambió durante la consulta. Inténtalo nuevamente.');
    }
  }

  private comprobarGrafo(grafo: EstadoGrafo, version: string) {
    if (grafo.estadoRed !== 'INICIALIZADO' || grafo.versionRed !== version || grafo.componenteEncontrado === false) {
      throw new ServiceUnavailableException('El grafo no coincide con el estado de la red en PostgreSQL.');
    }
  }

  private async leerGrafo<T>(consultar: () => Promise<T>): Promise<T> {
    try {
      return await consultar();
    } catch {
      throw new ServiceUnavailableException('No fue posible consultar la red en Neo4j.');
    }
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
      (typeof datos.espacioId !== 'string' ||
        !formatoUuid.test(datos.espacioId))
    ) {
      throw new BadRequestException('El espacioId no es válido.');
    }

    if (datos.descripcion != null && typeof datos.descripcion !== 'string') {
      throw new BadRequestException('La descripción debe ser texto.');
    }

    const componenteId = randomUUID();
    const codigo = datos.codigo.trim().toUpperCase();
    if (codigo.length > 40)
      throw new BadRequestException(
        'El código normalizado supera 40 caracteres.',
      );
    const nombre = datos.nombre.trim();

    try {
      await this.repositorio.crearTuberia([
        componenteId,
        codigo,
        nombre,
        typeof datos.espacioId === 'string'
          ? datos.espacioId.toLowerCase()
          : null,
        typeof datos.descripcion === 'string' ? datos.descripcion.trim() : null,
      ]);
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

interface ControlRed {
  version_red?: string | null;
  eventos_sin_procesar: boolean;
}

interface EstadoGrafo {
  estadoRed: string;
  versionRed: string | null;
  componenteEncontrado?: boolean;
}
