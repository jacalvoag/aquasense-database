import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PostgresService } from '../postgres/postgres.service.js';
import { RedOperativaService } from './red-operativa.service.js';
const origen = '20000000-0000-0000-0000-000000000003';
const destino = '20000000-0000-0000-0000-000000000007';
const espacio = '10000000-0000-0000-0000-000000000012';
function crear() {
  const postgres = { consultar: vi.fn().mockResolvedValue({ rows: [] }) };
  return { postgres, servicio: new RedOperativaService(postgres as unknown as PostgresService) };
}
describe('Altas de la red', () => {
  it.each([null, [], {}, { nombre: 'Nuevo', tipo: 'INVENTADO' }, { nombre: '  ', tipo: 'OTRO' },
    { nombre: 'Nuevo', tipo: 'OTRO', espacioContenedorId: 'mal' }])('rechaza espacio inválido: %j', async (entrada) => {
    const { postgres, servicio } = crear();
    await expect(servicio.crearEspacio(entrada)).rejects.toBeInstanceOf(BadRequestException);
    expect(postgres.consultar).not.toHaveBeenCalled();
  });
  it('registra un espacio y su evento en una sola operación', async () => {
    const { postgres, servicio } = crear();
    const r = await servicio.crearEspacio({ nombre: ' Riego nuevo ', tipo: 'ZONA_RIEGO', espacioContenedorId: espacio });
    expect(postgres.consultar).toHaveBeenCalledWith(expect.stringContaining('registrar_espacio_red'),
      [r.espacioId, r.eventoId, 'Riego nuevo', 'ZONA_RIEGO', espacio, null]);
    expect(r.estadoGrafoInicial).toBe('PENDIENTE');
  });
  it.each(['CISTERNA', 'TUBERIA', 'UNION', 'MEDIDOR', 'VALVULA'])('registra el tipo %s con su operación transaccional', async (tipo) => {
    const { postgres, servicio } = crear();
    const r = await servicio.crearComponente({ codigo: ' nuevo-01 ', nombre: 'Nuevo componente', tipo, espacioId: espacio });
    expect(postgres.consultar).toHaveBeenCalledWith(expect.stringContaining('registrar_componente_red'),
      [r.componenteId, r.eventoId, 'NUEVO-01', 'Nuevo componente', tipo, espacio, null, 'DESCONOCIDA']);
  });
  it('rechaza posición ajena al tipo y códigos normalizados demasiado largos', async () => {
    const { postgres, servicio } = crear();
    await expect(servicio.crearComponente({ codigo: 'T-1', nombre: 'Nueva', tipo: 'TUBERIA', posicion: 'ABIERTA' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.crearComponente({ codigo: 'ß'.repeat(30), nombre: 'Nueva', tipo: 'TUBERIA' })).rejects.toBeInstanceOf(BadRequestException);
    expect(postgres.consultar).not.toHaveBeenCalled();
  });
});
describe('Administración de conexiones', () => {
  it.each([{}, { componenteOrigenId: origen }, { componenteOrigenId: origen, componenteDestinoId: destino, espacioDestinoId: espacio },
    { componenteOrigenId: origen, componenteDestinoId: origen }])('rechaza extremos inválidos: %j', async (entrada) => {
    const { servicio, postgres } = crear();
    await expect(servicio.crearConexion(entrada)).rejects.toBeInstanceOf(BadRequestException);
    expect(postgres.consultar).not.toHaveBeenCalled();
  });
  it('crea, cambia y elimina mediante las funciones SQL existentes', async () => {
    const { servicio, postgres } = crear();
    const nueva = await servicio.crearConexion({ componenteOrigenId: origen, componenteDestinoId: destino });
    expect(postgres.consultar).toHaveBeenLastCalledWith(expect.stringContaining('crear_conexion_red'), [nueva.conexionId, origen, destino, null, nueva.eventoId]);
    const cambiada = await servicio.actualizarConexion(nueva.conexionId, { componenteOrigenId: destino, espacioDestinoId: espacio });
    expect(postgres.consultar).toHaveBeenLastCalledWith(expect.stringContaining('actualizar_conexion_red'), [nueva.conexionId, destino, null, espacio, cambiada.eventoId]);
    const retirada = await servicio.eliminarConexion(nueva.conexionId);
    expect(postgres.consultar).toHaveBeenLastCalledWith(expect.stringContaining('eliminar_conexion_red'), [nueva.conexionId, retirada.eventoId]);
  });
  it('comunica el rechazo de un ciclo sin ocultar un fallo inesperado', async () => {
    const { servicio, postgres } = crear();
    postgres.consultar.mockRejectedValueOnce({ code: '23514', message: 'La conexión formaría un ciclo en la red.' });
    await expect(servicio.crearConexion({ componenteOrigenId: origen, componenteDestinoId: destino })).rejects.toBeInstanceOf(UnprocessableEntityException);
    const error = new Error('Prueba de persistencia');
    postgres.consultar.mockRejectedValueOnce(error);
    await expect(servicio.eliminarConexion(destino)).rejects.toBe(error);
  });
  it('solo permite consultar eventos de grafo e informa si no existen', async () => {
    const { servicio, postgres } = crear();
    await expect(servicio.evento('invalido')).rejects.toBeInstanceOf(BadRequestException);
    expect(postgres.consultar).not.toHaveBeenCalled();
    await expect(servicio.evento(destino)).rejects.toBeInstanceOf(NotFoundException);
    expect(postgres.consultar).toHaveBeenCalledWith(expect.stringContaining("destino = 'GRAFO'"), [destino]);
  });
});
