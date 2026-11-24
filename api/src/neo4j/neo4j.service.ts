import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { type Driver } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnModuleDestroy {
  private readonly driver: Driver;
  private readonly nombreBase: string;

  constructor(config: ConfigService) {
    this.driver = neo4j.driver(
      config.getOrThrow<string>('NEO4J_URI'),
      neo4j.auth.basic(
        config.getOrThrow<string>('NEO4J_USER'),
        config.getOrThrow<string>('NEO4J_PASSWORD'),
      ),
    );

    this.nombreBase = config.getOrThrow<string>('NEO4J_DATABASE');
  }

  async comprobarConexion(): Promise<void> {
    const sesion = this.driver.session({ database: this.nombreBase });

    try {
      await sesion.run('RETURN 1 AS prueba');
    } finally {
      await sesion.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.driver.close();
  }
}