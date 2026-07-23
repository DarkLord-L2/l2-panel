-- L2 Clan Cabinet — «Группы»: расстановка ников клана по группам/пати для ивентов
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)
--
-- Отдельная сущность от public.parties (та — служебная привязка залогиненных
-- аккаунтов для RBAC, тут — просто список ников из переписи, сгруппированных
-- по названным группам; ников без аккаунта на сайте абсолютное большинство).

create table public.clan_groups (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.clan_group_members (
  group_id uuid not null references public.clan_groups(id) on delete cascade,
  nickname text not null,
  added_at timestamptz not null default now(),
  primary key (group_id, nickname)
);

alter table public.clan_groups enable row level security;
alter table public.clan_group_members enable row level security;

create policy "clan_groups_select" on public.clan_groups for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "clan_groups_write_admins" on public.clan_groups for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

create policy "clan_group_members_select" on public.clan_group_members for select
  using (
    group_id in (
      select id from public.clan_groups
      where clan_id in (select clan_id from public.profiles where id = auth.uid())
    )
  );
create policy "clan_group_members_write_admins" on public.clan_group_members for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and group_id in (
      select id from public.clan_groups
      where clan_id in (select clan_id from public.profiles where id = auth.uid())
    )
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and group_id in (
      select id from public.clan_groups
      where clan_id in (select clan_id from public.profiles where id = auth.uid())
    )
  );

insert into public.sections (key, label, sort) values ('groups', 'Группы', 5);
insert into public.role_sections (role_id, section_key, visible)
select id, 'groups', true from public.roles;
