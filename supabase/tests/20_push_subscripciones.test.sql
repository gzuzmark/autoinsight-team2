-- G7b: push_subscripciones table behavior -- endpoint uniqueness (upsert
-- key, see lib/push/subscription-store.ts's doc), size limits, and that a
-- reset/scenario/turno never touches it (a facilitator preference/device
-- registration, not demo state -- same rationale as the G6 email toggle).
begin;
select plan(6);

insert into public.push_subscripciones (endpoint, p256dh, auth)
values ('https://push.example.com/a', 'p256dh-value', 'auth-value');

select is(
  (select count(*)::int from public.push_subscripciones),
  1,
  'one subscription inserted'
);

select throws_ok(
  $$insert into public.push_subscripciones (endpoint, p256dh, auth)
    values ('https://push.example.com/a', 'other-p256dh', 'other-auth')$$,
  '23505',
  null,
  'endpoint is unique -- a re-subscribe from the same browser must upsert, not duplicate'
);

select throws_ok(
  $$insert into public.push_subscripciones (endpoint, p256dh, auth)
    values (repeat('x', 2049), 'p', 'a')$$,
  '23514',
  null,
  'endpoint over 2048 chars is rejected'
);

select throws_ok(
  $$insert into public.push_subscripciones (endpoint, p256dh, auth)
    values ('https://push.example.com/b', repeat('x', 513), 'a')$$,
  '23514',
  null,
  'p256dh over 512 chars is rejected'
);

-- G2/G3/G6 demo controls never touch push subscriptions (facilitator/device
-- registration, not demo state).
select public.demo_reiniciar();
select public.demo_aplicar_escenario('todo-ok');
select is(
  (select count(*)::int from public.push_subscripciones),
  1,
  'demo_reiniciar/demo_aplicar_escenario never delete push subscriptions'
);

select lives_ok(
  $$delete from public.push_subscripciones where endpoint = 'https://push.example.com/a'$$,
  'a subscription can be deleted by endpoint (unsubscribe path)'
);

select * from finish();
rollback;
