import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PostgresService } from './postgres.service.js';

@Controller('salud')
export class PostgresController {
  constructor(private readonly postgres: PostgresService) {}

  @Get('postgres')
  async comprobarPostgres(): Promise<{ estado: string }> {
    try {
      await this.postgres.comprobarConexion();
      return { estado: 'ok' };
    } catch {
      throw new ServiceUnavailableException(
        'PostgreSQL no está disponible.',
      );
    }
  }
}