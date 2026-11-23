-- L2 Clan Cabinet — журнал заходов владельца платформы в кланы (owner-console → «Войти в клан»).
-- Выполнить в Supabase Dashboard → SQL Editor. Повторный запуск безопасен.
-- Пишет только Edge Function owner-enter-clan (service-role); читать может только владелец платформы.

create table if not exists public.owner_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  clan_id uuid not null references public.clans(id) on delete cascade,
  leader_id uuid,
  entered_at timestamptz not null default now()
);
create index if not exists owner_access_log_entered_idx on public.owner_access_log (entered_at desc);

alter table public.owner_access_log enable row level security;

drop policy if exists "owner_access_log_select_platform_admin" on public.owner_access_log;
create policy "owner_access_log_select_platform_admin" on public.owner_access_log for select
  using ((select public.is_platform_admin()));
