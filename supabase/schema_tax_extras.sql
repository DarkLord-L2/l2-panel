-- L2 Clan Cabinet — «Налоги»: тип отметки оплаты (наперёд/долг) + отдельный учёт донатов
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_taxes.sql)

-- 'normal' — обычная оплата за саму эту неделю (список/OCR/вручную в ростере недели),
-- 'ahead'  — проставлена через «Заплатил наперёд» (ложится на будущие недели),
-- 'debt'   — проставлена через «Погасил долг» (ложится на прошлые недели).
-- Нужно, чтобы в списке недели красить ник в зелёный (наперёд) / оранжевый (долг).
alter table public.tax_payments add column if not exists kind text not null default 'normal';

create table public.tax_donations (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  nickname text not null,
  amount numeric not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.tax_donations enable row level security;

create policy "tax_donations_select" on public.tax_donations for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));

create policy "tax_donations_write_admins" on public.tax_donations for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
