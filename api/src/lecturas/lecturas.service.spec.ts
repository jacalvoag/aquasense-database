import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PostgresService } from '../postgres/postgres.service.js';
import { LecturasService } from './lecturas.service.js';

const medidorId = '20000000-0000-0000-0000-000000000002';

const lectura = {
  medidorId,
  fechaHora: '2026-11-24T11:56:33Z',
  valorAcumulado: '120.000',
};

function crearServicio() {
  const postgres = {
    consultar: vi.fn(),
  };

  const servicio = new LecturasService(
    postgres as unknown as PostgresService,
  );

  return { servicio, postgres };
}

describe('LecturasService.registrar', () => {
  it('rechaza un medidor con identificador inválido', async () => {
    const { servicio, postgres } = crearServicio();

    await expect(
      servicio.registrar({
        ...lectura,
        medidorId: 'invalido',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postgres.consultar).not.toHaveBeenCalled();
  });

  it('rechaza una fecha sin zona horaria', async () => {
    const { servicio, postgres } = crearServicio();

    await expect(
      servicio.registrar({
        ...lectura,
        fechaHora: '2026-11-24T11:56:33',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postgres.consultar).not.toHaveBeenCalled();
  });

  it('rechaza un valor con más de tres decimales', async () => {
    const { servicio, postgres } = crearServicio();

    await expect(
      servicio.registrar({
        ...lectura,
        valorAcumulado: '120.0001',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postgres.consultar).not.toHaveBeenCalled();
  });

  it('registra la lectura mediante PostgreSQL', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockResolvedValue({ rows: [] });

    const resultado = await servicio.registrar(lectura);

    expect(resultado).toEqual({
      lecturaId: expect.any(String),
      ...lectura,
    });

    expect(postgres.consultar).toHaveBeenCalledWith(
      expect.stringContaining('aquasense.registrar_lectura'),
      [
        resultado.lecturaId,
        lectura.medidorId,
        lectura.fechaHora,
        lectura.valorAcumulado,
      ],
    );
  });

  it('informa cuando el medidor no existe', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockRejectedValue({ code: '23503' });

    await expect(
      servicio.registrar(lectura),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('informa cuando la lectura incumple las reglas del medidor', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockRejectedValue({ code: '23514' });

    await expect(
      servicio.registrar(lectura),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});