-- L2 Clan Cabinet — фаза 1: логин, роли, права доступа
-- Выполнить целиком в Supabase Dashboard → SQL Editor (один раз, на пустой базе)

create extension if not exists "pgcrypto";

-- ---------- таблицы ----------

create table public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,   -- 'glavadmin' | 'admin' | 'sredniy' | 'obychniy'
  label text not null,
  rank int not null           -- больше = выше прав
);

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  name text not null,
  lead_user_id uuid references auth.users(id) on delete set null
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  clan_id uuid not null references public.clans(id),
  role_id uuid not null references public.roles(id),
  party_id uuid references public.parties(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.sections (
  key text primary key,       -- 'skill_panel' | 'attendance' | 'taxes' | 'reports' | 'gear_check' | 'admin'
  label text not null,
  sort int not null default 0
);

create table public.role_sections (
  role_id uuid not null references public.roles(id) on delete cascade,
  section_key text not null references public.sections(key) on delete cascade,
  visible boolean not null default true,
  primary key (role_id, section_key)
);

-- ---------- вспомогательные функции (security definer — читают profiles/roles в обход RLS,
-- иначе политики profiles ссылались бы сами на себя рекурсивно) ----------

create or replace function public.current_role_key()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select r.key from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid()
$$;

create or replace function public.is_glavadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_role_key() = 'glavadmin', false)
$$;

-- ---------- RLS ----------

alter table public.clans enable row level security;
alter table public.roles enable row level security;
alter table public.parties enable row level security;
alter table public.profiles enable row level security;
alter table public.sections enable row level security;
alter table public.role_sections enable row level security;

-- clans: залогиненный видит свой клан; менять может только главный админ
create policy "clans_select" on public.clans for select
  using (id in (select clan_id from public.profiles where id = auth.uid()) or public.is_glavadmin());
create policy "clans_write_glavadmin" on public.clans for all
  using (public.is_glavadmin()) with check (public.is_glavadmin());

-- roles / sections / role_sections: читать может любой залогиненный (нужно для рендера навигации),
-- писать (в т.ч. включать/выключать разделы для ролей) — только главный админ
create policy "roles_select" on public.roles for select using (auth.uid() is not null);
create policy "roles_write_glavadmin" on public.roles for all
  using (public.is_glavadmin()) with check (public.is_glavadmin());

create policy "sections_select" on public.sections for select using (auth.uid() is not null);
create policy "sections_write_glavadmin" on public.sections for all
  using (public.is_glavadmin()) with check (public.is_glavadmin());

create policy "role_sections_select" on public.role_sections for select using (auth.uid() is not null);
create policy "role_sections_write_glavadmin" on public.role_sections for all
  using (public.is_glavadmin()) with check (public.is_glavadmin());

-- parties: видят все залогиненные своего клана.
-- Более тонкая видимость (зам клана — все пати, саппортиец — только своя) —
-- предметный вопрос будущего раздела «Журнал посещаемости», не этой фазы.
create policy "parties_select" on public.parties for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()) or public.is_glavadmin());
create policy "parties_write_glavadmin" on public.parties for all
  using (public.is_glavadmin()) with check (public.is_glavadmin());

-- profiles: каждый читает только свою запись; главный админ читает и пишет все.
-- Самостоятельное изменение своей роли/пати намеренно не разрешено —
-- это исключает эскалацию прав через прямой запрос к базе.
create policy "profiles_select_self" on public.profiles for select
  using (id = auth.uid());
create policy "profiles_select_glavadmin" on public.profiles for select
  using (public.is_glavadmin());
create policy "profiles_write_glavadmin" on public.profiles for all
  using (public.is_glavadmin()) with check (public.is_glavadmin());

-- ---------- сиды: клан, роли, разделы, права по умолчанию ----------

do $$
declare
  v_clan_id uuid;
begin
  insert into public.clans (name) values ('Мой клан') returning id into v_clan_id;

  insert into public.roles (key, label, rank) values
    ('glavadmin', 'Главный админ', 100),
    ('admin', 'Админ', 75),
    ('sredniy', 'Средний', 50),
    ('obychniy', 'Обычный', 10);

  insert into public.sections (key, label, sort) values
    ('skill_panel', 'Панель скилов', 10),
    ('attendance', 'Журнал посещаемости', 20),
    ('taxes', 'Налоги', 30),
    ('reports', 'Отчёты по мероприятиям', 40),
    ('gear_check', 'Проверка буста', 50),
    ('admin', 'Админ-панель', 100);

  -- по умолчанию всем ролям видны все разделы, кроме админ-панели — она только у главного админа.
  -- главный админ потом сможет поменять это в admin.html, не трогая код.
  insert into public.role_sections (role_id, section_key, visible)
  select r.id, s.key, true
  from public.roles r cross join public.sections s
  where not (s.key = 'admin' and r.key <> 'glavadmin');
end $$;

-- ---------- первый главный админ (сделать вручную, после этого файла) ----------
--
-- 1. В Dashboard → Authentication → Users → Add user создайте пользователя:
--    email:    <ваш_логин>@l2clan.local   (например darklord@l2clan.local)
--    password: <пароль, который сами придумаете>
-- 2. Скопируйте его UID (виден в списке пользователей) и выполните:
--
-- insert into public.profiles (id, username, clan_id, role_id, party_id, created_by)
-- values (
--   '<UID пользователя из шага 1>',
--   'МрачныйЛорд',
--   (select id from public.clans limit 1),
--   (select id from public.roles where key = 'glavadmin'),
--   null,
--   null
-- );
