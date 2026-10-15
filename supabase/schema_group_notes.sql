-- L2 Clan Cabinet — «Группы»: заметка у группы (правила, время сбора и т.п.).
-- Заметку видят и меняют только админы клана и лидер/зам ИМЕННО ЭТОЙ группы (profiles.party_id = группа и ник
-- совпадает с clan_groups.leader_nickname / deputy_nickname — та же схема прав, что в schema_gear_check_party_leader.sql).
-- Остальным участникам клана база заметку не отдаёт вообще (не просто скрывает в интерфейсе).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_groups.sql, schema_group_leader.sql)

create table if not exists public.clan_group_notes (
  group_id uuid primary key references public.clan_groups(id) on delete cascade,
  clan_id uuid not null references public.clans(id) on delete cascade,
  note text not null check (char_length(note) <= 600),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.clan_group_notes enable row level security;

drop policy if exists "clan_group_notes_select" on public.clan_group_notes;
create policy "clan_group_notes_select" on public.clan_group_notes for select
  using (
    (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
    or exists (
      select 1
      from public.clan_groups cg
      join public.profiles p on p.id = auth.uid()
      where cg.id = clan_group_notes.group_id
        and cg.id = p.party_id
        and p.nickname is not null
        and (
          (cg.leader_nickname is not null and lower(btrim(cg.leader_nickname)) = lower(btrim(p.nickname)))
          or (cg.deputy_nickname is not null and lower(btrim(cg.deputy_nickname)) = lower(btrim(p.nickname)))
        )
    )
  );

drop policy if exists "clan_group_notes_write" on public.clan_group_notes;
create policy "clan_group_notes_write" on public.clan_group_notes for all
  using (
    (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
    or exists (
      select 1
      from public.clan_groups cg
      join public.profiles p on p.id = auth.uid()
      where cg.id = clan_group_notes.group_id
        and cg.id = p.party_id
        and p.nickname is not null
        and (
          (cg.leader_nickname is not null and lower(btrim(cg.leader_nickname)) = lower(btrim(p.nickname)))
          or (cg.deputy_nickname is not null and lower(btrim(cg.deputy_nickname)) = lower(btrim(p.nickname)))
        )
    )
  )
  with check (
    (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
    or exists (
      select 1
      from public.clan_groups cg
      join public.profiles p on p.id = auth.uid()
      where cg.id = clan_group_notes.group_id
        and cg.id = p.party_id
        and p.nickname is not null
        and (
          (cg.leader_nickname is not null and lower(btrim(cg.leader_nickname)) = lower(btrim(p.nickname)))
          or (cg.deputy_nickname is not null and lower(btrim(cg.deputy_nickname)) = lower(btrim(p.nickname)))
        )
    )
  );
