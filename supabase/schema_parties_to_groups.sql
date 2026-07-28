-- L2 Clan Cabinet — объединяем «пати аккаунта» (public.parties, служебная привязка для
-- RBAC, по факту нигде не использовалась для ограничения видимости) с уже живым
-- «Группы»/public.clan_groups (то, что видно в разделе «Группы» и в фильтрах
-- посещаемости/налогов/отчётов/буста). Теперь у аккаунта в profiles.party_id стоит
-- id именно из clan_groups — один список групп везде, без дублей и мусорных тестовых
-- записей ("123", "y23y23y" и т.п. из старой public.parties).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_groups.sql)

-- старые значения party_id ссылались на записи public.parties, которые сейчас удаляем —
-- обнуляем, чтобы никто не остался привязан к мусору
update public.profiles set party_id = null;

alter table public.profiles drop constraint if exists profiles_party_id_fkey;
alter table public.profiles
  add constraint profiles_party_id_fkey
  foreign key (party_id) references public.clan_groups(id) on delete set null;

drop table if exists public.parties cascade;
