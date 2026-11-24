import { Module } from '@nestjs/common';
import { PostgresModule } from '../postgres/postgres.module.js';
import { ComponentesController } from './componentes.controller.js';
import { ComponentesService } from './componentes.service.js';

@Module({
  imports: [PostgresModule],
  controllers: [ComponentesController],
  providers: [ComponentesService],
})
export class ComponentesModule {}