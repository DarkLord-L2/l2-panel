-- L2 Clan Cabinet — «Перепись клана»
-- Выполнить в Supabase Dashboard → SQL Editor (после того, как применён schema.sql)

create table public.census_entries (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  week_start date not null,        -- понедельник недели, к которой относится запись
  nickname text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index census_entries_week_idx on public.census_entries(clan_id, week_start);

alter table public.census_entries enable row level security;

-- читать могут все залогиненные из своего клана (нужно и для будущего отчёта по налогам)
create policy "census_select" on public.census_entries for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));

-- писать (загружать/удалять ники) — только главный админ и админ, только в своём клане
create policy "census_write_admins" on public.census_entries for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- регистрируем новый раздел сайта — дальше он появится в навигации и в матрице прав
-- сам по себе, без изменений в коде index.html/admin.html
insert into public.sections (key, label, sort) values ('census', 'Перепись клана', 15);

insert into public.role_sections (role_id, section_key, visible)
select id, 'census', true from public.roles;
