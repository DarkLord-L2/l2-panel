-- L2 Clan Cabinet — «Отчёты по мероприятиям»: мягкое удаление статистики
-- Когда админ убирает участника из явки в «Посещаемости», его строка в event_stats
-- больше не стирается — вместо этого помечается removed=true, чтобы килы/смерти не
-- терялись из истории, а в отчёте такая строка просто помечается и уходит в самый низ.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_event_stats.sql)

alter table public.event_stats add column if not exists removed boolean not null default false;
