-- L2 Clan Cabinet — «Раздача»: общая на весь клан «активная раздача», а не
-- личная память в sessionStorage браузера того, кто нажал «Разделить дроп».
-- Раньше данные (период + голда по никам) клались в sessionStorage — это
-- ЛОКАЛЬНОЕ хранилище конкретного браузера, соседний пати-лидер на своём
-- устройстве их просто не видел. Теперь «Раздать» в «ДКП Соло»/«ДКП Пати»
-- (только glavadmin/admin) пишет сюда одну строку на клан — читают её уже
-- ВСЕ участники клана, каждый видит свою часть (см. loot-payout.html).
-- clan_id — primary key: новая раздача просто перезаписывает предыдущую,
-- отдельной истории не храним. «Висит» 24 часа — это проверяется на фронте
-- по created_at, отдельного удаления по расписанию не нужно; раньше или
-- вместо истечения клан-лидер может удалить строку вручную.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

create table if not exists public.payout_batches (
  clan_id uuid primary key references public.clans(id) on delete cascade,
  from_date date,
  to_date date,
  gold_by_nick jsonb not null,
  source text not null,             -- 'solo' | 'party' — для справки, на логику не влияет
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.payout_batches enable row level security;

drop policy if exists "payout_batches_select" on public.payout_batches;
create policy "payout_batches_select" on public.payout_batches for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "payout_batches_write_admins" on public.payout_batches;
create policy "payout_batches_write_admins" on public.payout_batches for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
