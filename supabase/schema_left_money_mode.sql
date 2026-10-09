-- L2 Clan Cabinet — «ДКП»: что делать с долей тех, кто ушёл из клана.
-- party — поделить поровну между оставшимися в той же пати (так было раньше, по умолчанию)
-- clan  — поделить поровну между ВСЕМИ оставшимися в клане (по всем пати)
-- box   — не делить, показать в отдельном окошке «Доли ушедших» на странице «Раздача»
-- none  — не делить и не показывать
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_loot_split.sql)

alter table public.loot_split_settings add column if not exists left_money_mode text not null default 'party';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'loot_split_settings_left_money_mode_chk') then
    alter table public.loot_split_settings
      add constraint loot_split_settings_left_money_mode_chk check (left_money_mode in ('party', 'clan', 'box', 'none'));
  end if;
end $$;
