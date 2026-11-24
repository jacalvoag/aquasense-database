import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly pool: pg.Pool;

  constructor(config: ConfigService) {
    const puerto = Number(config.getOrThrow<string>('PGPORT'));

    if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
      throw new Error('PGPORT debe ser un puerto válido.');
    }

    this.pool = new pg.Pool({
      host: config.getOrThrow<string>('PGHOST'),
      port: puerto,
      database: config.getOrThrow<string>('PGDATABASE'),
      user: config.getOrThrow<string>('PGUSER'),
      password: config.getOrThrow<string>('PGPASSWORD'),
    });
  }

  async comprobarConexion(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async consultar(sql: string, parametros: unknown[] = []) {
    return this.pool.query(sql, parametros);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}