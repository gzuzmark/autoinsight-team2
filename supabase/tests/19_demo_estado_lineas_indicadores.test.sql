-- Batch I (final-demo plan, 2026-09-29): `demo_estado_lineas()` gained a
-- per-line `indicadores` field -- {clave, estado} for fpy/dph/scrap, in
-- that stable order -- alongside the existing worst-of `estado_kpi`.
begin;
select plan(6);

-- Isolate from any other test file's leftovers, same pattern as
-- 18_demo_estado_lineas_kpi.test.sql.
delete from public.alertas;

select is(
  (
    select jsonb_agg(e -> 'clave')
    from jsonb_array_elements(
      (select e -> 'indicadores' from jsonb_array_elements(public.demo_estado_lineas()) e
         where e ->> 'nombre' = 'Línea 2 · Pintura')
    ) e
  ),
  '["fpy", "dph", "scrap"]'::jsonb,
  'indicadores lists fpy, dph, scrap in that stable order'
);

-- Línea 2's seeded KPIs (fpy 90.1, dph 4.5, scrap 2.4 -- supabase/seed.sql)
-- are all in their atencion band.
select is(
  (
    select e -> 'estado'
    from jsonb_array_elements(
      (select e -> 'indicadores' from jsonb_array_elements(public.demo_estado_lineas()) e
         where e ->> 'nombre' = 'Línea 2 · Pintura')
    ) e
    where e ->> 'clave' = 'fpy'
  ),
  '"atencion"'::jsonb,
  'Línea 2 fpy reports atencion'
);
select is(
  (
    select e -> 'estado'
    from jsonb_array_elements(
      (select e -> 'indicadores' from jsonb_array_elements(public.demo_estado_lineas()) e
         where e ->> 'nombre' = 'Línea 2 · Pintura')
    ) e
    where e ->> 'clave' = 'dph'
  ),
  '"atencion"'::jsonb,
  'Línea 2 dph reports atencion'
);
select is(
  (
    select e -> 'estado'
    from jsonb_array_elements(
      (select e -> 'indicadores' from jsonb_array_elements(public.demo_estado_lineas()) e
         where e ->> 'nombre' = 'Línea 2 · Pintura')
    ) e
    where e ->> 'clave' = 'scrap'
  ),
  '"atencion"'::jsonb,
  'Línea 2 scrap reports atencion'
);

-- Línea 3's seeded fpy (88.4) is in the parar band -- matches estado_kpi's
-- own worst-of value (18_demo_estado_lineas_kpi.test.sql).
select is(
  (
    select e -> 'estado'
    from jsonb_array_elements(
      (select e -> 'indicadores' from jsonb_array_elements(public.demo_estado_lineas()) e
         where e ->> 'nombre' = 'Línea 3 · Motores')
    ) e
    where e ->> 'clave' = 'fpy'
  ),
  '"parar"'::jsonb,
  'Línea 3 fpy reports parar, matching its own estado_kpi'
);

-- Every element carries exactly clave + estado (no accidental extra keys).
select is(
  (
    select jsonb_agg(distinct (select array_agg(k order by k) from jsonb_object_keys(e) k))
    from jsonb_array_elements(
      (select e -> 'indicadores' from jsonb_array_elements(public.demo_estado_lineas()) e
         where e ->> 'nombre' = 'Línea 1 · Chasis')
    ) e
  ),
  jsonb_build_array(array['clave', 'estado']),
  'each indicadores element carries exactly clave and estado'
);

select * from finish();
rollback;
