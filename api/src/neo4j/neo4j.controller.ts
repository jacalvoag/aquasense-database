import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Neo4jService } from './neo4j.service.js';

@Controller('salud')
export class Neo4jController {
  constructor(private readonly neo4j: Neo4jService) {}

  @Get('neo4j')
  async comprobarNeo4j(): Promise<{ estado: string }> {
    try {
      await this.neo4j.comprobarConexion();
      return { estado: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Neo4j no está disponible.');
    }
  }
}