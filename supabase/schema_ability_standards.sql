-- L2 Clan Cabinet — «Таланты»: стандартные билды клана.
-- Клан-лидер и админ сохраняют собранный билд как «стандарт» для класса — до 3 на класс, у каждого своё название.
-- Остальные видят кнопку «Посмотреть стандарт» и могут открыть любой из них.
-- code — тот же короткий код билда, что в ссылке (?b=…), 36 символов.
-- Выполнить в Supabase Dashboard → SQL Editor. Повторный запуск безопасен.

create table if not exists public.ability_standards (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  class_slug text not null,                       -- например 'duelist-88'
  slot int not null check (slot between 1 and 3), -- до трёх стандартов на класс
  name text not null check (char_length(name) between 1 and 40),
  code text not null check (char_length(code) between 1 and 80),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (clan_id, class_slug, slot)
);

alter table public.ability_standards enable row level security;

-- читать — любой участник клана
drop policy if exists "ability_standards_select" on public.ability_standards;
create policy "ability_standards_select" on public.ability_standards for select
  using (clan_id = (select public.current_clan_id()));

-- писать — только клан-лидер и админ своего клана
drop policy if exists "ability_standards_write_admins" on public.ability_standards;
create policy "ability_standards_write_admins" on public.ability_standards for all
  using ((select public.current_role_key()) in ('glavadmin', 'admin') and clan_id = (select public.current_clan_id()))
  with check ((select public.current_role_key()) in ('glavadmin', 'admin') and clan_id = (select public.current_clan_id()));
