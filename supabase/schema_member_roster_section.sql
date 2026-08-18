-- L2 Clan Cabinet — «Участники клана»: просмотр текущего состава (последняя перепись)
-- по пати или по алфавиту, с быстрым назначением профессии кликом по аватарке.
-- Новых таблиц не требует — переиспользует census_entries, clan_groups/clan_group_members
-- и member_classes, которые уже есть.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql, schema_platform_admin.sql)

insert into public.sections (key, label, sort)
values ('roster', 'Участники клана', 17)
on conflict (key) do nothing;

insert into public.role_sections (clan_id, role_id, section_key, visible)
select c.id, r.id, 'roster', true
from public.clans c
cross join public.roles r
on conflict (clan_id, role_id, section_key) do nothing;
