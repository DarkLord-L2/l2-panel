-- L2 Clan Cabinet — «Журнал посещаемости»: видимость дней недели (настройки, шестерёнка)
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_attendance.sql)

create table public.attendance_day_visibility (
  clan_id uuid not null references public.clans(id) on delete cascade,
  day_offset int not null,       -- 0 = понедельник .. 6 = воскресенье
  visible boolean not null default true,
  primary key (clan_id, day_offset)
);

alter table public.attendance_day_visibility enable row level security;

create policy "attendance_day_visibility_select" on public.attendance_day_visibility for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "attendance_day_visibility_write_admins" on public.attendance_day_visibility for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- нет строки для дня = день виден (значение по умолчанию), появляется строка только
-- когда его явно скрывают через настройки в attendance.html
