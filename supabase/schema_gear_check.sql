-- L2 Clan Cabinet — «Проверка буста»: конструктор разделов/пунктов + значения по участникам
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql, schema_census.sql)
--
-- Раздел 'gear_check' уже создан в sections/role_sections (сид в schema.sql),
-- поэтому новых строк туда не нужно — index.html просто перестанет показывать заглушку.

create table public.boost_sections (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.boost_items (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  section_id uuid not null references public.boost_sections(id) on delete cascade,
  name text not null,
  icon text,                       -- data-URL картинки (необязательно), уменьшенная на клиенте
  weight numeric not null default 1,
  sort_order int not null default 0
);
create index boost_items_section_idx on public.boost_items(section_id);

create table public.boost_member_values (
  clan_id uuid not null references public.clans(id) on delete cascade,
  nickname text not null,
  item_id uuid not null references public.boost_items(id) on delete cascade,
  enabled boolean not null default false,
  primary key (nickname, item_id)
);
create index boost_member_values_item_idx on public.boost_member_values(item_id);

alter table public.boost_sections enable row level security;
alter table public.boost_items enable row level security;
alter table public.boost_member_values enable row level security;

-- читают все залогиненные своего клана, пишут только glavadmin/admin
create policy "boost_sections_select" on public.boost_sections for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "boost_sections_write_admins" on public.boost_sections for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

create policy "boost_items_select" on public.boost_items for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "boost_items_write_admins" on public.boost_items for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

create policy "boost_member_values_select" on public.boost_member_values for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "boost_member_values_write_admins" on public.boost_member_values for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
