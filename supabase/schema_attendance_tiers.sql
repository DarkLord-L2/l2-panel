-- L2 Clan Cabinet — «Посещаемость»: пороги тиров явки (%) настраиваются на клан
-- вместо захардкоженных 75/40 — первый шаг к «конструктору» для разных кланов.
-- Настраивается в Админ-панели → «Правила клана».
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_attendance_dark_matrix.sql)

alter table public.attendance_report_style add column if not exists tier_high_threshold int not null default 75;
alter table public.attendance_report_style add column if not exists tier_mid_threshold int not null default 40;
