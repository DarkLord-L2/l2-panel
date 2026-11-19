-- L2 Clan Cabinet — «Журнал посещаемости»: штриховать дни до вступления человека в клан.
-- Настраивается в Админ-панели → «Журнал посещаемости» (ползунок).
-- true (по умолчанию) — в таблице «Посещаемость» клетки за дни, когда человека ещё не было в клане,
-- серые в штрих, а «Итого» и «%» считаются только по мероприятиям с его вступления.
-- false — как раньше: все клетки обычные, «Итого» и «%» по всем мероприятиям периода.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_attendance_report_style.sql).

alter table public.attendance_report_style add column if not exists mark_before_join boolean not null default true;
