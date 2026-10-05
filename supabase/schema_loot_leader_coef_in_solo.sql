-- L2 Clan Cabinet — галочка «коэффициент пати-лидера работает и в ДКП Соло».
-- Выключена по умолчанию (как было раньше: в «ДКП Соло» все считаются по
-- коэффициенту профессии). Включена — у текущих пати-лидеров (Группы → лидер)
-- в «ДКП Соло» коэффициент лидера ЗАМЕНЯЕТ коэффициент профессии.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_loot_split_settings.sql)

alter table public.loot_split_settings
  add column if not exists leader_coef_in_solo boolean not null default false;
