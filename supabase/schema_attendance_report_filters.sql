-- L2 Clan Cabinet — «Журнал посещаемости»: видимость вкладок-фильтров отчёта «Посещаемость»
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_attendance.sql)

create table public.attendance_report_filters (
  clan_id uuid not null references public.clans(id) on delete cascade,
  filter_key text not null,
  visible boolean not null default true,
  primary key (clan_id, filter_key)
);

alter table public.attendance_report_filters enable row level security;

create policy "attendance_report_filters_select" on public.attendance_report_filters for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "attendance_report_filters_write_admins" on public.attendance_report_filters for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- нет строки для вкладки = она видна (значение по умолчанию), появляется строка только
-- когда её явно скрывают через настройки в attendance.html
