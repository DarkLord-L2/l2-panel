-- L2 Clan Cabinet — «Журнал посещаемости»: флаг «неделя уже инициализирована»
-- Чинит баг: если удалить единственное мероприятие недели, count(events)=0 и
-- ensureWeekPopulated() ошибочно решает, что неделю ещё не заполняли, и
-- тут же тащит её обратно из шаблона. Нужен отдельный маркер, а не счётчик.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_attendance.sql)

create table public.attendance_week_init (
  clan_id uuid not null references public.clans(id) on delete cascade,
  week_start date not null,
  primary key (clan_id, week_start)
);

alter table public.attendance_week_init enable row level security;

create policy "attendance_week_init_select" on public.attendance_week_init for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "attendance_week_init_write_admins" on public.attendance_week_init for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
