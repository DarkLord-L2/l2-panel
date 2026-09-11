-- Админ-панель: лог действий администраторов клана (кто и что поменял —
-- создание/удаление пользователей, смена роли/пати, сумма налога, вкл/выкл
-- разделов и т.д.). Пишется из admin.html при каждом таком действии.
-- Append-only с точки зрения приложения: нет policy на update/delete —
-- ни один админ не может отредактировать или стереть уже сделанную запись
-- через саму панель (только через Supabase Dashboard напрямую).
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  actor_username text not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index admin_audit_log_clan_idx on public.admin_audit_log(clan_id, created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log_select" on public.admin_audit_log;
create policy "admin_audit_log_select" on public.admin_audit_log for select
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

drop policy if exists "admin_audit_log_insert" on public.admin_audit_log;
create policy "admin_audit_log_insert" on public.admin_audit_log for insert
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
