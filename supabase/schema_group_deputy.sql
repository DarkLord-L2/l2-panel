-- L2 Clan Cabinet — «Группы»: зам пати лидера (второй ранг рядом с лидером пати)
-- Назначаются оба через меню «⋮» участника в «Группах» («Назначить…»).
-- Лидер — золотая корона на аватарке, зам — маленькая серая. Зам получает те же
-- права на просмотр личных кабинетов участников своей группы, что и лидер.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_group_leader.sql)

alter table public.clan_groups add column if not exists deputy_nickname text;
