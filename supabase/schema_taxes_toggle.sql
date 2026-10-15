-- L2 Clan Cabinet — выключатель налогов клана.
-- Выключено (taxes_enabled = false): везде, где показываются налоги (раздел «Налоги», фильтры «Платил» в «Посещаемости»,
-- колонка «Налог» в «Группах», налоги в «Моём кабинете», график сбора в «Динамике»), пишется «выключен» или налогов нет.
-- Данные об оплатах не удаляются — после включения всё возвращается как было.
-- Переключатель: Админ-панель → «Правила клана» → «Налоги».
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_tax_settings.sql)

alter table public.tax_settings add column if not exists taxes_enabled boolean not null default true;
