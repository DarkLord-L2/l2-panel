-- L2 Clan Cabinet — «Лидерборд»: топы игроков и пати по килам/K:D/PvP/PvE/
-- посещениям. Новых таблиц не требует — читает event_stats, attendance_events,
-- группы и профессии. Добавляет только сам пункт меню, чтобы его видимость по
-- ролям настраивалась в Админ-панели («Разделы и права»), как у остальных.
-- До выполнения этого файла раздел всё равно виден тем, кому открыты «Отчёты».
-- Выполнить в Supabase Dashboard → SQL Editor.

insert into public.sections (key, label, sort)
values ('leaderboard', 'Лидерборд', 45)
on conflict (key) do nothing;

insert into public.role_sections (clan_id, role_id, section_key, visible)
select c.id, r.id, 'leaderboard', true
from public.clans c
cross join public.roles r
on conflict (clan_id, role_id, section_key) do nothing;
