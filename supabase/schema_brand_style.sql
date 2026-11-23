-- L2 Clan Cabinet — стиль шапки меню (название клана в сайдбаре)
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_clan_branding.sql и schema_clan_branding_rpc.sql)
--
-- brand_style: 'classic' (как было), 'blades-h' (два клинка над названием), 'blades-i' (клинки слева + ромбовая сетка).
-- clans пишет только платформенный супер-админ (RLS), поэтому глав-админ клана меняет стиль через узкую RPC —
-- по тому же принципу, что update_clan_branding: пишет СТРОГО одну колонку своего клана.

alter table public.clans add column if not exists brand_style text not null default 'classic';

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
  if p_style not in ('classic', 'blades-h', 'blades-i') then
    raise exception 'unknown style';
  end if;

  update public.clans
  set brand_style = p_style
  where id = public.current_clan_id();
end;
$$;

grant execute on function public.update_clan_brand_style(text) to authenticated;
