-- H6 (Phase B'' hardening): alertas.resuelta_por must not be nulled out by
-- deleting the resolving usuario. "ON DELETE SET NULL" (migration 1) would
-- silently violate alertas_resolucion_check for an "atendida" alert (which
-- requires resuelta_por not null), turning a delete into a confusing
-- CHECK-violation error instead of a clear FK-violation one. Users are
-- deactivated (usuarios.activo = false), never deleted, so RESTRICT is the
-- correct and safe default here.

alter table public.alertas
  drop constraint alertas_resuelta_por_fkey,
  add constraint alertas_resuelta_por_fkey
    foreign key (resuelta_por) references public.usuarios (id) on delete restrict;
