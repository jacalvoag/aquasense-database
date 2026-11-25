import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PostgresService } from '../src/postgres/postgres.service.js';
import { MongodbService } from '../src/mongodb/mongodb.service.js';
import { Neo4jService } from '../src/neo4j/neo4j.service.js';
import { configurarHttp } from '../src/common/configurar-http.js';

// Pruebas HTTP del contrato. Los drivers se sustituyen; no validan las bases reales.
describe('Contrato HTTP de la API', () => {
  let app: INestApplication;
  const consultar = vi.fn();
  const id = '50000000-0000-0000-0000-000000000001';
  const espacio = '10000000-0000-0000-0000-000000000010';
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          API_OPERATOR_USER: 'operador',
          API_OPERATOR_PASSWORD: 'clave-solo-pruebas',
          CORS_ORIGINS: 'http://localhost:5173',
        }),
      )
      .overrideProvider(PostgresService)
      .useValue({ consultar, comprobarConexion: vi.fn() })
      .overrideProvider(MongodbService)
      .useValue({ buscarExpediente: vi.fn(), comprobarConexion: vi.fn() })
      .overrideProvider(Neo4jService)
      .useValue({
        consultarEspaciosAlcanzables: vi.fn(),
        comprobarConexion: vi.fn(),
      })
      .compile();
    app = module.createNestApplication();
    configurarHttp(app);
    await app.init();
  });
  beforeEach(() => {
    consultar.mockReset();
    consultar.mockResolvedValue({ rows: [] });
  });
  afterAll(async () => {
    await app?.close();
  });
  it('permite consultar espacios sin credenciales', async () => {
    await request(app.getHttpServer()).get('/espacios').expect(200);
  });
  it('rechaza escritura anónima antes de consultar PostgreSQL', async () => {
    await request(app.getHttpServer()).post('/reportes').send({}).expect(401);
    expect(consultar).not.toHaveBeenCalled();
  });
  it('rechaza contraseña incorrecta', async () => {
    await request(app.getHttpServer())
      .post('/reportes')
      .auth('operador', 'incorrecta')
      .send({})
      .expect(401);
    expect(consultar).not.toHaveBeenCalled();
  });
  it('valida el cuerpo después de autorizar', async () => {
    await request(app.getHttpServer())
      .post('/reportes')
      .auth('operador', 'clave-solo-pruebas')
      .send({})
      .expect(400);
  });
  it('crea un reporte y devuelve sus identificadores', async () => {
    const r = await request(app.getHttpServer())
      .post('/reportes')
      .auth('operador', 'clave-solo-pruebas')
      .send({ espacioId: espacio, descripcionInicial: 'Humedad' })
      .expect(201);
    expect(r.body.estadoDocumentalInicial).toBe('PENDIENTE');
    expect(r.body.reporteId).toEqual(expect.any(String));
  });
  it('rechaza fechas de calendario inválidas', async () => {
    await request(app.getHttpServer())
      .post('/lecturas')
      .auth('operador', 'clave-solo-pruebas')
      .send({
        medidorId: espacio,
        fechaHora: '2026-02-30T10:00:00Z',
        valorAcumulado: '100.000',
      })
      .expect(400);
    expect(consultar).not.toHaveBeenCalled();
  });
  it('registra lectura', async () => {
    await request(app.getHttpServer())
      .post('/lecturas')
      .auth('operador', 'clave-solo-pruebas')
      .send({
        medidorId: espacio,
        fechaHora: '2026-11-24T10:00:00Z',
        valorAcumulado: '100.000',
      })
      .expect(201);
  });
  it('crea tubería', async () => {
    const r = await request(app.getHttpServer())
      .post('/componentes/tuberias')
      .auth('operador', 'clave-solo-pruebas')
      .send({ codigo: ' tub-99 ', nombre: 'Repuesto' })
      .expect(201);
    expect(r.body.codigo).toBe('TUB-99');
  });
  it('cierra reporte', async () => {
    const r = await request(app.getHttpServer())
      .post(`/reportes/${id}/cerrar`)
      .auth('operador', 'clave-solo-pruebas')
      .expect(200);
    expect(r.body.estado).toBe('CERRADO');
  });
  it('traduce evento pendiente en conflicto sin filtrar detalles SQL', async () => {
    consultar.mockRejectedValue({ code: '23505', detail: 'dato interno' });
    const r = await request(app.getHttpServer())
      .post(`/reportes/${id}/atenciones`)
      .auth('operador', 'clave-solo-pruebas')
      .send({
        tipo: 'INSPECCION',
        fecha: '2026-11-24T10:00:00Z',
        descripcion: 'Revisión',
        hallazgos: 'Humedad',
      })
      .expect(409);
    expect(JSON.stringify(r.body)).not.toContain('dato interno');
  });
  it('traduce caída de PostgreSQL a 503', async () => {
    consultar.mockRejectedValue({ code: 'ECONNREFUSED' });
    await request(app.getHttpServer()).get('/espacios').expect(503);
  });
  it('atiende preflight para el origen configurado', async () => {
    const r = await request(app.getHttpServer())
      .options('/reportes')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization,Content-Type')
      .expect(204);
    expect(r.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });
  it('no autoriza CORS para otro origen', async () => {
    const r = await request(app.getHttpServer())
      .get('/espacios')
      .set('Origin', 'https://ejemplo.invalid');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });
});
