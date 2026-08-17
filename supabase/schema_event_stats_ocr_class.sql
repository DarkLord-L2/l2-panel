-- L2 Clan Cabinet — «Отчёт по мероприятиям»: сохраняем распознанный ОСР-классом профессии
-- прямо на строке боевой статы (какой профессией игрок был именно на этом мероприятии),
-- и привязку строки к скрину (event_screenshot_batches), с которого она распознана.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_event_stats.sql,
-- schema_event_screenshot_batches.sql)

alter table public.event_stats add column if not exists class_name text;
alter table public.event_stats add column if not exists batch_id uuid references public.event_screenshot_batches(id) on delete set null;
create index if not exists event_stats_batch_idx on public.event_stats(batch_id);
