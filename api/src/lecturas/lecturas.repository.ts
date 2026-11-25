import { Injectable } from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service.js';

@Injectable()
export class LecturasRepository {
  constructor(private readonly postgres: PostgresService) {}

  listar() {
    return this.postgres.consultar(`
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
  }

  registrar(parametros: unknown[]) {
    return this.postgres.consultar(
      `
          SELECT aquasense.registrar_lectura(
            $1::uuid,
            $2::uuid,
            $3::timestamptz,
            $4::numeric
          )
        `,
      parametros,
    );
  }
}
