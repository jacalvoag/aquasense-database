import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { EscrituraGuard } from './common/escritura.guard.js';
import { PersistenciaFilter } from './common/persistencia.filter.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PostgresModule } from './postgres/postgres.module.js';
import { EspaciosModule } from './espacios/espacios.module.js';
import { ComponentesModule } from './componentes/componentes.module.js';
import { LecturasModule } from './lecturas/lecturas.module.js';
import { ReportesModule } from './reportes/reportes.module.js';
import { MongodbModule } from './mongodb/mongodb.module.js';
import { Neo4jModule } from './neo4j/neo4j.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PostgresModule,
    EspaciosModule,
    ComponentesModule,
    LecturasModule,
    ReportesModule,
    MongodbModule,
    Neo4jModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: EscrituraGuard },
    { provide: APP_FILTER, useClass: PersistenciaFilter },
  ],
})
export class AppModule {}
