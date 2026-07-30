-- L2 Clan Cabinet — «Журнал посещаемости»: тумблер тёмной раскраски таблицы «Посещаемость»
-- (по умолчанию таблица светлая, как в референсе; можно переключить на тёмную под сайт)
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_attendance_report_style.sql)

alter table public.attendance_report_style add column if not exists dark_matrix boolean not null default false;
