-- L2 Clan Cabinet — «Проверка буста»: склейка соседних пунктов в один блок
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_gear_check_classes.sql)
--
-- Пункт с merged_with_prev = true рисуется слитно с предыдущим пунктом того же
-- раздела и подраздела: в таблице у них общая шапка без разделителя, в правой
-- панели участника — одна общая карточка. Тумблеры, вес и баллы остаются
-- у каждого пункта свои — склейка только визуальная.

alter table public.boost_items add column if not exists merged_with_prev boolean not null default false;

-- «всё или ничего» для склеенной группы: балл идёт, только если у участника
-- включены все пункты группы; если хоть одного нет — группа даёт 0. Флаг
-- действует на всю группу, достаточно отметить его у любого её пункта.
alter table public.boost_items add column if not exists merge_all_required boolean not null default false;
