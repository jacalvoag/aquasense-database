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

describe('ComponentesService.crearTuberia', () => {
  const tuberia = {
    codigo: 'TUB-15',
    nombre: 'Tubería de reemplazo',
    espacioId: '10000000-0000-0000-0000-000000000010',
    descripcion: 'Tubería preparada para una reparación.',
  };

  it('rechaza un código vacío', async () => {
    const { servicio, postgres } = crearServicio();

    await expect(
      servicio.crearTuberia({ ...tuberia, codigo: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postgres.consultar).not.toHaveBeenCalled();
  });

  it('registra una tubería activa sin conexiones', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockResolvedValue({ rows: [] });

    const resultado = await servicio.crearTuberia({
      ...tuberia,
      codigo: ' tub-15 ',
    });

    expect(resultado).toEqual({
      componenteId: expect.any(String),
      codigo: 'TUB-15',
      nombre: tuberia.nombre,
      tipo: 'TUBERIA',
      estado: 'ACTIVO',
    });

    expect(postgres.consultar).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO aquasense.componente'),
      [
        resultado.componenteId,
        'TUB-15',
        tuberia.nombre,
        tuberia.espacioId,
        tuberia.descripcion,
      ],
    );
  });

  it('informa cuando el espacio no existe', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockRejectedValue({ code: '23503' });

    await expect(
      servicio.crearTuberia(tuberia),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('informa cuando el código ya existe', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockRejectedValue({ code: '23505' });

    await expect(
      servicio.crearTuberia(tuberia),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ComponentesService.listar', () => {
  it('incluye si un componente tiene conexiones', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockResolvedValue({
      rows: [{
        componente_id: '20000000-0000-0000-0000-000000000021',
        codigo: 'TUB-15',
        tipo: 'TUBERIA',
        estado: 'ACTIVO',
        tiene_conexiones: false,
      }],
    });

    await expect(servicio.listar()).resolves.toEqual([
      expect.objectContaining({
        codigo: 'TUB-15',
        tiene_conexiones: false,
      }),
    ]);

    expect(postgres.consultar).toHaveBeenCalledWith(
      expect.stringContaining('AS tiene_conexiones'),
    );
  });
});