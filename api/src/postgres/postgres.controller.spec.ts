import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PostgresController } from './postgres.controller.js';
import type { PostgresService } from './postgres.service.js';

describe('PostgresController', () => {
  it('devuelve ok cuando PostgreSQL responde', async () => {
    const postgres = {
      comprobarConexion: vi.fn().mockResolvedValue(undefined),
    } as unknown as PostgresService;

    const controller = new PostgresController(postgres);

    await expect(controller.comprobarPostgres()).resolves.toEqual({
      estado: 'ok',
    });
  });

  it('informa que el servicio no está disponible si falla la conexión', async () => {
    const postgres = {
      comprobarConexion: vi.fn().mockRejectedValue(new Error('Error de conexión')),
    } as unknown as PostgresService;

    const controller = new PostgresController(postgres);

    await expect(controller.comprobarPostgres()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});