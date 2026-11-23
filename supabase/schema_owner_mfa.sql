-- L2 Clan Cabinet — двухфакторная защита консоли владельца (TOTP: Google Authenticator, Authy, 1Password и т.п.).
-- Выполнить в Supabase Dashboard → SQL Editor ПОСЛЕ schema_platform_admin.sql. Повторный запуск безопасен.
--
-- Как это устроено:
--  • platform_settings.require_mfa (по умолчанию false) — включается кнопкой в консоли ПОСЛЕ того, как вы привязали приложение.
--  • Пока require_mfa = true, is_platform_admin() возвращает true только для сессии, в которой введён код (aal2). Значит даже
--    с украденным паролем владельца нельзя ни открыть консоль, ни вызвать функции create-clan / delete-clan / owner-enter-clan /
--    reset-leader-password (все они проверяют is_platform_admin() под JWT вызывающего), ни прочитать/изменить clans как владелец.
--  • Включить require_mfa можно только из сессии, где код уже введён (чтобы не запереть себя непроверенным приложением).
--  • Если всё же потеряли приложение: Supabase Dashboard → SQL Editor →  update public.platform_settings set require_mfa = false;
--    (дальше войти паролем и привязать новое приложение).

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),   -- ровно одна строка
  require_mfa boolean not null default false
);
insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

-- RLS включён, политик нет вообще: ни читать, ни менять через API нельзя никому — только функции ниже (security definer)
alter table public.platform_settings enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.platform_admins where id = auth.uid())
     and (
       not coalesce((select s.require_mfa from public.platform_settings s limit 1), false)
       or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     )
$$;

-- состояние для консоли: включено ли «требовать код» (видно только владельцу)
create or replace function public.owner_mfa_status()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object('require_mfa', coalesce((select s.require_mfa from public.platform_settings s limit 1), false));
end;
$$;
grant execute on function public.owner_mfa_status() to authenticated;

-- включить/выключить «требовать код». Включать можно только из сессии с введённым кодом (aal2)
create or replace function public.owner_set_require_mfa(p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  if p_on and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'mfa_not_verified';
  end if;
  update public.platform_settings set require_mfa = p_on where id = true;
end;
$$;
grant execute on function public.owner_set_require_mfa(boolean) to authenticated;
