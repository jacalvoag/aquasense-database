import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MongodbService } from './mongodb.service.js';

@Controller('salud')
export class MongodbController {
  constructor(private readonly mongodb: MongodbService) {}

  @Get('mongodb')
  async comprobarMongodb(): Promise<{ estado: string }> {
    try {
      await this.mongodb.comprobarConexion();
      return { estado: 'ok' };
    } catch {
      throw new ServiceUnavailableException(
        'MongoDB no está disponible.',
      );
    }
  }
}