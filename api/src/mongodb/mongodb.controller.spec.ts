import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { MongodbController } from './mongodb.controller.js';
import type { MongodbService } from './mongodb.service.js';

describe('MongodbController', () => {
  it('devuelve ok cuando MongoDB responde', async () => {
    const mongodb = {
      comprobarConexion: vi.fn().mockResolvedValue(undefined),
    } as unknown as MongodbService;

    const controller = new MongodbController(mongodb);

    await expect(controller.comprobarMongodb()).resolves.toEqual({
      estado: 'ok',
    });
  });

  it('informa que el servicio no está disponible si falla la conexión', async () => {
    const mongodb = {
      comprobarConexion: vi.fn().mockRejectedValue(
        new Error('Error de conexión'),
      ),
    } as unknown as MongodbService;

    const controller = new MongodbController(mongodb);

    await expect(controller.comprobarMongodb()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});