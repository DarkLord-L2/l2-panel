-- L2 Clan Cabinet — «Участники клана»: доп. настраиваемый список (например «неактивные,
-- но в клане») — свой заголовок, можно скрыть вкладку целиком. Отдельно от clan_groups
-- (пати) и от профессий — это просто ручная пометка на нике, ставится/снимается прямо
-- в окне выбора класса на roster.html.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql, schema_platform_admin.sql)

create table if not exists public.roster_tag_settings (
  clan_id uuid primary key references public.clans(id) on delete cascade,
  label text not null default 'Отдельный список',
  enabled boolean not null default false
);

create table if not exists public.roster_tagged_members (
  clan_id uuid not null references public.clans(id) on delete cascade,
  nickname text not null,
  primary key (clan_id, nickname)
);

alter table public.roster_tag_settings enable row level security;
alter table public.roster_tagged_members enable row level security;

drop policy if exists "roster_tag_settings_select" on public.roster_tag_settings;
create policy "roster_tag_settings_select" on public.roster_tag_settings for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "roster_tag_settings_write_admins" on public.roster_tag_settings;
create policy "roster_tag_settings_write_admins" on public.roster_tag_settings for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

drop policy if exists "roster_tagged_members_select" on public.roster_tagged_members;
create policy "roster_tagged_members_select" on public.roster_tagged_members for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "roster_tagged_members_write_admins" on public.roster_tagged_members;
create policy "roster_tagged_members_write_admins" on public.roster_tagged_members for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
