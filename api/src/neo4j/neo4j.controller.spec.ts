import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Neo4jController } from './neo4j.controller.js';
import type { Neo4jService } from './neo4j.service.js';

describe('Neo4jController', () => {
  it('devuelve ok cuando Neo4j responde', async () => {
    const neo4j = {
      comprobarConexion: vi.fn().mockResolvedValue(undefined),
    } as unknown as Neo4jService;

    const controller = new Neo4jController(neo4j);

    await expect(controller.comprobarNeo4j()).resolves.toEqual({
      estado: 'ok',
    });
  });

  it('informa que el servicio no está disponible si falla la conexión', async () => {
    const neo4j = {
      comprobarConexion: vi.fn().mockRejectedValue(
        new Error('Error de conexión'),
      ),
    } as unknown as Neo4jService;

    const controller = new Neo4jController(neo4j);

    await expect(controller.comprobarNeo4j()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});