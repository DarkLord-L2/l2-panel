-- L2 Clan Cabinet — «Мой кабинет»: у каждого своя статистика по мероприятиям
-- (по нику, привязанному в Админ-панели) и своя проверка буста, только просмотр.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

insert into public.sections (key, label, sort)
values ('my_cabinet', 'Мой кабинет', 5)
on conflict (key) do nothing;

-- виден всем ролям во всех кланах по умолчанию, как и остальные не-админские разделы
-- (role_sections теперь per-клан: clan_id, role_id, section_key — см. schema_platform_admin.sql)
insert into public.role_sections (clan_id, role_id, section_key, visible)
select c.id, r.id, 'my_cabinet', true
from public.clans c
cross join public.roles r
on conflict (clan_id, role_id, section_key) do nothing;
