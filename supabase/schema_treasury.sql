-- L2 Clan Cabinet — «Казна КЛа»: закрытый учёт казны клан-лидера (приход, расход, резервы, лента операций).
--
-- Кто видит:
--   * клан-лидер — аккаунт с ролью glavadmin, чей логин записан в clans.leader_username
--     (если такого нет — самый первый созданный glavadmin клана; так же лидера ищет owner-enter-clan);
--   * те, кому лидер САМ выдал доступ на странице казны (treasury_access): «смотреть» или «смотреть и вносить».
--   Остальные — включая админов, замов и других главных админов — ни строки не прочитают: правила доступа в базе,
--   не только в меню. Раздела НЕТ в sections/role_sections: в Админ-панели он не настраивается и в меню остальных
--   не появляется; пункт меню оболочка добавляет только тем, кому treasury_my_access() что-то вернула.
--   Вход владельца платформы «Войти в клан» (одноразовая ссылка, amr = otp/magiclink) казну тоже не видит.
--
-- Суммы — bigint (до миллиардов), у каждой записи валюта: адена или голда. Итоги считает страница по ленте, по каждой валюте отдельно:
--   Всего = приходы − расходы − расходы из резерва;  В резерве = заморозки − возвраты − расходы из резерва;
--   Свободно = Всего − В резерве.
-- Выполнить в Supabase Dashboard → SQL Editor. Повторный запуск безопасен.

create table if not exists public.treasury_ops (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  -- in = приход, out = расход, freeze = заморозка (резерв), unfreeze = возврат из резерва в свободные,
  -- spend = расход из резерва (потратил по назначению)
  kind text not null check (kind in ('in', 'out', 'freeze', 'unfreeze', 'spend')),
  amount bigint not null check (amount > 0 and amount <= 1000000000000000),
  -- валюта: адена или голда — итоги и резервы считаются по каждой отдельно
  currency text not null default 'adena', -- проверка adena/gold — ниже (treasury_ops_currency_ck)
  note text not null default '' check (char_length(note) <= 200),
  -- для unfreeze/spend — из какого резерва (строка freeze); удалили резерв — удаляются и его списания
  reserve_id uuid references public.treasury_ops(id) on delete cascade,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_ops_reserve_ck check ((kind in ('unfreeze', 'spend')) = (reserve_id is not null))
);
-- если таблица уже была создана первой версией этого файла (без валюты)
alter table public.treasury_ops add column if not exists currency text not null default 'adena';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'treasury_ops_currency_ck') then
    alter table public.treasury_ops add constraint treasury_ops_currency_ck check (currency in ('adena', 'gold'));
  end if;
end $$;
create index if not exists treasury_ops_clan_idx on public.treasury_ops (clan_id, created_at desc);
create index if not exists treasury_ops_reserve_idx on public.treasury_ops (reserve_id);

create table if not exists public.treasury_access (
  clan_id uuid not null references public.clans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  can_edit boolean not null default false,
  granted_by uuid references auth.users(id) default auth.uid(),
  granted_at timestamptz not null default now(),
  primary key (clan_id, user_id)
);

alter table public.treasury_ops enable row level security;
alter table public.treasury_access enable row level security;

-- сессия обычная (по паролю), а не вход владельца платформы по одноразовой ссылке
create or replace function public.treasury_session_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then not exists (
      select 1 from jsonb_array_elements(auth.jwt() -> 'amr') e
      where e ->> 'method' in ('otp', 'magiclink')
    )
    else true
  end
$$;

-- текущий пользователь — клан-лидер своего клана
create or replace function public.treasury_is_leader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.treasury_session_ok() and coalesce((
    select l.id = auth.uid()
    from (
      select p.id
      from public.profiles p
      join public.roles r on r.id = p.role_id
      join public.clans c on c.id = p.clan_id
      where p.clan_id = public.current_clan_id()
        and r.key = 'glavadmin'
      order by (lower(p.username) = lower(coalesce(c.leader_username, ''))) desc, p.created_at, p.id
      limit 1
    ) l
  ), false)
$$;

-- 'leader' | 'edit' | 'view' | null — что текущему пользователю можно в казне
create or replace function public.treasury_my_access()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_clan_id() is null or not public.treasury_session_ok() then null
    when public.treasury_is_leader() then 'leader'
    else (
      select case when a.can_edit then 'edit' else 'view' end
      from public.treasury_access a
      where a.clan_id = public.current_clan_id() and a.user_id = auth.uid()
    )
  end
$$;

revoke all on function public.treasury_session_ok() from public;
revoke all on function public.treasury_is_leader() from public;
revoke all on function public.treasury_my_access() from public;
grant execute on function public.treasury_session_ok() to authenticated;
grant execute on function public.treasury_is_leader() to authenticated;
grant execute on function public.treasury_my_access() to authenticated;

-- операции: читать — лидер и выданный доступ; писать — лидер и доступ «вносить»
drop policy if exists "treasury_ops_select" on public.treasury_ops;
create policy "treasury_ops_select" on public.treasury_ops for select
  using (clan_id = public.current_clan_id() and public.treasury_my_access() is not null);

drop policy if exists "treasury_ops_write" on public.treasury_ops;
create policy "treasury_ops_write" on public.treasury_ops for all
  using (clan_id = public.current_clan_id() and public.treasury_my_access() in ('leader', 'edit'))
  with check (clan_id = public.current_clan_id() and public.treasury_my_access() in ('leader', 'edit'));

-- список доступа: видит и меняет только лидер
drop policy if exists "treasury_access_leader" on public.treasury_access;
create policy "treasury_access_leader" on public.treasury_access for all
  using (clan_id = public.current_clan_id() and public.treasury_is_leader())
  with check (clan_id = public.current_clan_id() and public.treasury_is_leader());
