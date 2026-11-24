import { Module } from '@nestjs/common';
import { PostgresModule } from '../postgres/postgres.module.js';
import { ReportesController } from './reportes.controller.js';
import { ReportesService } from './reportes.service.js';
import { MongodbModule } from '../mongodb/mongodb.module.js';

@Module({
  imports: [PostgresModule, MongodbModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}