-- L2 Clan Cabinet — стиль интерфейса («Обычный» / «Строгий») и новые стили шапки меню («две палки»)
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_brand_style.sql). Повторный запуск безопасен.
--
-- ui_style: 'default' (как было) или 'minimal' («Строгий»: плоско, тонкие линии, без свечений — js/theme-minimal.css).
-- clans пишет только платформенный супер-админ (RLS), поэтому глав-админ клана меняет стиль через узкую RPC —
-- тот же принцип, что update_clan_brand_style: пишет СТРОГО одну колонку своего клана.

alter table public.clans add column if not exists ui_style text not null default 'default';

create or replace function public.update_clan_ui_style(p_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role_key() <> 'glavadmin' then
    raise exception 'forbidden';
  end if;
  if p_style not in ('default', 'minimal') then
    raise exception 'unknown style';
  end if;

  update public.clans
  set ui_style = p_style
  where id = public.current_clan_id();
end;
$$;

grant execute on function public.update_clan_ui_style(text) to authenticated;

-- шапка меню: к трём прежним стилям добавлены четыре «две палки» (pillars-*)
create or replace function public.update_clan_brand_style(p_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role_key() <> 'glavadmin' then
    raise exception 'forbidden';
  end if;
  if p_style not in ('classic', 'blades-h', 'blades-i', 'pillars-top', 'pillars-left', 'pillars-flank', 'pillars-cross') then
    raise exception 'unknown style';
  end if;

  update public.clans
  set brand_style = p_style
  where id = public.current_clan_id();
end;
$$;

grant execute on function public.update_clan_brand_style(text) to authenticated;
