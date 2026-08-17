-- L2 Clan Cabinet — «Журнал посещаемости»: одна запись на каждый загруженный и
-- распознанный ОСР-скрин, чтобы «Отчёт по мероприятиям» мог подписывать блок строк
-- именем пати/группы (или «Соло») и позволять админу переименовать метку вручную.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql, schema_attendance.sql)

create table public.event_screenshot_batches (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  event_id uuid not null references public.attendance_events(id) on delete cascade,
  -- null = метка вычисляется на лету в отчёте (по составу группы); не-null = ручной оverride
  manual_label text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index event_screenshot_batches_event_idx on public.event_screenshot_batches(event_id);

alter table public.event_screenshot_batches enable row level security;

create policy "event_screenshot_batches_select" on public.event_screenshot_batches for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "event_screenshot_batches_write_admins" on public.event_screenshot_batches for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
