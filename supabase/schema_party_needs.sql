-- L2 Clan Cabinet — «Потребности»: кого не хватает в пати (группах) — доска добора.
-- Каждая строка — открытый слот группы: профа (или «любая из» нескольких), основа/запас, сколько нужно, заметка.
-- Видят все участники клана (чтобы новичку можно было сразу сказать, куда идти).
-- Менять могут админы клана и лидер/зам ИМЕННО ЭТОЙ группы — та же схема прав, что у заметок групп
-- (schema_group_notes.sql: profiles.party_id = группа и ник совпадает с leader_nickname / deputy_nickname).
-- party_needs_closed — история «нашли, взяли такого-то» (последние записи показываются в сводке).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_groups.sql, schema_group_leader.sql,
-- schema_group_deputy.sql, schema_owner_console.sql).

create table if not exists public.party_needs (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  group_id uuid not null references public.clan_groups(id) on delete cascade,
  cls text not null check (char_length(cls) between 1 and 40),
  alts text[] not null default '{}' check (coalesce(array_length(alts, 1), 0) <= 8),
  tier text not null default 'main' check (tier in ('main', 'res')),
  qty int not null default 1 check (qty between 1 and 9),
  note text not null default '' check (char_length(note) <= 60),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists party_needs_clan_idx on public.party_needs (clan_id);
create index if not exists party_needs_group_idx on public.party_needs (group_id);

create table if not exists public.party_needs_closed (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  group_id uuid references public.clan_groups(id) on delete cascade,
  cls text not null check (char_length(cls) between 1 and 40),
  title text not null default '' check (char_length(title) <= 120),
  nick text not null default '' check (char_length(nick) <= 32),
  closed_by uuid references auth.users(id) default auth.uid(),
  closed_at timestamptz not null default now()
);
create index if not exists party_needs_closed_clan_idx on public.party_needs_closed (clan_id, closed_at desc);

alter table public.party_needs enable row level security;
alter table public.party_needs_closed enable row level security;

-- может ли текущий пользователь менять потребности этой группы
create or replace function public.can_edit_party_needs(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (public.current_role_key() in ('glavadmin', 'admin')
      and exists (select 1 from public.clan_groups cg where cg.id = p_group and cg.clan_id = public.current_clan_id()))
    or exists (
      select 1
      from public.clan_groups cg
      join public.profiles p on p.id = auth.uid()
      where cg.id = p_group
        and cg.clan_id = public.current_clan_id()
        and cg.id = p.party_id
        and p.nickname is not null
        and (
          (cg.leader_nickname is not null and lower(btrim(cg.leader_nickname)) = lower(btrim(p.nickname)))
          or (cg.deputy_nickname is not null and lower(btrim(cg.deputy_nickname)) = lower(btrim(p.nickname)))
        )
    );
$$;
revoke all on function public.can_edit_party_needs(uuid) from public;
grant execute on function public.can_edit_party_needs(uuid) to authenticated;

drop policy if exists "party_needs_select" on public.party_needs;
create policy "party_needs_select" on public.party_needs for select
  using (clan_id = public.current_clan_id());

drop policy if exists "party_needs_write" on public.party_needs;
create policy "party_needs_write" on public.party_needs for all
  using (clan_id = public.current_clan_id() and public.can_edit_party_needs(group_id))
  with check (clan_id = public.current_clan_id() and public.can_edit_party_needs(group_id));

drop policy if exists "party_needs_closed_select" on public.party_needs_closed;
create policy "party_needs_closed_select" on public.party_needs_closed for select
  using (clan_id = public.current_clan_id());

drop policy if exists "party_needs_closed_insert" on public.party_needs_closed;
create policy "party_needs_closed_insert" on public.party_needs_closed for insert
  with check (clan_id = public.current_clan_id() and public.can_edit_party_needs(group_id));

drop policy if exists "party_needs_closed_delete" on public.party_needs_closed;
create policy "party_needs_closed_delete" on public.party_needs_closed for delete
  using (clan_id = public.current_clan_id() and public.current_role_key() in ('glavadmin', 'admin'));

-- раздел в меню: всем ролям всех кланов (видимость потом настраивается в Админ-панели)
insert into public.sections (key, label, sort)
values ('needs', 'Потребности', 6)
on conflict (key) do nothing;

insert into public.role_sections (clan_id, role_id, section_key, visible)
select c.id, r.id, 'needs', true
from public.clans c
cross join public.roles r
on conflict (clan_id, role_id, section_key) do nothing;
