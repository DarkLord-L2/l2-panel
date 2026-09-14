-- L2 Clan Cabinet — «Динамика»: простые графики трендов (первый — посещаемость по
-- неделям, читает уже существующие attendance_events/attendance_entries).
-- Новых таблиц не требует. Выполнить в Supabase Dashboard → SQL Editor
-- (после schema.sql, schema_attendance.sql, schema_platform_admin.sql).

insert into public.sections (key, label, sort)
values ('trends', 'Динамика', 60)
on conflict (key) do nothing;

insert into public.role_sections (clan_id, role_id, section_key, visible)
select c.id, r.id, 'trends', true
from public.clans c
cross join public.roles r
on conflict (clan_id, role_id, section_key) do nothing;
