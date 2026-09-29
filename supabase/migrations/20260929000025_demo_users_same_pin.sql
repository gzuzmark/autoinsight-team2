-- H1+H2: demo users share PIN 1234 (guerrilla-testing convenience: the
-- facilitator only needs to remember one PIN when walking a participant
-- through login), and Línea 2 gets a demo user of its own (H1: previously it
-- had none, so alerts generated there by demo_simular_turno_linea were
-- never visible on any floor tablet -- the floor only ever shows the
-- logged-in user's own line).
--
-- This migration targets an ALREADY-SEEDED database (staging): on a fresh
-- `supabase db reset --local`, every migration runs BEFORE
-- supabase/seed.sql loads -- at the point this migration runs,
-- public.lineas/public.usuarios/public.usuarios_pin are still completely
-- EMPTY. The insert below is guarded on Línea 2 already existing, so it
-- no-ops on a fresh database (seed.sql itself seeds Gabi Paz and every PIN
-- as 1234 directly there, so nothing is ever double-inserted); on staging,
-- where the previous seed already ran, the guard passes and this migration
-- does the real work. The pin_hash UPDATE below needs no such guard: an
-- UPDATE with a WHERE clause against an empty table is already a harmless
-- no-op (and it still has an explicit WHERE, as pg-safeupdate requires).

do $$
declare
  v_linea2_id uuid;
begin
  select id into v_linea2_id from public.lineas where nombre = 'Línea 2 · Pintura';

  if v_linea2_id is not null then
    insert into public.usuarios (id, linea_id, nombre, iniciales, color)
    values ('00000000-0000-0000-0000-000000000107', v_linea2_id, 'Gabi Paz', 'GP', '#65a30d')
    on conflict (id) do nothing;

    insert into public.usuarios_pin (usuario_id, pin_hash)
    select '00000000-0000-0000-0000-000000000107', extensions.crypt('1234', extensions.gen_salt('bf'))
    where not exists (
      select 1 from public.usuarios_pin where usuario_id = '00000000-0000-0000-0000-000000000107'
    );
  end if;
end;
$$;

-- Every known seed user's PIN becomes 1234 (safeupdate: explicit WHERE on
-- the known seed user ids).
update public.usuarios_pin
set pin_hash = extensions.crypt('1234', extensions.gen_salt('bf'))
where usuario_id in (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000105',
  '00000000-0000-0000-0000-000000000106',
  '00000000-0000-0000-0000-000000000107'
);
