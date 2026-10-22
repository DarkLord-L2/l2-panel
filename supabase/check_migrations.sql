-- L2 Clan Cabinet — проверка: какие SQL-миграции ещё не выполнены.
-- Ничего НЕ меняет, только читает. Выполнить в Supabase Dashboard → SQL Editor.
-- Результат — список того, чего не хватает, и какой файл из папки supabase/ нужно выполнить.
-- Если вернулась одна строка «✓ Всё на месте» — выполнять ничего не нужно.

with expected(file, tbl, col) as (
  values
    ('schema_nick_aliases.sql',            'nick_aliases',            null),
    ('schema_group_notes.sql',             'clan_group_notes',        null),
    ('schema_group_sections.sql',          'clan_group_sections',     null),
    ('schema_group_sections.sql',          'clan_group_members',      'section_id'),
    ('schema_report_class_source.sql',     'report_class_overrides',  'source'),
    ('schema_taxes_toggle.sql',            'tax_settings',            'taxes_enabled'),
    ('schema_left_money_mode.sql',         'loot_split_settings',     'left_money_mode'),
    ('schema_payout_show_else.sql',        'loot_split_settings',     'payout_show_else'),
    ('schema_manual_km_price.sql',         'loot_split_settings',     'manual_km_price'),
    ('schema_manual_km_price.sql',         'loot_split_settings',     'manual_km_enabled'),
    ('schema_loot_leader_coef_in_solo.sql','loot_split_settings',     'leader_coef_in_solo'),
    ('schema_payout_show_left.sql',        'loot_split_settings',     'show_left_in_payout'),
    ('schema_payout_event_ids.sql',        'payout_batches',          'event_ids'),
    ('schema_payout_event_ids.sql',        'payout_batches',          'unit_by_nick'),
    ('schema_skill_cd.sql',                'cd_skills',               null),
    ('schema_skill_cd.sql',                'cd_marks',                null),
    ('schema_skill_cd.sql',                'cd_settings',             null),
    ('schema_skill_cd.sql',                'cd_skill_off',            null),
    ('schema_skill_cd.sql',                'cd_skill_copies',         null),
    ('schema_skill_cd.sql',                'cd_skills',               'cd_seconds'),
    ('schema_skill_cd.sql',                'cd_marks',                'ready_at'),
    ('schema_skill_cd.sql',                'cd_marks',                'slot'),
    ('schema_skill_cd.sql',                'clan_groups',             'cd_enabled'),
    ('schema_skill_cd.sql',                'clan_groups',             'cd_number'),
    ('schema_skill_cd.sql',                'clan_groups',             'cd_name')
),
missing as (
  select e.file,
         e.tbl as "таблица",
         coalesce(e.col, '(вся таблица)') as "колонка"
  from expected e
  where (e.col is null and not exists (
          select 1 from information_schema.tables t
          where t.table_schema = 'public' and t.table_name = e.tbl))
     or (e.col is not null and not exists (
          select 1 from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = e.tbl and c.column_name = e.col))
)
select file as "выполнить файл", "таблица", "колонка" from missing
union all
select '✓ Всё на месте', '', '' where not exists (select 1 from missing)
order by 1;
