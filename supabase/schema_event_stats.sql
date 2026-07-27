-- L2 Clan Cabinet — «Отчёты по мероприятиям»: боевая статистика (килы/смерти/PvP/PvE урон)
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql, schema_attendance.sql)

create table public.event_stats (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  event_id uuid not null references public.attendance_events(id) on delete cascade,
  nickname text not null,
  kills int not null default 0,
  deaths int not null default 0,
  pvp_damage bigint not null default 0,
  pve_damage bigint not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, nickname)
);
create index event_stats_event_idx on public.event_stats(event_id);
create index event_stats_clan_idx on public.event_stats(clan_id);

alter table public.event_stats enable row level security;

create policy "event_stats_select" on public.event_stats for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "event_stats_write_admins" on public.event_stats for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- раздел 'reports' уже создан и виден всем ролям (сид в schema.sql) — новых строк в
-- sections/role_sections не нужно, index.html просто перестанет показывать заглушку.
