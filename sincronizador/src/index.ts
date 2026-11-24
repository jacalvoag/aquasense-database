import pg from "pg";
import { isDeepStrictEqual } from "node:util";
import { Long, MongoClient, type Document } from "mongodb";
import neo4j from "neo4j-driver";
import { destinoDe } from "./conexion.js";
import { obtenerEventosPendientes } from "./eventos";
import { obtenerBloqueo } from "./bloqueo";

type Expediente = {
  reporteId: string;
  descripcionInicial: string;
  referenciaUbicacion?: string;
  ultimaSecuenciaAplicada: Long;
  ultimoEventoId: string;
  atenciones: Document[];
  creadoEn: Date;
  actualizadoEn: Date;
};

function variable(nombre: string): string {
  const valor = process.env[nombre];

  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}.`);
  }

  return valor;
}

async function main(): Promise<void> {
  const postgres = new pg.Client({
    host: variable("PGHOST"),
    port: Number(variable("PGPORT")),
    database: variable("PGDATABASE"),
    user: variable("PGUSER"),
    password: variable("PGPASSWORD"),
  });

  const mongo = new MongoClient(variable("MONGODB_URI"));

  const driver = neo4j.driver(
    variable("NEO4J_URI"),
    neo4j.auth.basic(
      variable("NEO4J_USER"),
      variable("NEO4J_PASSWORD"),
    ),
  );

  let eventoActual: { evento_id: string; destino: string } | null = null;

  try {
    await postgres.connect();

  const bloqueoAdquirido = await obtenerBloqueo(postgres);

  if (!bloqueoAdquirido) {
    console.log(
      "Otro sincronizador tiene el bloqueo. Se intentará en el siguiente ciclo.",
    );
    return;
  }

    const resultadoPostgres = await postgres.query(
      "SELECT current_database() AS base",
    );

    console.log(
      "PostgreSQL conectado:",
      resultadoPostgres.rows[0].base,
    );

const eventosPendientes = await obtenerEventosPendientes(postgres);

    console.log(
      "Eventos pendientes disponibles:",
      eventosPendientes.rows.length,
    );

    console.table(eventosPendientes.rows);

    for (const evento of eventosPendientes.rows) {
        const documentalAdmitido =
            evento.destino === "DOCUMENTAL" &&
            (
            evento.tipo === "CREAR_EXPEDIENTE" ||
            evento.tipo === "AGREGAR_ATENCION"
            );

        const grafoAdmitido =
            evento.destino === "GRAFO" &&
            evento.tipo === "ACTUALIZAR_RED" &&
            [
            "CREAR_CONEXION",
            "ACTUALIZAR_CONEXION",
            "ELIMINAR_CONEXION",
            "REEMPLAZAR_TUBERIA",
            ].includes(evento.datos?.cambio?.operacion);

        if (!documentalAdmitido && !grafoAdmitido) {
            eventoActual = evento;
            throw new Error(
            `El evento ${evento.evento_id} tiene un tipo u operación no admitida.`,
            );
        }
    }

    await mongo.connect();

    const baseMongo = mongo.db(variable("MONGODB_DATABASE"));

    await baseMongo.command({ ping: 1 });

    console.log("MongoDB conectado:", baseMongo.databaseName);

    const expedientes =
      baseMongo.collection<Expediente>("expedientes");

    // Crear expedientes en MongoDB.
    for (const evento of eventosPendientes.rows) {
      if (
        evento.destino !== "DOCUMENTAL" ||
        evento.tipo !== "CREAR_EXPEDIENTE"
      ) {
        continue;
      }

      eventoActual = evento;

      const datos = evento.datos;

      if (
        evento.secuencia !== "1" ||
        !datos ||
        typeof datos.reporteId !== "string" ||
        datos.reporteId !== evento.reporte_id ||
        typeof datos.descripcionInicial !== "string" ||
        (
          datos.referenciaUbicacion != null &&
          typeof datos.referenciaUbicacion !== "string"
        )
      ) {
        throw new Error(
          `Datos inválidos para el evento ${evento.evento_id}.`,
        );
      }

      const ahora = new Date();

      await expedientes.updateOne(
        { reporteId: datos.reporteId },
        {
          $setOnInsert: {
            reporteId: datos.reporteId,
            descripcionInicial: datos.descripcionInicial,
            ...(datos.referenciaUbicacion != null
              ? { referenciaUbicacion: datos.referenciaUbicacion }
              : {}),
            ultimaSecuenciaAplicada: Long.fromString("1"),
            ultimoEventoId: evento.evento_id,
            atenciones: [],
            creadoEn: ahora,
            actualizadoEn: ahora,
          },
        },
        { upsert: true },
      );

      // También permite verificar un intento aplicado antes de una interrupción.
      const expediente = await expedientes.findOne({
        reporteId: datos.reporteId,
      });

      if (
        !expediente ||
        expediente.descripcionInicial !== datos.descripcionInicial ||
        (expediente.referenciaUbicacion ?? null) !==
          (datos.referenciaUbicacion ?? null) ||
        expediente.ultimaSecuenciaAplicada?.toString() !== "1" ||
        expediente.ultimoEventoId !== evento.evento_id ||
        !Array.isArray(expediente.atenciones) ||
        expediente.atenciones.length !== 0
      ) {
        throw new Error(
          `El expediente no coincide con el evento ${evento.evento_id}.`,
        );
      }

      await postgres.query(
        "SELECT aquasense.confirmar_evento_documental($1::uuid)",
        [evento.evento_id],
      );

      console.log(
        `Expediente creado y evento confirmado: ${evento.evento_id}`,
      );
      eventoActual = null;
    }

    // Agregar atenciones en MongoDB.
    for (const evento of eventosPendientes.rows) {
      if (
        evento.destino !== "DOCUMENTAL" ||
        evento.tipo !== "AGREGAR_ATENCION"
      ) {
        continue;
      }

      eventoActual = evento;

      const datos = evento.datos;
      const atencion = datos?.atencion;

      if (
        !datos ||
        typeof datos.reporteId !== "string" ||
        datos.reporteId !== evento.reporte_id ||
        !atencion ||
        typeof atencion !== "object" ||
        Array.isArray(atencion) ||
        typeof atencion.atencionId !== "string"
      ) {
        throw new Error(
          `Datos inválidos para el evento ${evento.evento_id}.`,
        );
      }

      const secuencia = BigInt(evento.secuencia);

      if (secuencia <= 1n) {
        throw new Error(
          `Secuencia inválida para la atención ${evento.evento_id}.`,
        );
      }

      const secuenciaAnterior = (secuencia - 1n).toString();

      const anterior = await postgres.query(
        `
        SELECT evento_id
        FROM aquasense.evento_salida
        WHERE destino = 'DOCUMENTAL'
          AND reporte_id = $1::uuid
          AND secuencia = $2::bigint
          AND estado = 'PROCESADO'
        `,
        [evento.reporte_id, secuenciaAnterior],
      );

      if (anterior.rows.length !== 1) {
        throw new Error(
          `No se encontró el evento anterior procesado de ${evento.evento_id}.`,
        );
      }

      await expedientes.updateOne(
        {
          reporteId: datos.reporteId,
          ultimaSecuenciaAplicada: Long.fromString(secuenciaAnterior),
          ultimoEventoId: anterior.rows[0].evento_id,
          "atenciones.atencionId": { $ne: atencion.atencionId },
        },
        {
          $push: { atenciones: atencion },
          $set: {
            ultimaSecuenciaAplicada: Long.fromString(evento.secuencia),
            ultimoEventoId: evento.evento_id,
          },
          $currentDate: { actualizadoEn: true },
        },
      );

      const expediente = await expedientes.findOne({
        reporteId: datos.reporteId,
      });

      const atencionesCoincidentes = expediente?.atenciones.filter(
        (item) => item.atencionId === atencion.atencionId,
      );

      if (
        !expediente ||
        expediente.ultimaSecuenciaAplicada?.toString() !==
          evento.secuencia ||
        expediente.ultimoEventoId !== evento.evento_id ||
        atencionesCoincidentes?.length !== 1 ||
        !isDeepStrictEqual(atencionesCoincidentes[0], atencion)
      ) {
        throw new Error(
          `La atención no coincide con el evento ${evento.evento_id}.`,
        );
      }

      await postgres.query(
        "SELECT aquasense.confirmar_evento_documental($1::uuid)",
        [evento.evento_id],
      );

      console.log(
        `Atención aplicada y evento confirmado: ${evento.evento_id}`,
      );
      eventoActual = null;
    }

    const sesion = driver.session({
      database: variable("NEO4J_DATABASE"),
    });

    try {
      await sesion.run("RETURN 1 AS prueba");

      console.log(
        "Neo4j conectado:",
        variable("NEO4J_DATABASE"),
      );

      // Actualizar una conexión existente en Neo4j.
      for (const evento of eventosPendientes.rows) {
        if (
          evento.destino !== "GRAFO" ||
          evento.tipo !== "ACTUALIZAR_RED" ||
          evento.datos?.cambio?.operacion !== "ACTUALIZAR_CONEXION"
        ) {
          continue;
        }

      eventoActual = evento;

        const datos = evento.datos;
        const antes = datos.cambio.antes;
        const despues = datos.cambio.despues;

        if (
          !antes ||
          !despues ||
          typeof antes.conexion_id !== "string" ||
          antes.conexion_id !== despues.conexion_id ||
          typeof antes.componente_origen_id !== "string" ||
          typeof despues.componente_origen_id !== "string" ||
          !Number.isSafeInteger(datos.versionRed) ||
          BigInt(datos.versionRed) !== BigInt(evento.secuencia)
        ) {
          throw new Error(
            `Datos inválidos para el evento ${evento.evento_id}.`,
          );
        }

        const destinoAnterior = destinoDe(antes);
        const destinoNuevo = destinoDe(despues);

        const parametros = {
          eventoId: evento.evento_id,
          version: neo4j.int(evento.secuencia),
          versionAnterior: neo4j.int(
            (BigInt(evento.secuencia) - 1n).toString(),
          ),
          conexionId: antes.conexion_id,
          origenAnterior: antes.componente_origen_id,
          origenNuevo: despues.componente_origen_id,
          destinoAnteriorId: destinoAnterior.id,
          destinoAnteriorTipo: destinoAnterior.tipo,
          destinoNuevoId: destinoNuevo.id,
          destinoNuevoTipo: destinoNuevo.tipo,
        };

        await sesion.executeWrite(async (tx) => {
          const aplicado = await tx.run(
            `
            MATCH (evento:EventoAplicado {eventoId: $eventoId})
            RETURN evento.secuencia AS secuencia
            `,
            parametros,
          );

          if (aplicado.records.length > 0) {
            const verificacion = await tx.run(
              `
              MATCH (control:ControlRed {
                id: 'red-principal',
                estado: 'INICIALIZADO',
                versionAplicada: $version
              })
              MATCH (:EventoAplicado {
                eventoId: $eventoId,
                secuencia: $version
              })
              MATCH (origen:Componente {
                componenteId: $origenNuevo
              })-[:CONECTA_CON {
                conexionId: $conexionId
              }]->(destino)
              WHERE
                ($destinoNuevoTipo = 'Componente'
                  AND destino:Componente
                  AND destino.componenteId = $destinoNuevoId)
                OR
                ($destinoNuevoTipo = 'Espacio'
                  AND destino:Espacio
                  AND destino.espacioId = $destinoNuevoId)
              RETURN count(*) AS coincidencias
              `,
              parametros,
            );

            const coincidencias = verificacion.records[0]
              .get("coincidencias")
              .toNumber();

            if (coincidencias !== 1) {
              throw new Error(
                `El evento ${evento.evento_id} ya existe, pero el grafo no coincide.`,
              );
            }

            return;
          }

          const resultado = await tx.run(
            `
            MATCH (control:ControlRed {
              id: 'red-principal',
              estado: 'INICIALIZADO',
              versionAplicada: $versionAnterior
            })
            MATCH (origenAnterior:Componente {
              componenteId: $origenAnterior
            })-[conexion:CONECTA_CON {
              conexionId: $conexionId
            }]->(destinoAnterior)
            MATCH (origenNuevo:Componente {
              componenteId: $origenNuevo
            })
            MATCH (destinoNuevo)
            WHERE
              (
                ($destinoAnteriorTipo = 'Componente'
                  AND destinoAnterior:Componente
                  AND destinoAnterior.componenteId = $destinoAnteriorId)
                OR
                ($destinoAnteriorTipo = 'Espacio'
                  AND destinoAnterior:Espacio
                  AND destinoAnterior.espacioId = $destinoAnteriorId)
              )
              AND
              (
                ($destinoNuevoTipo = 'Componente'
                  AND destinoNuevo:Componente
                  AND destinoNuevo.componenteId = $destinoNuevoId)
                OR
                ($destinoNuevoTipo = 'Espacio'
                  AND destinoNuevo:Espacio
                  AND destinoNuevo.espacioId = $destinoNuevoId)
              )
            DELETE conexion
            CREATE (origenNuevo)-[:CONECTA_CON {
              conexionId: $conexionId
            }]->(destinoNuevo)
            CREATE (:EventoAplicado {
              eventoId: $eventoId,
              secuencia: $version,
              aplicadoEn: datetime()
            })
            SET control.versionAplicada = $version
            RETURN control.versionAplicada AS version
            `,
            parametros,
          );

          if (resultado.records.length !== 1) {
            throw new Error(
              `No se cumplieron las condiciones para aplicar ${evento.evento_id}.`,
            );
          }
        });

        await postgres.query(
          "SELECT aquasense.confirmar_evento_grafo($1::uuid)",
          [evento.evento_id],
        );

        console.log(
          `Cambio de grafo aplicado y confirmado: ${evento.evento_id}`,
        );
      eventoActual = null;
      }

      // Eliminar una conexión existente en Neo4j.
      for (const evento of eventosPendientes.rows) {
        if (
          evento.destino !== "GRAFO" ||
          evento.tipo !== "ACTUALIZAR_RED" ||
          evento.datos?.cambio?.operacion !== "ELIMINAR_CONEXION"
        ) {
          continue;
        }

      eventoActual = evento;

        const datos = evento.datos;
        const conexion = datos.cambio.conexion;

        if (
          !conexion ||
          typeof conexion.conexion_id !== "string" ||
          typeof conexion.componente_origen_id !== "string" ||
          !Number.isSafeInteger(datos.versionRed) ||
          BigInt(datos.versionRed) !== BigInt(evento.secuencia) ||
          BigInt(evento.secuencia) <= 0n
        ) {
          throw new Error(
            `Datos inválidos para el evento ${evento.evento_id}.`,
          );
        }

        const destino = destinoDe(conexion);

        const parametros = {
          eventoId: evento.evento_id,
          version: neo4j.int(evento.secuencia),
          versionAnterior: neo4j.int(
            (BigInt(evento.secuencia) - 1n).toString(),
          ),
          conexionId: conexion.conexion_id,
          origenId: conexion.componente_origen_id,
          destinoTipo: destino.tipo,
          destinoId: destino.id,
        };

        await sesion.executeWrite(async (tx) => {
          const aplicado = await tx.run(
            `
            MATCH (evento:EventoAplicado {eventoId: $eventoId})
            RETURN evento.secuencia AS secuencia
            `,
            parametros,
          );

          if (aplicado.records.length > 0) {
            const verificacion = await tx.run(
              `
              MATCH (control:ControlRed {
                id: 'red-principal',
                estado: 'INICIALIZADO',
                versionAplicada: $version
              })
              MATCH (:EventoAplicado {
                eventoId: $eventoId,
                secuencia: $version
              })
              RETURN COUNT {
                MATCH ()-[:CONECTA_CON {
                  conexionId: $conexionId
                }]->()
              } AS conexiones
              `,
              parametros,
            );

            if (
              verificacion.records.length !== 1 ||
              verificacion.records[0].get("conexiones").toNumber() !== 0
            ) {
              throw new Error(
                `El evento ${evento.evento_id} existe, pero el grafo no coincide.`,
              );
            }

            return;
          }

          const resultado = await tx.run(
            `
            MATCH (control:ControlRed {
              id: 'red-principal',
              estado: 'INICIALIZADO',
              versionAplicada: $versionAnterior
            })
            MATCH (origen:Componente {
              componenteId: $origenId
            })-[relacion:CONECTA_CON {
              conexionId: $conexionId
            }]->(destino)
            WHERE
              ($destinoTipo = 'Componente'
                AND destino:Componente
                AND destino.componenteId = $destinoId)
              OR
              ($destinoTipo = 'Espacio'
                AND destino:Espacio
                AND destino.espacioId = $destinoId)
            DELETE relacion
            CREATE (:EventoAplicado {
              eventoId: $eventoId,
              secuencia: $version,
              aplicadoEn: datetime()
            })
            SET control.versionAplicada = $version
            RETURN control.versionAplicada AS version
            `,
            parametros,
          );

          if (resultado.records.length !== 1) {
            throw new Error(
              `No se cumplieron las condiciones para aplicar ${evento.evento_id}.`,
            );
          }
        });

        await postgres.query(
          "SELECT aquasense.confirmar_evento_grafo($1::uuid)",
          [evento.evento_id],
        );

        console.log(
          `Eliminación aplicada y confirmada: ${evento.evento_id}`,
        );
      eventoActual = null;
      }
    // Crear una conexión en Neo4j.
    for (const evento of eventosPendientes.rows) {
    if (
        evento.destino !== "GRAFO" ||
        evento.tipo !== "ACTUALIZAR_RED" ||
        evento.datos?.cambio?.operacion !== "CREAR_CONEXION"
    ) {
        continue;
    }

      eventoActual = evento;

    const datos = evento.datos;
    const conexion = datos.cambio.conexion;

    if (
        !conexion ||
        typeof conexion.conexion_id !== "string" ||
        typeof conexion.componente_origen_id !== "string" ||
        !Number.isSafeInteger(datos.versionRed) ||
        BigInt(datos.versionRed) !== BigInt(evento.secuencia) ||
        BigInt(evento.secuencia) <= 0n
    ) {
        throw new Error(
        `Datos inválidos para el evento ${evento.evento_id}.`,
        );
    }

    const destino = destinoDe(conexion);

    const parametros = {
        eventoId: evento.evento_id,
        version: neo4j.int(evento.secuencia),
        versionAnterior: neo4j.int(
        (BigInt(evento.secuencia) - 1n).toString(),
        ),
        conexionId: conexion.conexion_id,
        origenId: conexion.componente_origen_id,
        destinoTipo: destino.tipo,
        destinoId: destino.id,
    };

    await sesion.executeWrite(async (tx) => {
        const aplicado = await tx.run(
        `
        MATCH (evento:EventoAplicado {eventoId: $eventoId})
        RETURN evento.secuencia AS secuencia
        `,
        parametros,
        );

        if (aplicado.records.length > 0) {
        // Recuperación: comprobar que la conexión ya aplicada coincide.
        const verificacion = await tx.run(
            `
            MATCH (control:ControlRed {
            id: 'red-principal',
            estado: 'INICIALIZADO',
            versionAplicada: $version
            })
            MATCH (:EventoAplicado {
            eventoId: $eventoId,
            secuencia: $version
            })
            MATCH (origen:Componente {componenteId: $origenId})
                -[:CONECTA_CON {conexionId: $conexionId}]->(destino)
            WHERE
            ($destinoTipo = 'Componente'
                AND destino:Componente
                AND destino.componenteId = $destinoId)
            OR
            ($destinoTipo = 'Espacio'
                AND destino:Espacio
                AND destino.espacioId = $destinoId)
            RETURN count(*) AS coincidencias
            `,
            parametros,
        );

        if (
            verificacion.records.length !== 1 ||
            verificacion.records[0].get("coincidencias").toNumber() !== 1
        ) {
            throw new Error(
            `El evento ${evento.evento_id} existe, pero el grafo no coincide.`,
            );
        }

        return;
        }

        const resultado = await tx.run(
        `
        MATCH (control:ControlRed {
            id: 'red-principal',
            estado: 'INICIALIZADO',
            versionAplicada: $versionAnterior
        })
        MATCH (origen:Componente {componenteId: $origenId})
        MATCH (destino)
        WHERE
            (
            ($destinoTipo = 'Componente'
                AND destino:Componente
                AND destino.componenteId = $destinoId)
            OR
            ($destinoTipo = 'Espacio'
                AND destino:Espacio
                AND destino.espacioId = $destinoId)
            )
            AND NOT EXISTS {
            MATCH ()-[:CONECTA_CON {conexionId: $conexionId}]->()
            }
        CREATE (origen)-[:CONECTA_CON {
            conexionId: $conexionId
        }]->(destino)
        CREATE (:EventoAplicado {
            eventoId: $eventoId,
            secuencia: $version,
            aplicadoEn: datetime()
        })
        SET control.versionAplicada = $version
        RETURN control.versionAplicada AS version
        `,
        parametros,
        );

        if (resultado.records.length !== 1) {
        throw new Error(
            `No se cumplieron las condiciones para aplicar ${evento.evento_id}.`,
        );
        }
    });

    await postgres.query(
        "SELECT aquasense.confirmar_evento_grafo($1::uuid)",
        [evento.evento_id],
    );

    console.log(`Creación aplicada y confirmada: ${evento.evento_id}`);
      eventoActual = null;
    }

    // Reemplazar una tubería en Neo4j.
        for (const evento of eventosPendientes.rows) {
        if (
            evento.destino !== "GRAFO" ||
            evento.tipo !== "ACTUALIZAR_RED" ||
            evento.datos?.cambio?.operacion !== "REEMPLAZAR_TUBERIA"
        ) {
            continue;
        }

      eventoActual = evento;

        const datos = evento.datos;
        const cambio = datos.cambio;
        const anterior = cambio.tuberiaAnterior;
        const nueva = cambio.tuberiaNueva;
        const conexiones = cambio.conexiones;

        if (
            !anterior ||
            !nueva ||
            typeof anterior.componente_id !== "string" ||
            typeof nueva.componente_id !== "string" ||
            anterior.componente_id === nueva.componente_id ||
            anterior.tipo !== "TUBERIA" ||
            anterior.estado !== "RETIRADO" ||
            nueva.tipo !== "TUBERIA" ||
            nueva.estado !== "ACTIVO" ||
            typeof nueva.codigo !== "string" ||
            typeof nueva.nombre !== "string" ||
            typeof cambio.reemplazoId !== "string" ||
            typeof cambio.reporteId !== "string" ||
            !Array.isArray(conexiones) ||
            conexiones.length < 1 ||
            conexiones.length > 2 ||
            !Number.isSafeInteger(datos.versionRed) ||
            BigInt(datos.versionRed) !== BigInt(evento.secuencia) ||
            BigInt(evento.secuencia) <= 0n
        ) {
            throw new Error(
            `Datos inválidos para el reemplazo ${evento.evento_id}.`,
            );
        }

        if (
            nueva.espacio_id !== null &&
            typeof nueva.espacio_id !== "string"
        ) {
            throw new Error("La ubicación de la tubería nueva es inválida.");
        }

        const idsConexiones = new Set<string>();

        // Validar que cada cambio sustituya la tubería anterior por la nueva
        // sin cambiar el otro extremo de la conexión.
        for (const item of conexiones) {
            const antes = item?.antes;
            const despues = item?.despues;

            if (
            !antes ||
            !despues ||
            typeof antes.conexion_id !== "string" ||
            antes.conexion_id !== despues.conexion_id ||
            typeof antes.componente_origen_id !== "string" ||
            typeof despues.componente_origen_id !== "string" ||
            idsConexiones.has(antes.conexion_id)
            ) {
            throw new Error("Las conexiones del reemplazo son inválidas.");
            }

            idsConexiones.add(antes.conexion_id);

            const destinoAntes = destinoDe(antes);
            const destinoDespues = destinoDe(despues);

            const cambiaOrigen =
            antes.componente_origen_id === anterior.componente_id &&
            despues.componente_origen_id === nueva.componente_id &&
            destinoAntes.tipo === destinoDespues.tipo &&
            destinoAntes.id === destinoDespues.id;

            const cambiaDestino =
            antes.componente_origen_id === despues.componente_origen_id &&
            destinoAntes.tipo === "Componente" &&
            destinoAntes.id === anterior.componente_id &&
            destinoDespues.tipo === "Componente" &&
            destinoDespues.id === nueva.componente_id;

            if (cambiaOrigen === cambiaDestino) {
            throw new Error(
                `La conexión ${antes.conexion_id} no describe el reemplazo esperado.`,
            );
            }
        }

        const parametrosBase = {
            eventoId: evento.evento_id,
            version: neo4j.int(evento.secuencia),
            versionAnterior: neo4j.int(
            (BigInt(evento.secuencia) - 1n).toString(),
            ),
            anteriorId: anterior.componente_id,
            nuevaId: nueva.componente_id,
            codigoNuevo: nueva.codigo,
            nombreNuevo: nueva.nombre,
            espacioId: nueva.espacio_id,
            reemplazoId: cambio.reemplazoId,
            reporteId: cambio.reporteId,
        };

        await sesion.executeWrite(async (tx) => {
            const aplicado = await tx.run(
            `
            MATCH (evento:EventoAplicado {eventoId: $eventoId})
            RETURN evento.secuencia AS secuencia
            `,
            parametrosBase,
            );

            if (aplicado.records.length > 0) {
            // Recuperación: comprobar el estado que dejó el evento anterior.
            const estado = await tx.run(
                `
                MATCH (control:ControlRed {
                id: 'red-principal',
                estado: 'INICIALIZADO',
                versionAplicada: $version
                })
                MATCH (:EventoAplicado {
                eventoId: $eventoId,
                secuencia: $version
                })
                MATCH (anterior:Componente {
                componenteId: $anteriorId,
                tipo: 'TUBERIA',
                estado: 'RETIRADO'
                })
                MATCH (nueva:Componente {
                componenteId: $nuevaId,
                codigo: $codigoNuevo,
                nombre: $nombreNuevo,
                tipo: 'TUBERIA',
                estado: 'ACTIVO'
                })-[:REEMPLAZA_A {
                reemplazoId: $reemplazoId,
                reporteId: $reporteId
                }]->(anterior)
                RETURN
                COUNT {
                    MATCH (anterior)-[:CONECTA_CON]-()
                } AS conexiones_anteriores,
                COUNT {
                    MATCH (nueva)-[:UBICADO_EN]->(:Espacio {
                    espacioId: $espacioId
                    })
                } AS ubicaciones
                `,
                parametrosBase,
            );

            if (
                estado.records.length !== 1 ||
                estado.records[0].get("conexiones_anteriores").toNumber() !== 0 ||
                (
                nueva.espacio_id !== null &&
                estado.records[0].get("ubicaciones").toNumber() !== 1
                )
            ) {
                throw new Error(
                `El reemplazo ${evento.evento_id} existe, pero el grafo no coincide.`,
                );
            }

            for (const item of conexiones) {
                const despues = item.despues;
                const destino = destinoDe(despues);

                const comprobacion = await tx.run(
                `
                MATCH (origen:Componente {componenteId: $origenId})
                        -[:CONECTA_CON {conexionId: $conexionId}]->(destino)
                WHERE
                    ($destinoTipo = 'Componente'
                    AND destino:Componente
                    AND destino.componenteId = $destinoId)
                    OR
                    ($destinoTipo = 'Espacio'
                    AND destino:Espacio
                    AND destino.espacioId = $destinoId)
                RETURN count(*) AS coincidencias
                `,
                {
                    origenId: despues.componente_origen_id,
                    conexionId: despues.conexion_id,
                    destinoTipo: destino.tipo,
                    destinoId: destino.id,
                },
                );

                if (comprobacion.records[0].get("coincidencias").toNumber() !== 1) {
                throw new Error(
                    `La conexión ${despues.conexion_id} no coincide con el evento.`,
                );
                }
            }

            return;
            }

            // Comprobar la versión, la tubería anterior y que la nueva no exista.
            const estadoInicial = await tx.run(
            `
            MATCH (control:ControlRed {
                id: 'red-principal',
                estado: 'INICIALIZADO',
                versionAplicada: $versionAnterior
            })
            MATCH (anterior:Componente {
                componenteId: $anteriorId,
                tipo: 'TUBERIA',
                estado: 'ACTIVO'
            })
            WHERE NOT EXISTS {
                MATCH (:Componente {componenteId: $nuevaId})
            }
            RETURN COUNT {
                MATCH (anterior)-[:CONECTA_CON]-()
            } AS conexiones_anteriores
            `,
            parametrosBase,
            );

            if (
            estadoInicial.records.length !== 1 ||
            estadoInicial.records[0].get("conexiones_anteriores").toNumber() !==
                conexiones.length
            ) {
            throw new Error(
                `El estado inicial no permite aplicar ${evento.evento_id}.`,
            );
            }

            const creada = await tx.run(
            `
            CREATE (nueva:Componente {
                componenteId: $nuevaId,
                codigo: $codigoNuevo,
                nombre: $nombreNuevo,
                tipo: 'TUBERIA',
                estado: 'ACTIVO'
            })
            RETURN nueva.componenteId AS id
            `,
            parametrosBase,
            );

            if (creada.records.length !== 1) {
            throw new Error("No se pudo crear la tubería nueva.");
            }

            if (nueva.espacio_id !== null) {
            const ubicacion = await tx.run(
                `
                MATCH (nueva:Componente {componenteId: $nuevaId})
                MATCH (espacio:Espacio {espacioId: $espacioId})
                CREATE (nueva)-[:UBICADO_EN]->(espacio)
                RETURN espacio.espacioId AS id
                `,
                parametrosBase,
            );

            if (ubicacion.records.length !== 1) {
                throw new Error("No se encontró la ubicación de la tubería nueva.");
            }
            }

            for (const item of conexiones) {
            const antes = item.antes;
            const despues = item.despues;
            const destinoAntes = destinoDe(antes);
            const destinoDespues = destinoDe(despues);

            const modificada = await tx.run(
                `
                MATCH (origenAntes:Componente {
                componenteId: $origenAntes
                })-[conexion:CONECTA_CON {
                conexionId: $conexionId
                }]->(destinoAntes)
                MATCH (origenDespues:Componente {
                componenteId: $origenDespues
                })
                MATCH (destinoDespues)
                WHERE
                (
                    ($tipoAntes = 'Componente'
                    AND destinoAntes:Componente
                    AND destinoAntes.componenteId = $destinoAntes)
                    OR
                    ($tipoAntes = 'Espacio'
                    AND destinoAntes:Espacio
                    AND destinoAntes.espacioId = $destinoAntes)
                )
                AND
                (
                    ($tipoDespues = 'Componente'
                    AND destinoDespues:Componente
                    AND destinoDespues.componenteId = $destinoDespues)
                    OR
                    ($tipoDespues = 'Espacio'
                    AND destinoDespues:Espacio
                    AND destinoDespues.espacioId = $destinoDespues)
                )
                DELETE conexion
                CREATE (origenDespues)-[:CONECTA_CON {
                conexionId: $conexionId
                }]->(destinoDespues)
                RETURN $conexionId AS conexion_id
                `,
                {
                conexionId: antes.conexion_id,
                origenAntes: antes.componente_origen_id,
                origenDespues: despues.componente_origen_id,
                tipoAntes: destinoAntes.tipo,
                destinoAntes: destinoAntes.id,
                tipoDespues: destinoDespues.tipo,
                destinoDespues: destinoDespues.id,
                },
            );

            if (modificada.records.length !== 1) {
                throw new Error(
                `No se pudo actualizar la conexión ${antes.conexion_id}.`,
                );
            }
            }

            const finalizado = await tx.run(
            `
            MATCH (control:ControlRed {
                id: 'red-principal',
                estado: 'INICIALIZADO',
                versionAplicada: $versionAnterior
            })
            MATCH (anterior:Componente {componenteId: $anteriorId})
            MATCH (nueva:Componente {componenteId: $nuevaId})
            SET anterior.estado = 'RETIRADO'
            CREATE (nueva)-[:REEMPLAZA_A {
                reemplazoId: $reemplazoId,
                reporteId: $reporteId
            }]->(anterior)
            CREATE (:EventoAplicado {
                eventoId: $eventoId,
                secuencia: $version,
                aplicadoEn: datetime()
            })
            SET control.versionAplicada = $version
            RETURN control.versionAplicada AS version
            `,
            parametrosBase,
            );

            if (finalizado.records.length !== 1) {
            throw new Error(
                `No se pudo finalizar el reemplazo ${evento.evento_id}.`,
            );
            }
        });
        
        await postgres.query(
            "SELECT aquasense.confirmar_evento_grafo($1::uuid)",
            [evento.evento_id],
        );

        console.log(
            `Reemplazo aplicado y confirmado: ${evento.evento_id}`,
        );
      eventoActual = null;
        }

    } finally {
      await sesion.close();
    }
  } catch (error: unknown) {
    if (eventoActual !== null) {
      try {
        const estado = await postgres.query(
          "SELECT estado FROM aquasense.evento_salida WHERE evento_id = $1::uuid",
          [eventoActual.evento_id],
        );

        if (estado.rows[0]?.estado === "PENDIENTE") {
          const funcion = eventoActual.destino === "DOCUMENTAL"
            ? "aquasense.registrar_fallo_documental"
            : eventoActual.destino === "GRAFO"
              ? "aquasense.registrar_fallo_grafo"
              : null;

          if (funcion === null) {
            throw new Error("Destino de evento no reconocido.");
          }

          const resultado = await postgres.query(
            `SELECT ${funcion}($1::uuid, $2::text, CURRENT_TIMESTAMP + INTERVAL '1 minute') AS estado`,
            [eventoActual.evento_id, "Falló el procesamiento del evento; revisar la salida del sincronizador."],
          );

          console.error(
            `Fallo registrado para ${eventoActual.evento_id}. Estado: ${resultado.rows[0].estado}`,
          );
        } else if (estado.rows[0]?.estado === "PROCESADO") {
          console.error(`El evento ${eventoActual.evento_id} ya figura como PROCESADO.`);
        } else {
          console.error(`No se registró un fallo: el evento no está pendiente o no existe.`);
        }
      } catch (errorRegistro: unknown) {
        console.error(
          "No se pudo registrar el fallo en PostgreSQL:",
          errorRegistro instanceof Error ? errorRegistro.message : "Error desconocido",
        );
      }
    }

    throw error;
  } finally {
    await Promise.allSettled([
      postgres.end(),
      mongo.close(),
      driver.close(),
    ]);
  }
}

async function iniciarSincronizador(): Promise<void> {
  const intervaloMs = 5_000;
  let detener = false;

  const solicitarCierre = () => {
    detener = true;
    console.log("Cerrando el sincronizador...");
  };

  process.once("SIGINT", solicitarCierre);
  process.once("SIGTERM", solicitarCierre);

  try {
    while (!detener) {
      try {
        await main();
      } catch (error: unknown) {
        console.error(
          "No se pudo completar el ciclo:",
          error instanceof Error ? error.message : "Error desconocido",
        );
      }

      if (!detener) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, intervaloMs);
        });
      }
    }
  } finally {
    process.removeListener("SIGINT", solicitarCierre);
    process.removeListener("SIGTERM", solicitarCierre);
  }
}

iniciarSincronizador().catch((error: unknown) => {
  console.error(
    "El sincronizador se detuvo:",
    error instanceof Error ? error.message : "Error desconocido",
  );

  process.exitCode = 1;
});