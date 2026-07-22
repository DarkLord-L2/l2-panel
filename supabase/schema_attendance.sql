-- L2 Clan Cabinet — «Журнал посещаемости» (фаза 1: конструктор + запись явки)
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql, schema_census.sql, schema_taxes.sql)

create table public.attendance_schedule_template (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  day_offset int not null,       -- 0 = понедельник .. 6 = воскресенье
  event_name text not null,
  sort_order int not null default 0
);

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  week_start date not null,      -- понедельник недели, к которой относится мероприятие
  event_date date not null,      -- фактическая дата мероприятия
  event_name text not null,
  sort_order int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index attendance_events_week_idx on public.attendance_events(clan_id, week_start);

create table public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  event_id uuid not null references public.attendance_events(id) on delete cascade,
  nickname text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index attendance_entries_event_idx on public.attendance_entries(event_id);

alter table public.attendance_schedule_template enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_entries enable row level security;

create policy "attendance_template_select" on public.attendance_schedule_template for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "attendance_template_write_admins" on public.attendance_schedule_template for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

create policy "attendance_events_select" on public.attendance_events for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "attendance_events_write_admins" on public.attendance_events for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

create policy "attendance_entries_select" on public.attendance_entries for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "attendance_entries_write_admins" on public.attendance_entries for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- раздел 'attendance' уже создан и виден всем ролям (сид в schema.sql) — новых строк в
-- sections/role_sections не нужно, index.html просто перестанет показывать заглушку.
