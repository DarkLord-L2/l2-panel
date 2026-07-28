-- L2 Clan Cabinet — «Группы»: скрытие вместо мгновенного удаления
-- Скрытая группа пропадает из общего списка и из фильтров «Пати» на других
-- страницах, но данные (участники, привязанные пати аккаунтов) не теряются.
-- Удалить группу навсегда теперь можно только из списка «Скрытые группы»,
-- вписав точное название для подтверждения.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_groups.sql)

alter table public.clan_groups add column if not exists hidden boolean not null default false;
