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

  async consultarEspaciosAlcanzables(componenteId: string) {
  const sesion = this.driver.session({ database: this.nombreBase });

  try {
    return await sesion.executeRead(async (tx) => {
      const control = await tx.run(
        `
        MATCH (control:ControlRed {id: 'red-principal'})
        OPTIONAL MATCH (componente:Componente {
          componenteId: $componenteId
        })
        RETURN
          control.estado AS estado,
          control.versionAplicada AS version,
          count(componente) AS componentes
        `,
        { componenteId },
      );

      if (control.records.length !== 1) {
        throw new Error('No existe el control de red en Neo4j.');
      }

      const registro = control.records[0];
      const version = registro.get('version');

      const recorridos = await tx.run(
        `
        MATCH (componente:Componente {componenteId: $componenteId})
        MATCH (componente)-[:CONECTA_CON*1..]->(espacio:Espacio)
        RETURN DISTINCT
          espacio.espacioId AS espacioId,
          espacio.nombre AS nombre,
          espacio.tipo AS tipo
        ORDER BY nombre, espacioId
        `,
        { componenteId },
      );

      return {
        estadoRed: registro.get('estado') as string,
        versionRed: version == null ? null : version.toString(),
        componenteEncontrado: registro.get('componentes').toNumber() === 1,
        espacios: recorridos.records.map((fila) => ({
          espacioId: fila.get('espacioId') as string,
          nombre: fila.get('nombre') as string,
          tipo: fila.get('tipo') as string,
        })),
      };
    });
  } finally {
    await sesion.close();
  }
}
}