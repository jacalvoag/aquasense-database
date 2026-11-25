import { ComponentesRepository } from './componentes.repository.js';
import { Module } from '@nestjs/common';
import { PostgresModule } from '../postgres/postgres.module.js';
import { ComponentesController } from './componentes.controller.js';
import { ComponentesService } from './componentes.service.js';
import { Neo4jModule } from '../neo4j/neo4j.module.js';

@Module({
  imports: [PostgresModule, Neo4jModule],
  controllers: [ComponentesController],
  providers: [ComponentesService, ComponentesRepository],
})
export class ComponentesModule {}
