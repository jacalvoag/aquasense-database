import { fechaValida } from '../common/fecha.js';
import { ReportesRepository } from './reportes.repository.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { MongodbService } from '../mongodb/mongodb.service.js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ReportesService {
  constructor(
    private readonly repositorio: ReportesRepository,
    private readonly mongodb: MongodbService,
  ) {}

  async listar() {
    const resultado = await this.repositorio.listar();

    return resultado.rows;
  }

  async consultarExpediente(reporteId: string) {
    const formatoUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!formatoUuid.test(reporteId)) {
      throw new BadRequestException(
        'El identificador del reporte no es válido.',
      );
    }

    const id = reporteId.toLowerCase();

    const resultado = await this.repositorio.consultarEstadoDocumental([id]);

    if (resultado.rows.length === 0) {
      throw new NotFoundException('El reporte no existe.');
    }

    const reporte = resultado.rows[0];

    if (
      reporte.estado_evento === 'PENDIENTE' ||
      reporte.estado_evento === 'ERROR'
    ) {
      return {
        reporteId: id,
        estadoDocumental: reporte.estado_evento,
        expediente: null,
      };
    }

    if (reporte.estado_evento !== 'PROCESADO' || !reporte.evento_id) {
      throw new ServiceUnavailableException(
        'No está disponible el estado documental del reporte.',
      );
    }

    let expediente;

    try {
      expediente = await this.mongodb.buscarExpediente(id);
    } catch {
      throw new ServiceUnavailableException(
        'No fue posible consultar el expediente en MongoDB.',
      );
    }

    const secuenciaMongo = expediente?.ultimaSecuenciaAplicada?.toString();

    if (
      !expediente ||
      secuenciaMongo !== reporte.secuencia_documental ||
      expediente.ultimoEventoId !== reporte.evento_id
    ) {
      throw new ServiceUnavailableException(
        'El expediente no coincide con el último evento confirmado.',
      );
    }

    return {
      reporteId: id,
      estadoDocumental: 'PROCESADO',
      expediente: {
        ...expediente,
        ultimaSecuenciaAplicada: secuenciaMongo,
      },
    };
  }

  async crear(entrada: unknown) {
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
      throw new BadRequestException('El cuerpo del reporte no es válido.');
    }

    const datos = entrada as Record<string, unknown>;
    const formatoUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof datos.espacioId !== 'string' ||
      !formatoUuid.test(datos.espacioId)
    ) {
      throw new BadRequestException('El espacioId no es válido.');
    }

    if (
      typeof datos.descripcionInicial !== 'string' ||
      datos.descripcionInicial.trim() === ''
    ) {
      throw new BadRequestException('La descripción inicial es obligatoria.');
    }

    if (
      datos.referenciaUbicacion != null &&
      typeof datos.referenciaUbicacion !== 'string'
    ) {
      throw new BadRequestException(
        'La referencia de ubicación debe ser texto.',
      );
    }

    const reporteId = randomUUID();
    const eventoId = randomUUID();

    try {
      await this.repositorio.crear([
        reporteId,
        eventoId,
        datos.espacioId.toLowerCase(),
        datos.descripcionInicial.trim(),
        typeof datos.referenciaUbicacion === 'string'
          ? datos.referenciaUbicacion.trim()
          : null,
      ]);
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23503'
      ) {
        throw new NotFoundException('El espacio indicado no existe.');
      }

      throw error;
    }

    return {
      reporteId,
      eventoId,
      estadoReporte: 'PENDIENTE',
      estadoDocumentalInicial: 'PENDIENTE',
    };
  }

  async registrarAtencion(reporteId: string, entrada: unknown) {
    const formatoUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!formatoUuid.test(reporteId)) {
      throw new BadRequestException(
        'El identificador del reporte no es válido.',
      );
    }

    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
      throw new BadRequestException('El cuerpo de la atención no es válido.');
    }

    const datos = entrada as Record<string, unknown>;

    if (
      datos.tipo !== 'INSPECCION' &&
      datos.tipo !== 'REPARACION' &&
      datos.tipo !== 'VERIFICACION'
    ) {
      throw new BadRequestException('El tipo de atención no es válido.');
    }

    if (!fechaValida(datos.fecha)) {
      throw new BadRequestException(
        'La fecha debe incluir fecha, hora y zona horaria.',
      );
    }

    if (
      typeof datos.descripcion !== 'string' ||
      datos.descripcion.trim() === ''
    ) {
      throw new BadRequestException('La descripción es obligatoria.');
    }

    if (
      datos.componenteId != null &&
      (typeof datos.componenteId !== 'string' ||
        !formatoUuid.test(datos.componenteId))
    ) {
      throw new BadRequestException('El componenteId no es válido.');
    }

    const atencionId = randomUUID();
    const eventoId = randomUUID();

    const atencion: Record<string, unknown> = {
      atencionId,
      tipo: datos.tipo,
      fecha: datos.fecha,
      descripcion: datos.descripcion.trim(),
    };

    if (typeof datos.componenteId === 'string') {
      atencion.componenteId = datos.componenteId.toLowerCase();
    }

    if (datos.tipo === 'INSPECCION') {
      if (
        typeof datos.hallazgos !== 'string' ||
        datos.hallazgos.trim() === ''
      ) {
        throw new BadRequestException('La inspección requiere hallazgos.');
      }

      atencion.hallazgos = datos.hallazgos.trim();
    }

    if (datos.tipo === 'REPARACION' && datos.materiales !== undefined) {
      if (
        !Array.isArray(datos.materiales) ||
        !datos.materiales.every(
          (material) => typeof material === 'string' && material.trim() !== '',
        )
      ) {
        throw new BadRequestException(
          'Los materiales deben ser una lista de textos no vacíos.',
        );
      }

      atencion.materiales = datos.materiales.map((material: string) =>
        material.trim(),
      );
    }

    if (datos.tipo === 'VERIFICACION') {
      if (
        datos.resultado !== 'SIN_INDICIOS' &&
        datos.resultado !== 'PERSISTE' &&
        datos.resultado !== 'NO_CONCLUYENTE'
      ) {
        throw new BadRequestException(
          'El resultado de la verificación no es válido.',
        );
      }

      atencion.resultado = datos.resultado;
    }

    try {
      await this.repositorio.registrarAtencion([
        eventoId,
        reporteId.toLowerCase(),
        JSON.stringify(atencion),
      ]);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === '23503') {
          throw new NotFoundException(
            'El reporte o el componente indicado no existe.',
          );
        }

        if (error.code === '23514' || error.code === '23502') {
          throw new UnprocessableEntityException(
            'La atención no cumple las reglas o el estado actual del reporte.',
          );
        }
      }

      throw error;
    }

    return {
      reporteId: reporteId.toLowerCase(),
      atencionId,
      eventoId,
      estadoDocumentalInicial: 'PENDIENTE',
    };
  }

  async cerrar(reporteId: string) {
    const formatoUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!formatoUuid.test(reporteId)) {
      throw new BadRequestException(
        'El identificador del reporte no es válido.',
      );
    }

    const id = reporteId.toLowerCase();

    try {
      await this.repositorio.cerrar([id]);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === '23503') {
          throw new NotFoundException('El reporte no existe.');
        }

        if (error.code === '23514') {
          throw new ConflictException(
            'El reporte no cumple las condiciones para cerrarse.',
          );
        }
      }

      throw error;
    }

    return {
      reporteId: id,
      estado: 'CERRADO',
    };
  }

  async reemplazarTuberia(reporteId: string, entrada: unknown) {
    const formatoUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!formatoUuid.test(reporteId)) {
      throw new BadRequestException(
        'El identificador del reporte no es válido.',
      );
    }

    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) {
      throw new BadRequestException('El cuerpo del reemplazo no es válido.');
    }

    const datos = entrada as Record<string, unknown>;

    if (
      typeof datos.tuberiaAnteriorId !== 'string' ||
      !formatoUuid.test(datos.tuberiaAnteriorId) ||
      typeof datos.tuberiaNuevaId !== 'string' ||
      !formatoUuid.test(datos.tuberiaNuevaId)
    ) {
      throw new BadRequestException(
        'Los identificadores de las tuberías no son válidos.',
      );
    }

    if (
      datos.tuberiaAnteriorId.toLowerCase() ===
      datos.tuberiaNuevaId.toLowerCase()
    ) {
      throw new BadRequestException(
        'La tubería anterior y la nueva deben ser diferentes.',
      );
    }

    if (!fechaValida(datos.fecha)) {
      throw new BadRequestException(
        'La fecha debe incluir fecha, hora y zona horaria.',
      );
    }

    if (
      typeof datos.descripcion !== 'string' ||
      datos.descripcion.trim() === ''
    ) {
      throw new BadRequestException('La descripción es obligatoria.');
    }

    if (
      datos.materiales !== undefined &&
      (!Array.isArray(datos.materiales) ||
        !datos.materiales.every(
          (material) => typeof material === 'string' && material.trim() !== '',
        ))
    ) {
      throw new BadRequestException(
        'Los materiales deben ser una lista de textos no vacíos.',
      );
    }

    const reemplazoId = randomUUID();
    const atencionId = randomUUID();
    const eventoDocumentalId = randomUUID();
    const eventoGrafoId = randomUUID();

    const atencion: Record<string, unknown> = {
      atencionId,
      tipo: 'REPARACION',
      fecha: datos.fecha,
      descripcion: datos.descripcion.trim(),
    };

    if (Array.isArray(datos.materiales)) {
      atencion.materiales = datos.materiales.map((material: string) =>
        material.trim(),
      );
    }

    try {
      await this.repositorio.reemplazarTuberia([
        reemplazoId,
        datos.tuberiaAnteriorId.toLowerCase(),
        datos.tuberiaNuevaId.toLowerCase(),
        reporteId.toLowerCase(),
        eventoDocumentalId,
        eventoGrafoId,
        JSON.stringify(atencion),
      ]);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === '23503') {
          throw new NotFoundException(
            'El reporte o alguna de las tuberías no existe.',
          );
        }

        if (error.code === '23514' || error.code === '23502') {
          throw new UnprocessableEntityException(
            'El reemplazo no cumple las reglas o el estado actual de la red.',
          );
        }
      }

      throw error;
    }

    return {
      reporteId: reporteId.toLowerCase(),
      reemplazoId,
      atencionId,
      eventoDocumentalId,
      eventoGrafoId,
      estadoDocumentalInicial: 'PENDIENTE',
      estadoGrafoInicial: 'PENDIENTE',
    };
  }

  async consultarEvento(reporteId: string, eventoId: string) {
    const formatoUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!formatoUuid.test(reporteId) || !formatoUuid.test(eventoId)) {
      throw new BadRequestException(
        'Los identificadores del reporte y del evento deben ser válidos.',
      );
    }

    const resultado = await this.repositorio.consultarEvento([
      eventoId.toLowerCase(),
      reporteId.toLowerCase(),
    ]);

    if (resultado.rows.length === 0) {
      throw new NotFoundException(
        'El evento no existe o no corresponde al reporte.',
      );
    }

    const evento = resultado.rows[0];

    return {
      reporteId: reporteId.toLowerCase(),
      eventoId: evento.evento_id,
      destino: evento.destino,
      tipo: evento.tipo,
      estado: evento.estado,
      secuencia: evento.secuencia,
      intentos: evento.intentos,
      registradoEn: evento.registrado_en,
      procesadoEn: evento.procesado_en,
    };
  }
}
