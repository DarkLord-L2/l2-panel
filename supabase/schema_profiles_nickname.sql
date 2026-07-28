-- L2 Clan Cabinet — привязка игрового ника к аккаунту
-- Логин для входа ограничен латиницей (он же часть псевдо-email для Supabase Auth),
-- а игровой ник у многих кириллицей — нужно отдельное поле без ограничений,
-- чисто для отображения/связи «этот аккаунт = этот персонаж».
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

alter table public.profiles add column if not exists nickname text;
