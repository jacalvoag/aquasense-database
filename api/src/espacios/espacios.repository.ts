import { Injectable } from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service.js';

@Injectable()
export class EspaciosRepository {
  constructor(private readonly postgres: PostgresService) {}

  async listar() {
    const resultado = await this.postgres.consultar(`
      SELECT
        espacio_id,
        nombre,
        tipo,
        espacio_contenedor_id,
        descripcion
      FROM aquasense.espacio
      ORDER BY nombre, espacio_id
    `);

    return resultado.rows;
  }
}