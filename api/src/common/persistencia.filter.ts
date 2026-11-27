import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class PersistenciaFilter implements ExceptionFilter {
  private readonly logger = new Logger(PersistenciaFilter.name);
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      res
        .status(error.getStatus())
        .json(
          typeof body === 'string'
            ? { statusCode: error.getStatus(), message: body }
            : body,
        );
      return;
    }
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
    let statusCode = 500,
      message = 'No fue posible completar la operación.';
    if (code === '42883') {
      statusCode = 503;
      message = 'La base necesita las migraciones de red 35 y 36. Solicita al responsable que las aplique.';
    } else if (code === '23505') {
      statusCode = 409;
      message =
        'Existe un registro en conflicto o un evento documental pendiente. Revisa su estado antes de continuar.';
    } else if (
      ['22P02', '22007', '22008', '22003', '23502', '23514'].includes(code)
    ) {
      statusCode = 400;
      message =
        'Los datos no cumplen el formato o las restricciones de la operación.';
    } else if (code === '23503') {
      statusCode = 404;
      message = 'No existe uno de los registros relacionados.';
    } else if (
      [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'EHOSTUNREACH',
        '57P01',
        '57P02',
        '57P03',
        '53300',
      ].includes(code) ||
      code.startsWith('08')
    ) {
      statusCode = 503;
      message = 'La base de datos no está disponible. Inténtalo nuevamente.';
    }
    if (statusCode === 500)
      this.logger.error(
        'Error interno de persistencia',
        error instanceof Error ? error.stack : code,
      );
    res.status(statusCode).json({ statusCode, message });
  }
}
