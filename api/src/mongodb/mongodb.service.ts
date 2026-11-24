import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';

@Injectable()
export class MongodbService implements OnModuleDestroy {
  private readonly cliente: MongoClient;
  private readonly base: Db;

  constructor(config: ConfigService) {
    this.cliente = new MongoClient(
      config.getOrThrow<string>('MONGODB_URI'),
    );

    this.base = this.cliente.db(
      config.getOrThrow<string>('MONGODB_DATABASE'),
    );
  }

  async comprobarConexion(): Promise<void> {
    await this.cliente.connect();
    await this.base.command({ ping: 1 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.cliente.close();
  }
}