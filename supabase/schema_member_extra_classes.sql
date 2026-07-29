-- Ещё две профессии участнику (всего 4) и уровень у каждой из них.
-- Уровень пока показывается только в разделе «Группы» — на карточке участника
-- рядом с названием класса; в отчётах и «Проверке буста» он не используется.

alter table public.member_classes add column if not exists class_name_3 text;
alter table public.member_classes add column if not exists class_name_4 text;

alter table public.member_classes add column if not exists class_level   smallint;
alter table public.member_classes add column if not exists class_level_2 smallint;
alter table public.member_classes add column if not exists class_level_3 smallint;
alter table public.member_classes add column if not exists class_level_4 smallint;

-- уровень либо не задан, либо в игровом диапазоне 1..85 (клиент проверяет то же самое,
-- это страховка на случай правки данных мимо интерфейса)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'member_classes_levels_range') then
    alter table public.member_classes add constraint member_classes_levels_range check (
      (class_level   is null or class_level   between 1 and 85) and
      (class_level_2 is null or class_level_2 between 1 and 85) and
      (class_level_3 is null or class_level_3 between 1 and 85) and
      (class_level_4 is null or class_level_4 between 1 and 85)
    );
  end if;
end $$;
