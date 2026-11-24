# Ejemplo manual: reporte y reemplazo de tubería

Este recorrido reproduce el ejemplo ficticio de humedad en los baños de UD1: inspección de TUB-03, reemplazo por TUB-12, verificación y cierre. Los eventos se aplican **manualmente**, no hay sincronizador automático.

## Antes de comenzar

- Trabaja en una base PostgreSQL, una base MongoDB y un grafo Neo4j **aislados y nuevos**. No uses las bases que ya contienen el ejemplo: los identificadores son fijos y entrarían en conflicto.
- Completa la carga base indicada en el [README](../README.md): PostgreSQL con 14 espacios, 20 componentes, 22 conexiones, 7 lecturas y `version_red = 0`; colección MongoDB vacía con su validador e índice; grafo Neo4j base comparado con PostgreSQL y control inicializado en `0`.
- Los scripts MongoDB del repositorio usan el nombre `aquasense`: para aislarlos, utiliza otra instancia o adapta el nombre en una copia. Comprueba que cada consola apunta a la base de prueba correcta antes de escribir.
- Ejecuta los comandos PostgreSQL en pgAdmin o psql, los de MongoDB en `mongosh` y los Cypher en Neo4j Query. Los archivos SQL indicados están en `bases-de-datos/postgresql/`. Detente ante cualquier error, resultado inesperado o cero filas. Si falla una transacción PostgreSQL, ejecuta `ROLLBACK;`.
- Las fechas de las atenciones se generan al ejecutar los SQL. **No reutilices las fechas del ejemplo anterior.** Copia siempre el objeto `datos` del evento recién generado.

## 1. Crear el reporte y su expediente

Ejecuta `29_datos_iniciales_reporte.sql`. En PostgreSQL consulta el evento:

```sql
SELECT secuencia, estado, datos
FROM aquasense.evento_salida
WHERE evento_id = '60000000-0000-0000-0000-000000000001';
```

Debe estar `PENDIENTE`, con secuencia `1`. En `mongosh`, en la base de prueba, introduce el JSON completo de `datos` como objeto JavaScript sustituyendo el marcador por el resultado real de PostgreSQL:

```javascript
// Sustituye el marcador con el JSON real, sin comillas alrededor del objeto.
var evento = /* PEGA AQUÍ EL OBJETO JSON DE datos */;
```

Ejecuta después:

```javascript
if (evento.reporteId !== '50000000-0000-0000-0000-000000000001') {
  throw new Error('El reporte del evento no coincide.');
}

db.expedientes.insertOne({
  reporteId: evento.reporteId,
  descripcionInicial: evento.descripcionInicial,
  ...(evento.referenciaUbicacion != null
    ? { referenciaUbicacion: evento.referenciaUbicacion }
    : {}),
  ultimaSecuenciaAplicada: NumberLong('1'),
  ultimoEventoId: '60000000-0000-0000-0000-000000000001',
  atenciones: [],
  creadoEn: new Date(),
  actualizadoEn: new Date()
});
```

Comprueba `acknowledged: true` y consulta el expediente completo:

```javascript
db.expedientes.findOne({ reporteId: '50000000-0000-0000-0000-000000000001' });
```

Verifica que descripción y ubicación coincidan con el evento, y que la secuencia y el último evento sean `1` y el ID terminado en `0001`. Solo entonces confirma en PostgreSQL:

```sql
SELECT aquasense.confirmar_evento_documental(
  '60000000-0000-0000-0000-000000000001'::uuid
);
```

## 2. Inspección y reparación

Ejecuta `30_datos_iniciales_inspeccion.sql` y consulta el evento terminado en `0002`:

```sql
SELECT secuencia, estado, datos FROM aquasense.evento_salida
WHERE evento_id = '60000000-0000-0000-0000-000000000002';
```

Debe estar pendiente en la secuencia `2`. En `mongosh`, sustituye el valor de `evento` por el **objeto `datos` completo de esta fila**, con el mismo formato del paso anterior. Aplica la atención mediante el siguiente comando:

```javascript
if (evento.reporteId !== '50000000-0000-0000-0000-000000000001' ||
    evento.atencion?.atencionId !== '70000000-0000-0000-0000-000000000001' ||
    evento.atencion?.tipo !== 'INSPECCION') {
  throw new Error('Los datos no corresponden a la inspección esperada.');
}

db.expedientes.updateOne(
  {
    reporteId: evento.reporteId,
    ultimaSecuenciaAplicada: NumberLong('1'),
    ultimoEventoId: '60000000-0000-0000-0000-000000000001',
    'atenciones.atencionId': { $ne: evento.atencion.atencionId }
  },
  {
    $push: { atenciones: evento.atencion },
    $set: {
      ultimaSecuenciaAplicada: NumberLong('2'),
      ultimoEventoId: '60000000-0000-0000-0000-000000000002'
    },
    $currentDate: { actualizadoEn: true }
  }
);
```

Exige `matchedCount: 1` y `modifiedCount: 1`, consulta el expediente y compara la atención completa, secuencia y último evento con PostgreSQL. Solo después confirma:

```sql
SELECT aquasense.confirmar_evento_documental('60000000-0000-0000-0000-000000000002'::uuid);
```

Ejecuta `31_datos_iniciales_reemplazo.sql`. En PostgreSQL comprueba que los eventos terminados en `0003` (documental, secuencia 3) y `0004` (grafo, secuencia 1) estén pendientes:

```sql
SELECT evento_id, destino, secuencia, estado, datos
FROM aquasense.evento_salida
WHERE evento_id IN (
  '60000000-0000-0000-0000-000000000003',
  '60000000-0000-0000-0000-000000000004'
)
ORDER BY destino;
```

En `mongosh`, sustituye `evento` por el objeto `datos` del evento **documental** terminado en `0003` y ejecuta:

```javascript
if (evento.reporteId !== '50000000-0000-0000-0000-000000000001' ||
    evento.atencion?.atencionId !== '70000000-0000-0000-0000-000000000002' ||
    evento.atencion?.tipo !== 'REPARACION') {
  throw new Error('Los datos no corresponden a la reparación esperada.');
}

db.expedientes.updateOne(
  {
    reporteId: evento.reporteId,
    ultimaSecuenciaAplicada: NumberLong('2'),
    ultimoEventoId: '60000000-0000-0000-0000-000000000002',
    'atenciones.atencionId': { $ne: evento.atencion.atencionId }
  },
  {
    $push: { atenciones: evento.atencion },
    $set: {
      ultimaSecuenciaAplicada: NumberLong('3'),
      ultimoEventoId: '60000000-0000-0000-0000-000000000003'
    },
    $currentDate: { actualizadoEn: true }
  }
);
```

Exige un documento encontrado y modificado, comprueba los datos completos y confirma en PostgreSQL:

```sql
SELECT aquasense.confirmar_evento_documental('60000000-0000-0000-0000-000000000003'::uuid);
```

Si una actualización devuelve `matchedCount: 0`, no la consideres exitosa ni confirmes automáticamente. Consulta el expediente y el evento en PostgreSQL para distinguir un cambio ya aplicado de una discrepancia; resolverla antes de continuar.

## 3. Aplicar el reemplazo al grafo

Comprueba que el evento de grafo `0004` contiene la operación `REEMPLAZAR_TUBERIA`, secuencia `1`, y los extremos esperados. Ejecuta la siguiente consulta completa en Neo4j Query. Todos los cambios ocurren en la transacción de esa consulta:

```cypher
MATCH (control:ControlRed {id: 'red-principal', estado: 'INICIALIZADO', versionAplicada: 0})
MATCH (union:Componente {componenteId: '20000000-0000-0000-0000-000000000003'})
MATCH (anterior:Componente {componenteId: '20000000-0000-0000-0000-000000000006', codigo: 'TUB-03', estado: 'ACTIVO'})
MATCH (banos:Espacio {espacioId: '10000000-0000-0000-0000-000000000010'})
MATCH (union)-[entrada:CONECTA_CON {conexionId: '30000000-0000-0000-0000-000000000005'}]->(anterior)
MATCH (anterior)-[salida:CONECTA_CON {conexionId: '30000000-0000-0000-0000-000000000006'}]->(banos)
MATCH (anterior)-[:UBICADO_EN]->(banos)
OPTIONAL MATCH (existente:Componente {componenteId: '20000000-0000-0000-0000-000000000021'})
OPTIONAL MATCH (eventoExistente:EventoAplicado {eventoId: '60000000-0000-0000-0000-000000000004'})
WITH control, union, anterior, banos, entrada, salida, existente, eventoExistente
WHERE existente IS NULL AND eventoExistente IS NULL
DELETE entrada, salida
CREATE (nueva:Componente {
  componenteId: '20000000-0000-0000-0000-000000000021',
  codigo: 'TUB-12', nombre: 'Tubería de reemplazo hacia baños de UD1',
  tipo: 'TUBERIA', estado: 'ACTIVO'
})
SET anterior.estado = 'RETIRADO'
CREATE (union)-[:CONECTA_CON {conexionId: '30000000-0000-0000-0000-000000000005'}]->(nueva)
CREATE (nueva)-[:CONECTA_CON {conexionId: '30000000-0000-0000-0000-000000000006'}]->(banos)
CREATE (nueva)-[:UBICADO_EN]->(banos)
CREATE (nueva)-[:REEMPLAZA_A {
  reemplazoId: '80000000-0000-0000-0000-000000000001',
  reporteId: '50000000-0000-0000-0000-000000000001'
}]->(anterior)
CREATE (:EventoAplicado {eventoId: '60000000-0000-0000-0000-000000000004', secuencia: 1, aplicadoEn: datetime()})
SET control.versionAplicada = 1
RETURN anterior.codigo AS retirada, nueva.codigo AS instalada, control.versionAplicada AS version;
```

El resultado debe ser `TUB-03`, `TUB-12`, `1`. Cero filas significa que no se cumplieron las precondiciones: consulta el grafo antes de intentar de nuevo. Revisa además el recorrido nuevo, la relación de reemplazo y el nodo del evento. Confirma en PostgreSQL solo después de verificar:

```sql
SELECT aquasense.confirmar_evento_grafo(
  '60000000-0000-0000-0000-000000000004'::uuid
);
```

## 4. Verificar y cerrar el reporte

En PostgreSQL, registra la verificación ficticia:

```sql
SELECT aquasense.registrar_atencion(
  '60000000-0000-0000-0000-000000000005'::uuid,
  '50000000-0000-0000-0000-000000000001'::uuid,
  jsonb_build_object(
    'atencionId', '70000000-0000-0000-0000-000000000003',
    'tipo', 'VERIFICACION',
    'fecha', to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'descripcion', 'Se revisó el tramo instalado y el área cercana a los lavabos.',
    'componenteId', '20000000-0000-0000-0000-000000000021',
    'resultado', 'SIN_INDICIOS'
  )
);
```

Consulta el evento documental `0005` y comprueba que está pendiente en la secuencia `4`. Sustituye `evento` en `mongosh` por su objeto `datos` completo y ejecuta:

```javascript
if (evento.reporteId !== '50000000-0000-0000-0000-000000000001' ||
    evento.atencion?.atencionId !== '70000000-0000-0000-0000-000000000003' ||
    evento.atencion?.tipo !== 'VERIFICACION' ||
    evento.atencion?.resultado !== 'SIN_INDICIOS') {
  throw new Error('Los datos no corresponden a la verificación esperada.');
}

db.expedientes.updateOne(
  {
    reporteId: evento.reporteId,
    ultimaSecuenciaAplicada: NumberLong('3'),
    ultimoEventoId: '60000000-0000-0000-0000-000000000003',
    'atenciones.atencionId': { $ne: evento.atencion.atencionId }
  },
  {
    $push: { atenciones: evento.atencion },
    $set: {
      ultimaSecuenciaAplicada: NumberLong('4'),
      ultimoEventoId: '60000000-0000-0000-0000-000000000005'
    },
    $currentDate: { actualizadoEn: true }
  }
);
```

Exige un documento encontrado y modificado y compara la atención completa, secuencia y último evento con PostgreSQL. Después confirma y cierra en una misma transacción:

```sql
BEGIN;
SELECT aquasense.confirmar_evento_documental('60000000-0000-0000-0000-000000000005'::uuid);
SELECT aquasense.cerrar_reporte('50000000-0000-0000-0000-000000000001'::uuid);
COMMIT;
```

## 5. Comprobación final

En PostgreSQL:

```sql
SELECT estado, secuencia_documental, cerrado_en FROM aquasense.reporte
WHERE reporte_id = '50000000-0000-0000-0000-000000000001';

SELECT destino, secuencia, estado FROM aquasense.evento_salida
WHERE evento_id IN (
  '60000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000004',
  '60000000-0000-0000-0000-000000000005'
) ORDER BY destino, secuencia;

SELECT version_red FROM aquasense.control_red WHERE control_id = 1;
```

El reporte debe estar `CERRADO`, con secuencia `4` y fecha de cierre; los cinco eventos, `PROCESADO`; la versión de red, `1`.

En MongoDB, la siguiente consulta debe mostrar secuencia `4` y tres atenciones: inspección, reparación y verificación:

```javascript
db.expedientes.findOne(
  { reporteId: '50000000-0000-0000-0000-000000000001' },
  { _id: 0, reporteId: 1, ultimaSecuenciaAplicada: 1, ultimoEventoId: 1, atenciones: 1 }
);
```

En Neo4j, comprueba versión, estados e historial:

```cypher
MATCH (control:ControlRed {id: 'red-principal'})
MATCH (nueva:Componente {codigo: 'TUB-12'})-[r:REEMPLAZA_A]->(anterior:Componente {codigo: 'TUB-03'})
MATCH (nueva)-[:CONECTA_CON]->(banos:Espacio {espacioId: '10000000-0000-0000-0000-000000000010'})
MATCH (evento:EventoAplicado {eventoId: '60000000-0000-0000-0000-000000000004'})
RETURN control.versionAplicada AS version, anterior.estado AS estado_anterior,
       nueva.estado AS estado_nuevo, banos.nombre AS destino, evento.secuencia AS secuencia;
```

Debe devolver versión `1`, `RETIRADO`, `ACTIVO`, los baños de estudiantes de UD1 y secuencia `1`.

Este procedimiento guía una ejecución manual en orden. No proporciona reintentos automáticos, coordinación entre procesos ni seguridad frente a escrituras concurrentes. La comprobación y el tratamiento de recuperaciones reales corresponden al futuro sincronizador.
