-- L2 Clan Cabinet — «Группы»: лидер пати
-- Админ назначает лидера группы (по нику из участников группы). Лидер пати —
-- наравне с клан-лидером и замом (glavadmin/admin) — может открыть личный
-- кабинет участников своей группы из меню «⋮» в «Группах».
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_groups.sql)

alter table public.clan_groups add column if not exists leader_nickname text;
