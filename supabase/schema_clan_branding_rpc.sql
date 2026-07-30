-- L2 Clan Cabinet — узкая RPC для самостоятельного изменения оформления клана
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_clan_branding.sql)
--
-- public.clans пишет только is_platform_admin() (см. clans_write_platform_admin
-- в schema_platform_admin.sql) — это специально, чтобы клан-лидер не мог сам
-- включить себе access_enabled после отключения за неоплату. Из-за этого прямой
-- UPDATE из «Оформление» в admin.html молча ничего не менял (RLS отклоняет
-- строку, Supabase не бросает ошибку на 0 обновлённых строк) — снаружи выглядело
-- как «ничего не сохраняется», хотя ошибок не было. Эта RPC даёт глав-админу
-- писать СТРОГО в 4 колонки оформления, не трогая остальные поля clans.

create or replace function public.update_clan_branding(
  p_theme_preset text,
  p_accent_color text,
  p_display_name text,
  p_logo_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role_key() <> 'glavadmin' then
    raise exception 'forbidden';
  end if;

  update public.clans
  set theme_preset = p_theme_preset,
      accent_color = p_accent_color,
      display_name = p_display_name,
      logo_url = p_logo_url
  where id = public.current_clan_id();
end;
$$;

grant execute on function public.update_clan_branding(text, text, text, text) to authenticated;
