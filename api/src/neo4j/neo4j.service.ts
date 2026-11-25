import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { type Driver, type Node } from 'neo4j-driver';

type NodoRed =
  | { id: string; clase: 'ESPACIO'; entidadId: string; nombre: string; tipo: string }
  | { id: string; clase: 'COMPONENTE'; entidadId: string; nombre: string; tipo: string;
      codigo: string; estado: string; espacioId: string | null };

function nodoRed(nodo: Node, ubicacion: string | null): NodoRed {
  const { componenteId, espacioId, nombre, tipo, codigo, estado } = nodo.properties;
  if (nodo.labels.includes('Espacio')) {
    return { id: `e:${espacioId}`, clase: 'ESPACIO', entidadId: espacioId, nombre, tipo };
  }
  return { id: `c:${componenteId}`, clase: 'COMPONENTE', entidadId: componenteId,
    nombre, tipo, codigo, estado, espacioId: ubicacion };
}

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
    return this.consultarRed(componenteId);
  }

  async consultarRed(componenteId?: string) {
    const sesion = this.driver.session({ database: this.nombreBase });
    try {
      return await sesion.executeRead(async (tx) => {
        const control = await tx.run(`
          MATCH (control:ControlRed {id: 'red-principal'})
          RETURN control.estado AS estado, toString(control.versionAplicada) AS version
        `);
        if (control.records.length !== 1) {
          throw new Error('No existe el control de red en Neo4j.');
        }

        const inicio = componenteId === undefined ? `
          MATCH (origen:Componente {estado: 'ACTIVO'})-[conexion:CONECTA_CON]->(destino)
          WHERE destino:Espacio OR (destino:Componente AND destino.estado = 'ACTIVO')
        ` : `
          MATCH camino = (:Componente {componenteId: $componenteId})-[:CONECTA_CON*0..]->(origen:Componente)
          WHERE all(componente IN nodes(camino) WHERE componente.estado = 'ACTIVO')
          WITH DISTINCT origen
          OPTIONAL MATCH (origen)-[conexion:CONECTA_CON]->(destino)
          WHERE destino:Espacio OR (destino:Componente AND destino.estado = 'ACTIVO')
        `;
        const resultado = await tx.run(`
          ${inicio}
          RETURN origen, destino, conexion.conexionId AS conexionId,
                 head([(origen)-[:UBICADO_EN]->(u:Espacio) | u.espacioId]) AS origenUbicacion,
                 head([(destino)-[:UBICADO_EN]->(u:Espacio) | u.espacioId]) AS destinoUbicacion
        `, componenteId === undefined ? {} : { componenteId });

        const nodos = new Map<string, NodoRed>();
        const conexiones = new Map<string, { id: string; origen: string; destino: string }>();
        for (const fila of resultado.records) {
          const origen = nodoRed(fila.get('origen'), fila.get('origenUbicacion'));
          nodos.set(origen.id, origen);
          const destinoNeo4j = fila.get('destino') as Node | null;
          if (destinoNeo4j === null) continue;
          const destino = nodoRed(destinoNeo4j, fila.get('destinoUbicacion'));
          const id = fila.get('conexionId') as string;
          if (!id) throw new Error('La conexión no tiene identificador.');
          nodos.set(destino.id, destino);
          conexiones.set(id, { id, origen: origen.id, destino: destino.id });
        }

        return {
          estadoRed: control.records[0].get('estado') as string,
          versionRed: control.records[0].get('version') as string | null,
          componenteEncontrado: componenteId === undefined || nodos.has(`c:${componenteId}`),
          nodos: [...nodos.values()].sort((a, b) => a.id.localeCompare(b.id)),
          conexiones: [...conexiones.values()].sort((a, b) => a.id.localeCompare(b.id)),
          espacios: [...nodos.values()]
            .flatMap((nodo) => nodo.clase === 'ESPACIO'
              ? [{ espacioId: nodo.entidadId, nombre: nodo.nombre, tipo: nodo.tipo }]
              : [])
            .sort((a, b) => a.nombre.localeCompare(b.nombre) || a.espacioId.localeCompare(b.espacioId)),
        };
      });
    } finally {
      await sesion.close();
    }
  }
}
