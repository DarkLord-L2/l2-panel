-- L2 Clan Cabinet — «Раздача»: показывать ли под ником строку «ещё у: …» (у каких других лидеров
-- человек ещё был за период). Настройка клана: Админ-панель → «ДКП». По умолчанию включено.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_loot_split.sql)

alter table public.loot_split_settings add column if not exists payout_show_else boolean not null default true;
