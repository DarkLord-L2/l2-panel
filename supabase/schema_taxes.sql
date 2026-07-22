-- L2 Clan Cabinet — «Налоги»
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql и schema_census.sql)

create table public.tax_payments (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  week_start date not null,        -- понедельник недели
  nickname text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index tax_payments_week_idx on public.tax_payments(clan_id, week_start);

create table public.tax_archived_weeks (
  clan_id uuid not null references public.clans(id) on delete cascade,
  week_start date not null,
  primary key (clan_id, week_start)
);

alter table public.tax_payments enable row level security;
alter table public.tax_archived_weeks enable row level security;

create policy "tax_payments_select" on public.tax_payments for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "tax_payments_write_admins" on public.tax_payments for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

create policy "tax_archived_select" on public.tax_archived_weeks for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "tax_archived_write_admins" on public.tax_archived_weeks for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- раздел 'taxes' уже создан и виден всем ролям (сид в schema.sql) — новых строк в
-- sections/role_sections не нужно, index.html просто перестанет показывать заглушку.
