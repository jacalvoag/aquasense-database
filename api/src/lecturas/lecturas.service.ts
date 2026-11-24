import { Injectable } from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service.js';

@Injectable()
export class LecturasService {
  constructor(private readonly postgres: PostgresService) {}

  async listar() {
    const resultado = await this.postgres.consultar(`
      SELECT
        lectura_id,
        medidor_id,
        codigo_medidor,
        fecha_hora_anterior,
        fecha_hora,
        valor_anterior,
        valor_acumulado,
        consumo_m3
      FROM aquasense.consumo_entre_lecturas
      ORDER BY codigo_medidor, fecha_hora
    `);

    return resultado.rows;
  }
}