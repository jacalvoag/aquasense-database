const aquasense = db.getSiblingDB("aquasense");

aquasense.createCollection("expedientes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "reporteId",
        "descripcionInicial",
        "ultimaSecuenciaAplicada",
        "ultimoEventoId",
        "atenciones",
        "creadoEn",
        "actualizadoEn"
      ],
      properties: {
        reporteId: {
          bsonType: "string",
          minLength: 1
        },
        descripcionInicial: {
          bsonType: "string",
          minLength: 1
        },
        referenciaUbicacion: {
          bsonType: ["string", "null"]
        },
        ultimaSecuenciaAplicada: {
          bsonType: ["int", "long"],
          minimum: 1
        },
        ultimoEventoId: {
          bsonType: "string",
          minLength: 1
        },
        creadoEn: {
          bsonType: "date"
        },
        actualizadoEn: {
          bsonType: "date"
        },
        atenciones: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: [
              "atencionId",
              "tipo",
              "fecha",
              "descripcion"
            ],
            properties: {
              atencionId: {
                bsonType: "string",
                minLength: 1
              },
              tipo: {
                enum: ["INSPECCION", "REPARACION", "VERIFICACION"]
              },
              fecha: {
                bsonType: "string",
                minLength: 1
              },
              descripcion: {
                bsonType: "string",
                minLength: 1
              },
              componenteId: {
                bsonType: ["string", "null"]
              },
              hallazgos: {
                bsonType: "string",
                minLength: 1
              },
              materiales: {
                bsonType: "array",
                items: {
                  bsonType: "string",
                  minLength: 1
                }
              },
              resultado: {
                enum: ["SIN_INDICIOS", "PERSISTE", "NO_CONCLUYENTE"]
              }
            },
            oneOf: [
              {
                properties: {
                  tipo: { enum: ["INSPECCION"] }
                },
                required: ["hallazgos"]
              },
              {
                properties: {
                  tipo: { enum: ["REPARACION"] }
                }
              },
              {
                properties: {
                  tipo: { enum: ["VERIFICACION"] }
                },
                required: ["resultado"]
              }
            ]
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});