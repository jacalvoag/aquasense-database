import { Injectable } from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service.js';

@Injectable()
export class ComponentesService {
  constructor(private readonly postgres: PostgresService) {}

  async listar() {
    const resultado = await this.postgres.consultar(`
      SELECT
        c.componente_id,
        c.codigo,
        c.nombre,
        c.tipo,
        c.estado,
        c.espacio_id,
        e.nombre AS espacio_nombre,
        c.descripcion
      FROM aquasense.componente AS c
      LEFT JOIN aquasense.espacio AS e
        ON e.espacio_id = c.espacio_id
      ORDER BY c.codigo
    `);

    return resultado.rows;
  }
}