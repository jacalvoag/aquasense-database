import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PostgresService } from '../postgres/postgres.service.js';
import type { MongodbService } from '../mongodb/mongodb.service.js';
import { ReportesService } from './reportes.service.js';

const reporteId = '50000000-0000-0000-0000-000000000001';
const eventoId = '60000000-0000-0000-0000-000000000005';

function crearServicio() {
  const postgres = {
    consultar: vi.fn(),
  };

  const mongodb = {
    buscarExpediente: vi.fn(),
  };

  const servicio = new ReportesService(
    postgres as unknown as PostgresService,
    mongodb as unknown as MongodbService,
  );

  return { servicio, postgres, mongodb };
}

describe('ReportesService.consultarExpediente', () => {
  it('rechaza un identificador inválido', async () => {
    const { servicio, postgres } = crearServicio();

    await expect(
      servicio.consultarExpediente('identificador-invalido'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postgres.consultar).not.toHaveBeenCalled();
  });

  it('informa cuando el reporte no existe', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockResolvedValue({ rows: [] });

    await expect(
      servicio.consultarExpediente(reporteId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['PENDIENTE', 'ERROR'])(
    'informa el estado %s sin devolver el expediente',
    async (estado) => {
      const { servicio, postgres, mongodb } = crearServicio();

      postgres.consultar.mockResolvedValue({
        rows: [{
          reporte_id: reporteId,
          secuencia_documental: '4',
          evento_id: eventoId,
          estado_evento: estado,
        }],
      });

      await expect(
        servicio.consultarExpediente(reporteId),
      ).resolves.toEqual({
        reporteId,
        estadoDocumental: estado,
        expediente: null,
      });

      expect(mongodb.buscarExpediente).not.toHaveBeenCalled();
    },
  );

  it('devuelve el expediente cuando coincide con el evento confirmado', async () => {
    const { servicio, postgres, mongodb } = crearServicio();

    postgres.consultar.mockResolvedValue({
      rows: [{
        reporte_id: reporteId,
        secuencia_documental: '4',
        evento_id: eventoId,
        estado_evento: 'PROCESADO',
      }],
    });

    mongodb.buscarExpediente.mockResolvedValue({
      reporteId,
      ultimaSecuenciaAplicada: 4,
      ultimoEventoId: eventoId,
      atenciones: [],
    });

    await expect(
      servicio.consultarExpediente(reporteId),
    ).resolves.toEqual({
      reporteId,
      estadoDocumental: 'PROCESADO',
      expediente: {
        reporteId,
        ultimaSecuenciaAplicada: '4',
        ultimoEventoId: eventoId,
        atenciones: [],
      },
    });
  });

  it('rechaza un expediente que no coincide con el evento confirmado', async () => {
    const { servicio, postgres, mongodb } = crearServicio();

    postgres.consultar.mockResolvedValue({
      rows: [{
        reporte_id: reporteId,
        secuencia_documental: '4',
        evento_id: eventoId,
        estado_evento: 'PROCESADO',
      }],
    });

    mongodb.buscarExpediente.mockResolvedValue({
      reporteId,
      ultimaSecuenciaAplicada: 3,
      ultimoEventoId: eventoId,
      atenciones: [],
    });

    await expect(
      servicio.consultarExpediente(reporteId),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});