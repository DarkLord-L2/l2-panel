-- L2 Clan Cabinet — «Раздел дропа»: начальные баллы участника за период = сколько
-- мероприятий он посетил (та же явка, что в «Журнале посещаемости»), финальные баллы =
-- начальные × (процент буста / 100) × коэффициент его профессии, голда делится между
-- всеми пропорционально финальным баллам. Коэффициенты профессий настраиваются в
-- Админ-панели («Правила клана»), сама страница ничего не пишет в БД, кроме
-- иконок над столбцами мероприятий.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql, schema_platform_admin.sql,
-- schema_member_classes.sql, schema_attendance.sql, schema_gear_check.sql)

create table if not exists public.loot_class_coefficients (
  clan_id uuid not null references public.clans(id) on delete cascade,
  class_name text not null,
  coefficient numeric not null default 1,
  primary key (clan_id, class_name)
);

alter table public.loot_class_coefficients enable row level security;

drop policy if exists "loot_class_coefficients_select" on public.loot_class_coefficients;
create policy "loot_class_coefficients_select" on public.loot_class_coefficients for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "loot_class_coefficients_write_admins" on public.loot_class_coefficients;
create policy "loot_class_coefficients_write_admins" on public.loot_class_coefficients for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- картинка над столбцом мероприятия в матрице «Раздела дропа» (необязательная,
-- по умолчанию пусто) — та же attendance_events, что уже используется в явке/отчётах
alter table public.attendance_events add column if not exists icon text;

insert into public.sections (key, label, sort)
values ('loot_split', 'Раздел дропа', 55)
on conflict (key) do nothing;

-- виден всем ролям во всех кланах по умолчанию, как и остальные не-админские разделы
-- (role_sections теперь per-клан: clan_id, role_id, section_key — см. schema_platform_admin.sql)
insert into public.role_sections (clan_id, role_id, section_key, visible)
select c.id, r.id, 'loot_split', true
from public.clans c
cross join public.roles r
on conflict (clan_id, role_id, section_key) do nothing;
