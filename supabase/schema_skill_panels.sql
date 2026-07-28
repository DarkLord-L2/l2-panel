-- L2 Clan Cabinet — «Панель скилов» становится личной у каждого аккаунта, а не общей
-- на весь клан. Раньше раскладка жила только в localStorage браузера — то есть
-- фактически одна и та же на любом устройстве/аккаунте в этом браузере, а
-- редактировать её (добавлять иконки) мог только один захардкоженный аккаунт.
-- Теперь у каждого своя строка, видит и пишет только свою.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

create table public.skill_panels (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.skill_panels enable row level security;

create policy "skill_panels_select_own" on public.skill_panels for select
  using (profile_id = auth.uid());
create policy "skill_panels_write_own" on public.skill_panels for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
