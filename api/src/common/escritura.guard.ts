import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

@Injectable()
export class EscrituraGuard implements CanActivate {
  private readonly credencial: Buffer;

  constructor(config: ConfigService) {
    const usuario = config.getOrThrow<string>('API_OPERATOR_USER');
    const clave = config.getOrThrow<string>('API_OPERATOR_PASSWORD');
    if (!usuario || usuario.includes(':') || !clave || clave === 'CAMBIAR') {
      throw new Error(
        'Configura API_OPERATOR_USER y una API_OPERATOR_PASSWORD propia.',
      );
    }
    this.credencial = Buffer.from(`${usuario}:${clave}`, 'utf8');
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const header = req.headers.authorization;
    const coincidencia = header?.match(/^Basic ([A-Za-z0-9+/]+={0,2})$/i);
    const recibida = Buffer.from(coincidencia?.[1] ?? '', 'base64');
    if (
      recibida.length === this.credencial.length &&
      timingSafeEqual(recibida, this.credencial)
    )
      return true;
    http
      .getResponse<Response>()
      .setHeader(
        'WWW-Authenticate',
        'Basic realm="AquaSense", charset="UTF-8"',
      );
    throw new UnauthorizedException(
      'Se requiere la credencial de operador para esta operación.',
    );
  }
}
