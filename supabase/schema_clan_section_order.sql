-- L2 Clan Cabinet — свой порядок пунктов левого меню у каждого клана.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)
--
-- В таблице sections есть общий sort, но она одна на всю платформу: меняя его,
-- клан-лидер переставлял бы меню и остальным кланам. Поэтому порядок хранится
-- отдельно и по кланам, а sections.sort остаётся значением по умолчанию для
-- разделов, которые клан-лидер не трогал.

create table public.clan_section_order (
  clan_id uuid not null references public.clans(id) on delete cascade,
  section_key text not null references public.sections(key) on delete cascade,
  sort int not null,
  primary key (clan_id, section_key)
);

alter table public.clan_section_order enable row level security;

-- читать нужно всем в клане: по этому порядку рисуется навигация у любой роли
create policy "clan_section_order_select" on public.clan_section_order for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "clan_section_order_write_glavadmin" on public.clan_section_order for all
  using (
    public.is_glavadmin()
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.is_glavadmin()
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
