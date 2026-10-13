-- L2 Clan Cabinet — «ДКП»: ручная оплата за 1 КМ.
-- Если manual_km_enabled = true и manual_km_price > 0, то «Раздача» платит «число КМ у лидера × эта цена»
-- всем (лидер — с его коэффициентом), вместо расчёта ДКП. Стёр цену или выключил — считается как раньше.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_loot_split.sql)

alter table public.loot_split_settings add column if not exists manual_km_price numeric;
alter table public.loot_split_settings add column if not exists manual_km_enabled boolean not null default false;
