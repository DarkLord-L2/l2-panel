-- L2 Clan Cabinet — «Раздача»: архив прошлых делёжек. Заполняется только вручную,
-- кнопкой «Занести в архив» на странице «Раздача» (клан-лидер/админ) — ничего не
-- пишется сюда автоматически при каждом «Раздать», чтобы тестовые/случайные
-- разделения дропа туда не попадали. data — снимок «кто кому раздавал и сколько
-- получил» на момент архивации (полностью, включая ушедших из клана — фильтр
-- «показывать ушедших» в «Раздаче» на архив не влияет, это отдельная витрина).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_payout_batches.sql)

create table public.payout_archive (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  from_date date,
  to_date date,
  split_date timestamptz not null,   -- когда фактически была раздача (created_at исходной payout_batches)
  source text,                       -- "solo" | "party" — каким расчётом считали
  archived_by uuid references auth.users(id),
  archived_at timestamptz not null default now(),
  data jsonb not null                -- [{ leader, leaderGold, partyCount, members: [{nickname, gold, count, left}] }, ...]
);
create index payout_archive_clan_idx on public.payout_archive(clan_id, split_date desc);

alter table public.payout_archive enable row level security;

create policy "payout_archive_select" on public.payout_archive for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "payout_archive_write_admins" on public.payout_archive for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
