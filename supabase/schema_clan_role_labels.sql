-- L2 Clan Cabinet — «Названия ролей»: своё название роли для конкретного клана,
-- не меняя саму роль (права/ранг остаются теми же — 'glavadmin'/'admin'/'sredniy'/
-- 'obychniy'). public.roles — ОБЩАЯ таблица на всю платформу (используется всеми
-- кланами), поэтому переименовывать сам roles.label нельзя — это переименовало бы
-- роль сразу у всех кланов. Тут — только своя, per-клан надстройка: есть строка —
-- используется её label вместо стандартного перевода/названия, нет строки —
-- показывается название по умолчанию как раньше.
-- Настраивается в Админ-панели → «Пользователи» (доступно только glavadmin).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

create table if not exists public.clan_role_labels (
  clan_id uuid not null references public.clans(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  label text not null,
  primary key (clan_id, role_id)
);

alter table public.clan_role_labels enable row level security;

drop policy if exists "clan_role_labels_select" on public.clan_role_labels;
create policy "clan_role_labels_select" on public.clan_role_labels for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "clan_role_labels_write_glavadmin" on public.clan_role_labels;
create policy "clan_role_labels_write_glavadmin" on public.clan_role_labels for all
  using (
    public.current_role_key() = 'glavadmin'
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() = 'glavadmin'
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
