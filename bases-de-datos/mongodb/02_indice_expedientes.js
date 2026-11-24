const aquasense = db.getSiblingDB("aquasense");

aquasense.expedientes.createIndex(
  { reporteId: 1 },
  {
    unique: true,
    name: "expediente_por_reporte_unico"
  }
);