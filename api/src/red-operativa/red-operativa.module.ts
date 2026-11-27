import { Module } from '@nestjs/common';
import { PostgresModule } from '../postgres/postgres.module.js';
import { RedOperativaController } from './red-operativa.controller.js';
import { RedOperativaService } from './red-operativa.service.js';
@Module({ imports: [PostgresModule], controllers: [RedOperativaController], providers: [RedOperativaService] })
export class RedOperativaModule {}
