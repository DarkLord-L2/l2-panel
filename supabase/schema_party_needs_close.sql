-- L2 Clan Cabinet — «Потребности»: закрыть слот с ником (ник сразу добавляется в состав группы)
-- и отменить закрытие (ведро в «Недавно закрыто»: слот возвращается, ник убирается из группы,
-- если его добавило именно это закрытие).
-- Обе операции — функции базы (security definer): лидер/зам пати может добавить человека
-- в СВОЮ группу через закрытие слота, хотя напрямую состав групп меняют только админы.
-- Права те же, что на потребности: can_edit_party_needs (админ клана или лидер/зам этой группы).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_party_needs.sql).

alter table public.party_needs_closed add column if not exists tier text not null default 'main';
alter table public.party_needs_closed add column if not exists alts text[] not null default '{}';
alter table public.party_needs_closed add column if not exists added_to_group boolean not null default false;

create or replace function public.close_party_need(p_need uuid, p_nick text, p_title text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.party_needs;
  v_nick text := left(btrim(coalesce(p_nick, '')), 32);
  v_added boolean := false;
  v_cnt int;
  v_id uuid;
begin
  select * into n from public.party_needs where id = p_need and clan_id = public.current_clan_id() for update;
  if not found then raise exception 'need_not_found'; end if;
  if not public.can_edit_party_needs(n.group_id) then raise exception 'forbidden'; end if;

  if n.qty > 1 then
    update public.party_needs set qty = qty - 1, updated_at = now() where id = n.id;
  else
    delete from public.party_needs where id = n.id;
  end if;

  if v_nick <> '' and not exists (
    select 1 from public.clan_group_members m
    where m.group_id = n.group_id and lower(btrim(m.nickname)) = lower(v_nick)
  ) then
    insert into public.clan_group_members (group_id, nickname) values (n.group_id, v_nick)
    on conflict do nothing;
    get diagnostics v_cnt = row_count;
    v_added := v_cnt > 0;
  end if;

  insert into public.party_needs_closed (clan_id, group_id, cls, title, nick, tier, alts, added_to_group)
  values (n.clan_id, n.group_id, n.cls, left(coalesce(p_title, n.cls), 120), v_nick, n.tier, n.alts, v_added)
  returning id into v_id;

  return jsonb_build_object('closed_id', v_id, 'added', v_added, 'left', greatest(n.qty - 1, 0));
end;
$$;

create or replace function public.undo_party_need_close(p_closed uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.party_needs_closed;
  v_ex uuid;
  v_removed boolean := false;
  v_cnt int;
begin
  select * into c from public.party_needs_closed where id = p_closed and clan_id = public.current_clan_id() for update;
  if not found then raise exception 'not_found'; end if;
  if c.group_id is null or not public.can_edit_party_needs(c.group_id) then raise exception 'forbidden'; end if;

  -- вернуть слот: к такому же (профа, варианты, основа/запас) +1, иначе новый
  select id into v_ex from public.party_needs
  where group_id = c.group_id and cls = c.cls and tier = c.tier and alts = c.alts
  limit 1;
  if v_ex is not null then
    update public.party_needs set qty = least(qty + 1, 9), updated_at = now() where id = v_ex;
  else
    insert into public.party_needs (clan_id, group_id, cls, alts, tier, qty)
    values (c.clan_id, c.group_id, c.cls, c.alts, c.tier, 1);
  end if;

  -- ник убираем из группы, только если его туда добавило это закрытие
  if c.added_to_group and c.nick <> '' then
    delete from public.clan_group_members where group_id = c.group_id and nickname = c.nick;
    get diagnostics v_cnt = row_count;
    v_removed := v_cnt > 0;
  end if;

  delete from public.party_needs_closed where id = c.id;
  return jsonb_build_object('removed_member', v_removed);
end;
$$;

revoke all on function public.close_party_need(uuid, text, text) from public;
revoke all on function public.undo_party_need_close(uuid) from public;
grant execute on function public.close_party_need(uuid, text, text) to authenticated;
grant execute on function public.undo_party_need_close(uuid) to authenticated;
