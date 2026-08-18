-- L2 Clan Cabinet — защита аккаунта от удаления СВОИМ паролем (а не общей сид-фразой
-- на всех). Каждый главный админ ставит защиту сам себе любой фразой по вкусу — она
-- хешируется на сервере (edge-функция set-delete-protection) и никогда не попадает
-- в открытом виде ни в базу, ни в код сайта. Снять защиту/удалить защищённого может
-- либо тот, кто знает именно эту фразу, либо владелец сайта отдельной сид-фразой
-- (секрет DELETE_PROTECTION_SEED_PHRASE в Supabase → Edge Functions → Secrets) —
-- она работает как мастер-ключ поверх ЛЮБОГО чужого пароля защиты.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql, schema_delete_protection.sql)

alter table public.profiles add column if not exists delete_protection_hash text;
alter table public.profiles add column if not exists delete_protection_salt text;
