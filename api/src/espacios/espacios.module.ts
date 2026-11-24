import { Module } from '@nestjs/common';
import { PostgresModule } from '../postgres/postgres.module.js';
import { EspaciosController } from './espacios.controller.js';
import { EspaciosService } from './espacios.service.js';

@Module({
  imports: [PostgresModule],
  controllers: [EspaciosController],
  providers: [EspaciosService],
})
export class EspaciosModule {}