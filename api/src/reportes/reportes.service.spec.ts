import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
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

describe('ReportesService.crear', () => {
  it('rechaza un cuerpo inválido sin consultar PostgreSQL', async () => {
    const { servicio, postgres } = crearServicio();

    await expect(servicio.crear(null)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(postgres.consultar).not.toHaveBeenCalled();
  });

  it('rechaza una descripción vacía', async () => {
    const { servicio, postgres } = crearServicio();

    await expect(
      servicio.crear({
        espacioId: '10000000-0000-0000-0000-000000000010',
        descripcionInicial: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postgres.consultar).not.toHaveBeenCalled();
  });

  it('crea el reporte mediante la función de PostgreSQL', async () => {
    const { servicio, postgres, mongodb } = crearServicio();

    postgres.consultar.mockResolvedValue({ rows: [] });

    const resultado = await servicio.crear({
      espacioId: '10000000-0000-0000-0000-000000000010',
      descripcionInicial: '  Humedad cerca de los lavabos.  ',
      referenciaUbicacion: '  Baños de UD1  ',
    });

    expect(resultado.estadoReporte).toBe('PENDIENTE');
    expect(resultado.estadoDocumentalInicial).toBe('PENDIENTE');

    expect(postgres.consultar).toHaveBeenCalledWith(
      expect.stringContaining('aquasense.crear_reporte'),
      [
        resultado.reporteId,
        resultado.eventoId,
        '10000000-0000-0000-0000-000000000010',
        'Humedad cerca de los lavabos.',
        'Baños de UD1',
      ],
    );

    expect(mongodb.buscarExpediente).not.toHaveBeenCalled();
  });

  it('informa cuando el espacio no existe', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockRejectedValue({ code: '23503' });

    await expect(
      servicio.crear({
        espacioId: '10000000-0000-0000-0000-000000000010',
        descripcionInicial: 'Reporte de prueba.',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ReportesService.registrarAtencion', () => {
  const inspeccion = {
    tipo: 'INSPECCION',
    fecha: '2026-11-24T11:31:48Z',
    descripcion: 'Se revisó el área reportada.',
    hallazgos: 'Se observó humedad.',
  };

  it('rechaza una inspección sin hallazgos', async () => {
    const { servicio, postgres } = crearServicio();

    await expect(
      servicio.registrarAtencion(reporteId, {
        ...inspeccion,
        hallazgos: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(postgres.consultar).not.toHaveBeenCalled();
  });

  it('registra una inspección mediante PostgreSQL', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockResolvedValue({ rows: [] });

    const resultado = await servicio.registrarAtencion(
      reporteId,
      inspeccion,
    );

    expect(resultado.estadoDocumentalInicial).toBe('PENDIENTE');

    expect(postgres.consultar).toHaveBeenCalledWith(
      expect.stringContaining('aquasense.registrar_atencion'),
      [
        resultado.eventoId,
        reporteId,
        expect.any(String),
      ],
    );

    const parametros = postgres.consultar.mock.calls[0][1] as unknown[];
    const atencion = JSON.parse(parametros[2] as string);

    expect(atencion).toMatchObject({
      ...inspeccion,
      atencionId: resultado.atencionId,
    });
  });

  it('informa cuando el reporte o componente no existe', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockRejectedValue({ code: '23503' });

    await expect(
      servicio.registrarAtencion(reporteId, inspeccion),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('informa cuando PostgreSQL rechaza la atención por sus reglas', async () => {
    const { servicio, postgres } = crearServicio();

    postgres.consultar.mockRejectedValue({ code: '23514' });

    await expect(
      servicio.registrarAtencion(reporteId, inspeccion),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});