-- L2 Clan Cabinet — «Таланты»: калькулятор дерева способностей (Scryde X2).
-- Новых таблиц не требует: данные лежат в js/abilities-data.js, билд живёт в ссылке.
-- Добавляет только сам пункт меню, чтобы его видимость по ролям настраивалась в
-- Админ-панели («Разделы и права»), как у остальных разделов.
-- До выполнения этого файла раздел всё равно виден всем (запасной путь в index.html).
-- Выполнить в Supabase Dashboard → SQL Editor.

insert into public.sections (key, label, sort)
values ('abilities', 'Таланты', 95)
on conflict (key) do nothing;

insert into public.role_sections (clan_id, role_id, section_key, visible)
select c.id, r.id, 'abilities', true
from public.clans c
cross join public.roles r
on conflict (clan_id, role_id, section_key) do nothing;
