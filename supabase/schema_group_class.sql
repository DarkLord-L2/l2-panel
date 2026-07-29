-- L2 Clan Cabinet — «Группы»: «профессия» (иконка) группы для карточки в списке
-- Тот же список классов, что и у участников (js/classes.js) — выбирается через
-- пикер в деталях группы, показывается как аватарка карточки в «Все группы».
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_group_deputy.sql)

alter table public.clan_groups add column if not exists class_name text;
