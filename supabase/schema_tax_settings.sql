-- L2 Clan Cabinet — «Налоги»: сумма недельного налога с человека. Кто платил —
-- по-прежнему просто список ников в tax_payments, эта таблица добавляет только
-- множитель, чтобы окошко «Итого за неделю» на taxes.html могло посчитать
-- «Налог: число заплативших × сумма» + «Донат» = общая голда за неделю.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

create table if not exists public.tax_settings (
  clan_id uuid primary key references public.clans(id) on delete cascade,
  weekly_tax_amount numeric not null default 0
);

alter table public.tax_settings enable row level security;

drop policy if exists "tax_settings_select" on public.tax_settings;
create policy "tax_settings_select" on public.tax_settings for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "tax_settings_write_admins" on public.tax_settings;
create policy "tax_settings_write_admins" on public.tax_settings for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- сид: дефолт 0 для уже существующих кланов, дальше правится в Админ-панели
insert into public.tax_settings (clan_id, weekly_tax_amount)
select id, 0 from public.clans
on conflict do nothing;
