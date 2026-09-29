-- G7b: storage for office Web Push subscriptions (one row per browser/
-- device that clicked "Activar notificaciones" -- lib/push/subscription-store.ts).
-- Server-only, same pattern as every other table (D16/D17): RLS enabled,
-- no anon/authenticated policies or grants -- only the service-role key
-- (used exclusively server-side, see lib/domain/supabase-push-subscription-store.ts)
-- can read/write it; PostgREST's anon/authenticated roles cannot see it at
-- all (both the blanket revoke below and the schema-wide default-privilege
-- revoke from migration 1 apply).
--
-- `/oficina` has no auth (O-D4): "anyone with the URL can subscribe" is
-- documented and accepted for this demo (README) -- the endpoint itself is
-- validated (https, real push-service host allowlist, size limits) before
-- it ever reaches this table (see lib/push/validate-subscription.ts), and
-- the total row count is capped app-side (MAX_SUSCRIPCIONES, see
-- lib/push/subscription-store.ts), but there is no per-user ownership
-- check on top of that.
create table public.push_subscripciones (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) <= 512),
  auth text not null check (char_length(auth) <= 512),
  creada_en timestamptz not null default now()
);

alter table public.push_subscripciones enable row level security;

revoke all on public.push_subscripciones from anon, authenticated;
