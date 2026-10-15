-- L2 Clan Cabinet — «Группы»: дополнительные блоки участников внутри группы («+» в ряду «Ячейки страницы»).
-- Блок — это второй/третий список «Участники» со своим названием (например «Арбы», «Саппорты»). Люди в блоке остаются
-- участниками той же группы (видны в «Проверке пати», в полоске профессий и везде, где группа); блок лишь раскладывает их
-- по отдельным ячейкам. Участник без блока лежит в основном блоке «Участники», как раньше.
-- Если блок удалить — его люди возвращаются в основной блок (section_id → null), из группы они не пропадают.
-- Создавать/переименовывать/удалять блоки и переносить в них людей могут только админы клана (как и сам состав групп).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_groups.sql, schema_platform_admin.sql). Можно запускать повторно.

create table if not exists public.clan_group_sections (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.clan_groups(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.clan_group_sections enable row level security;

drop policy if exists "clan_group_sections_select" on public.clan_group_sections;
create policy "clan_group_sections_select" on public.clan_group_sections for select
  using (group_id in (select id from public.clan_groups where clan_id = public.current_clan_id()));

drop policy if exists "clan_group_sections_write_admins" on public.clan_group_sections;
create policy "clan_group_sections_write_admins" on public.clan_group_sections for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and group_id in (select id from public.clan_groups where clan_id = public.current_clan_id())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and group_id in (select id from public.clan_groups where clan_id = public.current_clan_id())
  );

-- в какой блок входит участник (null — основной блок «Участники»)
alter table public.clan_group_members
  add column if not exists section_id uuid references public.clan_group_sections(id) on delete set null;
