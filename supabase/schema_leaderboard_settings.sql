-- L2 Clan Cabinet — настройки «Лидерборда» (Админ-панель → «Разделы и права»).
-- full_for_all: false (по умолчанию) — как раньше: обычный участник с назначенной пати
-- видит в лидерборде только свою пати (то же правило, что в «Отчётах»);
-- true — любая роль видит лидерборд целиком: всех игроков и все пати клана.
-- Нет строки или таблицы — считается false (поведение не меняется).
-- Выполнить в Supabase Dashboard → SQL Editor.

create table if not exists public.leaderboard_settings (
  clan_id uuid primary key references public.clans(id) on delete cascade,
  full_for_all boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.leaderboard_settings enable row level security;

-- читать — всем в клане (по флагу лидерборд решает, что показать)
drop policy if exists "leaderboard_settings_select" on public.leaderboard_settings;
create policy "leaderboard_settings_select" on public.leaderboard_settings for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));

-- менять — только главный админ своего клана
drop policy if exists "leaderboard_settings_write_glavadmin" on public.leaderboard_settings;
create policy "leaderboard_settings_write_glavadmin" on public.leaderboard_settings for all
  using (public.is_glavadmin() and clan_id in (select clan_id from public.profiles where id = auth.uid()))
  with check (public.is_glavadmin() and clan_id in (select clan_id from public.profiles where id = auth.uid()));
