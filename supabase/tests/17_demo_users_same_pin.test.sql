-- H1+H2: every seed user (including the new Gabi Paz on Línea 2) logs in
-- with PIN 1234 through the real `iniciar_sesion` RPC -- not just a stored
-- hash comparison (06_seed.test.sql already covers that at the row level;
-- this exercises the actual login path the floor tablet uses).
begin;
select plan(9);

select id as usuario_id from public.usuarios where nombre = 'Gabi Paz' \gset gabi_

select is(
  (select id from public.lineas where nombre = 'Línea 2 · Pintura'),
  (select linea_id from public.usuarios where id = :'gabi_usuario_id'),
  'Gabi Paz is seeded on Línea 2 · Pintura'
);

select isnt(public.iniciar_sesion('00000000-0000-0000-0000-000000000101', '1234'), null, 'Ana Ríos logs in with 1234');
select isnt(public.iniciar_sesion('00000000-0000-0000-0000-000000000102', '1234'), null, 'Beto Cruz logs in with 1234');
select isnt(public.iniciar_sesion('00000000-0000-0000-0000-000000000103', '1234'), null, 'Caro Díaz logs in with 1234');
select isnt(public.iniciar_sesion('00000000-0000-0000-0000-000000000104', '1234'), null, 'Diego Mora logs in with 1234');
select isnt(public.iniciar_sesion('00000000-0000-0000-0000-000000000105', '1234'), null, 'Eli Vega logs in with 1234');
select isnt(public.iniciar_sesion('00000000-0000-0000-0000-000000000106', '1234'), null, 'Fer Luna logs in with 1234');
select isnt(public.iniciar_sesion('00000000-0000-0000-0000-000000000107', '1234'), null, 'Gabi Paz logs in with 1234');

-- A PIN that used to belong to a DIFFERENT user (Beto Cruz's old "2468") no
-- longer works for anyone -- every seed user now shares exactly one PIN.
select is(
  public.iniciar_sesion('00000000-0000-0000-0000-000000000101', '2468'),
  null,
  'Ana Ríos'' old-style distinct PIN for another user does not log her in'
);

select * from finish();
rollback;
