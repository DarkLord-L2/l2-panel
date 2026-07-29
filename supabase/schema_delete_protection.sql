-- L2 Clan Cabinet — защита аккаунта от удаления сид-фразой
-- Главный админ может защитить СВОЙ аккаунт кодовой фразой (проверяется только на
-- сервере, в edge-функции set-delete-protection) — после этого никто из других
-- главных админов клана не может его удалить через Админ-панель. Снять защиту
-- может только тот, кто знает вторую, отдельную фразу (edge-функция
-- remove-delete-protection) — она предназначена только для владельца сайта.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

alter table public.profiles add column if not exists delete_protected boolean not null default false;
