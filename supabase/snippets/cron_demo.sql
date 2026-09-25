-- Opt-in demo cron jobs (B6). NOT a migration: migrations run automatically
-- in order on every `supabase db reset` / remote apply, and a background job
-- that keeps mutating data would make `supabase test db` non-deterministic
-- and would surprise a remote cutover. Run this snippet manually, only when
-- you actually want the simulator running in the background, via:
--   - the local SQL editor / `psql` against the local `db` connection, or
--   - Dashboard -> Integrations -> Cron (paste this file's body) on a
--     remote project (after the authorized B8 cutover).
--
-- pg_cron must be available (it is enabled in this template's local image;
-- on a remote project enable the "pg_cron" extension first).

create extension if not exists pg_cron;

-- Add a small stream of new alerts every 2 minutes, spread across all lines
-- (p_linea_id = null -> demo_generar_alertas itself picks a random line per
-- call, see the function's own comment).
select cron.schedule(
  'demo-generar-alertas',
  '*/2 * * * *',
  $$ select public.demo_generar_alertas(null, 1) $$
);

-- Auto-resolve alerts nobody has acted on for 30+ minutes, every 5 minutes.
select cron.schedule(
  'demo-autoresolver',
  '*/5 * * * *',
  $$ select public.demo_autoresolver('30 minutes'::interval) $$
);

-- Pause both jobs without unscheduling them (keeps the job ids/history):
--   select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'demo-generar-alertas'), active := false);
--   select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'demo-autoresolver'), active := false);
-- Resume:
--   select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'demo-generar-alertas'), active := true);
--   select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'demo-autoresolver'), active := true);
-- Remove entirely:
--   select cron.unschedule('demo-generar-alertas');
--   select cron.unschedule('demo-autoresolver');
