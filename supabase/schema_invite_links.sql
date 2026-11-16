-- L2 Clan Cabinet — одноразовые ссылки-приглашения для входа (Админ-панель →
-- «Пользователи» → кнопка 🔗). Клан-лидер кидает человеку ссылку, по ней открывается
-- страница входа с уже введёнными логином и паролем — остаётся нажать «Войти».
--
-- Как устроено и почему пароль тут НЕ хранится:
--   • логин и пароль зашифрованы (AES-GCM) прямо в самой ссылке, после «#» — эта часть
--     адреса вообще не уходит на сервер (ни в GitHub Pages, ни в Supabase);
--   • в этой таблице лежит только случайный ключ к шифру конкретной ссылки;
--   • invite_key() отдаёт ключ, только пока ссылка не использована и ей < 30 дней;
--   • после первого входа по ссылке invite_consume() гасит её — повторно открытая
--     (на любом устройстве) ссылка просто ведёт на обычный вход, без подстановки.
-- Выполнить в Supabase Dashboard → SQL Editor.

create table if not exists public.invite_links (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists invite_links_user_idx on public.invite_links(clan_id, user_id, created_at desc);

alter table public.invite_links enable row level security;

-- видеть/создавать/гасить ссылки своего клана может только главный админ (как и создавать пользователей)
drop policy if exists "invite_links_glavadmin" on public.invite_links;
create policy "invite_links_glavadmin" on public.invite_links for all
  using (public.is_glavadmin() and clan_id in (select clan_id from public.profiles where id = auth.uid()))
  with check (public.is_glavadmin() and clan_id in (select clan_id from public.profiles where id = auth.uid()));

-- ключ к ссылке — для страницы входа (ещё без входа, роль anon); только живые ссылки
create or replace function public.invite_key(p_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select key from public.invite_links
  where id = p_id and used_at is null and created_at > now() - interval '30 days'
$$;
revoke all on function public.invite_key(uuid) from public;
grant execute on function public.invite_key(uuid) to anon, authenticated;

-- погасить ссылку после входа — только сам её владелец (тот, кто по ней вошёл)
create or replace function public.invite_consume(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update public.invite_links set used_at = now()
  where id = p_id and user_id = auth.uid() and used_at is null;
  get diagnostics n = row_count;
  return n > 0;
end
$$;
revoke all on function public.invite_consume(uuid) from public;
grant execute on function public.invite_consume(uuid) to authenticated;
