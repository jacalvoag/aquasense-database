import { Module } from '@nestjs/common';
import { PostgresModule } from '../postgres/postgres.module.js';
import { LecturasController } from './lecturas.controller.js';
import { LecturasService } from './lecturas.service.js';

@Module({
  imports: [PostgresModule],
  controllers: [LecturasController],
  providers: [LecturasService],
})
export class LecturasModule {}