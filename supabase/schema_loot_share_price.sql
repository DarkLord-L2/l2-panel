-- L2 Clan Cabinet — «Цена доли»: сколько голды стоит одна доля («Финальные баллы»)
-- в «ДКП Соло»/«ДКП Пати» и в «Раздаче». Настраивается в Админ-панели → «Правила
-- клана». По умолчанию 0 — до первой настройки голда всюду считается нулевой,
-- ничего не ломается для уже существующих кланов.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_loot_split_settings.sql)

alter table public.loot_split_settings
  add column if not exists loot_share_price numeric not null default 0;
