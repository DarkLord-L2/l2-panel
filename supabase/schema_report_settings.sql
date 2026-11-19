-- L2 Clan Cabinet — настройки «Отчётов по мероприятиям» (Админ-панель → «Отчёты по мероприятиям»).
-- include_left_all_time: false (по умолчанию) — при периоде «Всё время» правая панель отчёта («Общая статистика»,
-- «Лучшие за период», «По профессиям») считает только тех, кто сейчас в клане (по последней переписи).
-- true — как раньше: все, кто хоть раз был на мероприятиях, включая вышедших из клана.
-- Нет строки или таблицы — считается false. Таблица слева, неделя и мероприятие не меняются.
-- Выполнить в Supabase Dashboard → SQL Editor.

create table if not exists public.report_settings (
  clan_id uuid primary key references public.clans(id) on delete cascade,
  include_left_all_time boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.report_settings enable row level security;

-- читать — всем в клане
drop policy if exists "report_settings_select" on public.report_settings;
create policy "report_settings_select" on public.report_settings for select
  using (clan_id in (select clan_id from public.profiles where id = (select auth.uid())));

-- менять — только главный админ своего клана
drop policy if exists "report_settings_write_glavadmin" on public.report_settings;
create policy "report_settings_write_glavadmin" on public.report_settings for all
  using ((select public.is_glavadmin()) and clan_id in (select clan_id from public.profiles where id = (select auth.uid())))
  with check ((select public.is_glavadmin()) and clan_id in (select clan_id from public.profiles where id = (select auth.uid())));
