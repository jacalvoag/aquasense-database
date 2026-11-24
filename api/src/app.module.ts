import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PostgresModule } from './postgres/postgres.module.js';
import { EspaciosModule } from './espacios/espacios.module.js';
import { ComponentesModule } from './componentes/componentes.module.js';
import { LecturasModule } from './lecturas/lecturas.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PostgresModule,
    EspaciosModule,
    ComponentesModule,
    LecturasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}