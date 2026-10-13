-- L2 Clan Cabinet — привязки ников: «этот ник (со скрина/из журнала) = вот этот игрок из переписи».
-- Автоматическое сопоставление (js/nick-match.js) не склеивает ники при неоднозначности и не угадывает сильно
-- искажённое распознавание. Такие случаи клан-лидер привязывает вручную один раз — и привязка работает
-- везде (ДКП Соло, ДКП Пати, «Раздача») и важнее любого угадывания.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql, schema_platform_admin.sql)

create table if not exists public.nick_aliases (
  clan_id uuid not null references public.clans(id) on delete cascade,
  alias text not null,            -- как ник выглядит на скрине / в журнале
  canonical text not null,        -- как этого игрока зовут в переписи
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (clan_id, alias)
);
alter table public.nick_aliases enable row level security;

drop policy if exists "nick_aliases_select" on public.nick_aliases;
create policy "nick_aliases_select" on public.nick_aliases for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "nick_aliases_write_admins" on public.nick_aliases;
create policy "nick_aliases_write_admins" on public.nick_aliases for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
