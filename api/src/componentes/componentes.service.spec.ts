import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PostgresService } from '../postgres/postgres.service.js';
import type { Neo4jService } from '../neo4j/neo4j.service.js';
import { ComponentesService } from './componentes.service.js';

const componenteId = '20000000-0000-0000-0000-000000000005';

function crearServicio() {
  const postgres = {
    consultar: vi.fn(),
  };

  const neo4j = {
    consultarEspaciosAlcanzables: vi.fn(),
  };

  const servicio = new ComponentesService(
    postgres as unknown as PostgresService,
    neo4j as unknown as Neo4jService,
  );

  return { servicio, postgres, neo4j };
}

function estado(overrides: Record<string, unknown> = {}) {
  return {
    componente_id: componenteId,
    codigo: 'TUB-02',
    estado: 'ACTIVO',
    version_red: '9',
    eventos_sin_procesar: false,
    ...overrides,
  };
}

function grafo(overrides: Record<string, unknown> = {}) {
  return {
    estadoRed: 'INICIALIZADO',
    versionRed: '9',
    componenteEncontrado: true,
    espacios: [{
      espacioId: '10000000-0000-0000-0000-000000000010',
      nombre: 'Baños de estudiantes de UD1',
      tipo: 'BAÑO',
    }],
    ...overrides,
  };
}

describe('ComponentesService.espaciosAfectados', () => {
  it('rechaza un identificador inválido', async () => {
    const { servicio, postgres } = crearServicio();

    await expect(
      servicio.espaciosAfectados('no-es-un-uuid'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postgres.consultar).not.toHaveBeenCalled();
  });

  it('informa cuando el componente no existe', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockResolvedValue({ rows: [] });

    await expect(
      servicio.espaciosAfectados(componenteId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza un componente retirado', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockResolvedValue({
      rows: [estado({ estado: 'RETIRADO' })],
    });

    await expect(
      servicio.espaciosAfectados(componenteId),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('no consulta el grafo si hay eventos sin procesar', async () => {
    const { servicio, postgres, neo4j } = crearServicio();

    postgres.consultar.mockResolvedValue({
      rows: [estado({ eventos_sin_procesar: true })],
    });

    await expect(
      servicio.espaciosAfectados(componenteId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(neo4j.consultarEspaciosAlcanzables).not.toHaveBeenCalled();
  });

  it('rechaza una versión de grafo distinta', async () => {
    const { servicio, postgres, neo4j } = crearServicio();

    postgres.consultar.mockResolvedValue({ rows: [estado()] });
    neo4j.consultarEspaciosAlcanzables.mockResolvedValue(
      grafo({ versionRed: '8' }),
    );

    await expect(
      servicio.espaciosAfectados(componenteId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rechaza el resultado si la red cambia durante la consulta', async () => {
    const { servicio, postgres, neo4j } = crearServicio();

    postgres.consultar
      .mockResolvedValueOnce({ rows: [estado()] })
      .mockResolvedValueOnce({ rows: [estado({ version_red: '10' })] });

    neo4j.consultarEspaciosAlcanzables.mockResolvedValue(grafo());

    await expect(
      servicio.espaciosAfectados(componenteId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('devuelve los espacios cuando las versiones coinciden', async () => {
    const { servicio, postgres, neo4j } = crearServicio();

    postgres.consultar.mockResolvedValue({ rows: [estado()] });
    neo4j.consultarEspaciosAlcanzables.mockResolvedValue(grafo());

    await expect(
      servicio.espaciosAfectados(componenteId),
    ).resolves.toEqual({
      componenteId,
      codigo: 'TUB-02',
      versionRed: '9',
      espacios: grafo().espacios,
    });
  });
});