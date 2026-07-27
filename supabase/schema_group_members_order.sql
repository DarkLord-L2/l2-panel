-- L2 Clan Cabinet — «Группы»: ручной порядок участников внутри группы
-- (перетаскивание иконок местами в UI). Выполнить в Supabase Dashboard →
-- SQL Editor (после schema_groups.sql)

alter table public.clan_group_members add column if not exists sort_order int not null default 0;
