-- Solo lectura. Ejecutar en cada base con el mismo usuario y PostgreSQL mayor.
-- psql -X -A -t -v ON_ERROR_STOP=1 -f herramientas/exportar-estructura.sql
WITH objetos AS (
  SELECT 'tabla' AS clase, c.relname AS identificador,
    jsonb_build_object('persistencia', c.relpersistence, 'seguridadFilas', c.relrowsecurity,
      'particion', pg_get_expr(c.relpartbound, c.oid), 'claveParticion', pg_get_partkeydef(c.oid),
      'columnas', (SELECT jsonb_agg(jsonb_build_object(
        'nombre', a.attname, 'tipo', format_type(a.atttypid, a.atttypmod),
        'obligatoria', a.attnotnull, 'identidad', a.attidentity, 'generada', a.attgenerated,
        'predeterminado', pg_get_expr(d.adbin, d.adrelid),
        'cotejamiento', CASE WHEN a.attcollation <> 0 THEN quote_ident(cn.nspname) || '.' || quote_ident(co.collname) END
      ) ORDER BY a.attnum)
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      LEFT JOIN pg_collation co ON co.oid = a.attcollation LEFT JOIN pg_namespace cn ON cn.oid = co.collnamespace
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped)) AS definicion
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'aquasense' AND c.relkind IN ('r', 'p')
  UNION ALL
  SELECT 'restriccion', c.relname || '.' || co.conname,
    jsonb_build_object('definicion', pg_get_constraintdef(co.oid, true),
      'diferible', co.condeferrable, 'diferida', co.condeferred, 'validada', co.convalidated)
  FROM pg_constraint co JOIN pg_class c ON c.oid = co.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'aquasense'
  UNION ALL
  SELECT 'indice', c.relname,
    jsonb_build_object('definicion', pg_get_indexdef(c.oid), 'valido', i.indisvalid, 'listo', i.indisready)
  FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'aquasense'
  UNION ALL
  SELECT 'funcion', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    jsonb_build_object('definicion', pg_get_functiondef(p.oid), 'configuracion', p.proconfig)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'aquasense' AND p.prokind IN ('f', 'p')
  UNION ALL
  SELECT 'trigger', c.relname || '.' || t.tgname,
    jsonb_build_object('definicion', pg_get_triggerdef(t.oid, true), 'habilitado', t.tgenabled)
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'aquasense' AND NOT t.tgisinternal
  UNION ALL
  SELECT 'vista', c.relname, jsonb_build_object('definicion', pg_get_viewdef(c.oid, true), 'opciones', c.reloptions)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'aquasense' AND c.relkind IN ('v', 'm')
  UNION ALL
  SELECT 'secuencia', c.relname, jsonb_build_object('tipo', format_type(s.seqtypid, null),
    'inicio', s.seqstart, 'incremento', s.seqincrement, 'minimo', s.seqmin,
    'maximo', s.seqmax, 'cache', s.seqcache, 'ciclo', s.seqcycle)
  FROM pg_sequence s JOIN pg_class c ON c.oid = s.seqrelid JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'aquasense'
  UNION ALL
  SELECT 'enumeracion', t.typname, jsonb_build_object('valores', jsonb_agg(e.enumlabel ORDER BY e.enumsortorder))
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE n.nspname = 'aquasense' GROUP BY t.typname
)
SELECT jsonb_build_object('formato', 1, 'esquema', 'aquasense',
  'postgresMayor', current_setting('server_version_num')::integer / 10000,
  'objetos', COALESCE(jsonb_agg(jsonb_build_object('clase', clase,
    'identificador', identificador, 'definicion', definicion) ORDER BY clase, identificador), '[]'::jsonb)) AS estructura
FROM objetos;
