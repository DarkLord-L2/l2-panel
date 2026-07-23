-- L2 Clan Cabinet — «Журнал посещаемости»: тумблер нового вида отчёта «Посещаемость»
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_attendance.sql)

create table public.attendance_report_style (
  clan_id uuid primary key references public.clans(id) on delete cascade,
  advanced_view boolean not null default false
);

alter table public.attendance_report_style enable row level security;

create policy "attendance_report_style_select" on public.attendance_report_style for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "attendance_report_style_write_admins" on public.attendance_report_style for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- нет строки для клана = старый (классический) вид отчёта, значение по умолчанию
