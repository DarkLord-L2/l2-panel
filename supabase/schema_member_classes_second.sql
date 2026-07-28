-- L2 Clan Cabinet — вторая профессия участника (дуал-класс)
-- Основной класс остаётся в class_name (и определяет иконку по умолчанию),
-- вторая профессия — в class_name_2, показывается маленьким кружком поверх
-- аватарки в «Группах».
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

alter table public.member_classes add column if not exists class_name_2 text;
