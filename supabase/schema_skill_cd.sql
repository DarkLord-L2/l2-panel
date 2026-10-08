-- L2 Clan Cabinet — «КД скилов»: клан-лидер заводит список скилов (с картинками), лидеры
-- пати отмечают, какие скилы у их пати сейчас есть/готовы, клан-лидер видит это в реальном
-- времени. Пати берутся из уже существующих clan_groups (раздел «Группы»), лидер пати —
-- clan_groups.leader_nickname (та же схема прав, что в «Проверке буста»).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql, schema_group_leader.sql,
-- schema_platform_admin.sql).

-- ---------- 1. раздел в меню ----------
insert into public.sections (key, label, sort)
values ('skill_cd', 'КД скилов', 62)
on conflict (key) do nothing;

insert into public.role_sections (clan_id, role_id, section_key, visible)
select c.id, r.id, 'skill_cd', true
from public.clans c
cross join public.roles r
on conflict (clan_id, role_id, section_key) do nothing;

-- ---------- 2. скилы (столбцы таблицы) ----------
create table if not exists public.cd_skills (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  name text not null,
  icon text,                       -- data-URL картинки (необязательно), уменьшенная на клиенте
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists cd_skills_clan_idx on public.cd_skills(clan_id);

-- ---------- 3. отметки «скил есть» по пати ----------
create table if not exists public.cd_marks (
  clan_id uuid not null references public.clans(id) on delete cascade,
  group_id uuid not null references public.clan_groups(id) on delete cascade,
  skill_id uuid not null references public.cd_skills(id) on delete cascade,
  has boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (group_id, skill_id)
);
create index if not exists cd_marks_clan_idx on public.cd_marks(clan_id);

alter table public.cd_skills enable row level security;
alter table public.cd_marks enable row level security;

-- читают все залогиненные своего клана
drop policy if exists "cd_skills_select" on public.cd_skills;
create policy "cd_skills_select" on public.cd_skills for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "cd_skills_write_admins" on public.cd_skills;
create policy "cd_skills_write_admins" on public.cd_skills for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

drop policy if exists "cd_marks_select" on public.cd_marks;
create policy "cd_marks_select" on public.cd_marks for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "cd_marks_write_admins" on public.cd_marks;
create policy "cd_marks_write_admins" on public.cd_marks for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- лидер пати отмечает только свою пати: profiles.party_id = эта группа и ник совпадает
-- с clan_groups.leader_nickname
drop policy if exists "cd_marks_write_party_leader" on public.cd_marks;
create policy "cd_marks_write_party_leader" on public.cd_marks for all
  using (
    clan_id = public.current_clan_id()
    and exists (
      select 1
      from public.clan_groups cg
      join public.profiles p on p.id = auth.uid()
      where cg.id = cd_marks.group_id
        and cg.id = p.party_id
        and cg.leader_nickname is not null
        and lower(btrim(cg.leader_nickname)) = lower(btrim(p.nickname))
    )
  )
  with check (
    clan_id = public.current_clan_id()
    and exists (
      select 1
      from public.clan_groups cg
      join public.profiles p on p.id = auth.uid()
      where cg.id = cd_marks.group_id
        and cg.id = p.party_id
        and cg.leader_nickname is not null
        and lower(btrim(cg.leader_nickname)) = lower(btrim(p.nickname))
    )
  );

-- ---------- 4. realtime: изменения прилетают на экран клан-лидера без обновления страницы ----------
do $$
begin
  begin
    alter publication supabase_realtime add table public.cd_marks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.cd_skills;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------- 5. какие пати показывать в таблице «КД скилов» (настраивает клан-лидер) ----------
-- Выключенная пати пропадает из таблицы у всех (и из окошка), отметки по ней сохраняются.
alter table public.clan_groups add column if not exists cd_enabled boolean not null default true;
