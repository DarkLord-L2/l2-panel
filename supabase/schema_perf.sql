-- L2 Clan Cabinet — скорость базы под много кланов и много людей одновременно.
-- Выполнить в Supabase Dashboard → SQL Editor целиком (одним запуском). Можно запускать повторно — ничего не сломает.
-- Данные не меняет: только индексы, переписанные (по смыслу те же) правила доступа и одна новая функция чтения.
-- Если что-то пойдёт не так, весь блок откатится сам — база останется как была.
--
-- Что делает:
-- 1) ПРАВИЛА ДОСТУПА (RLS). Сейчас они написаны как «clan_id = current_clan_id()». Postgres вправе вызывать такую
--    функцию ЗАНОВО ДЛЯ КАЖДОЙ СТРОКИ таблицы: каждый вызов — ещё один поиск в profiles+clans. На своей таблице
--    явки в тысячи строк это тысячи лишних поисков на ОДИН запрос, а при 10 кланах таблицы в 10 раз больше.
--    Обёртка «(select current_clan_id())» — официальный совет Supabase: функция считается ОДИН раз на запрос.
--    Смысл правил не меняется ни на символ — меняется только то, сколько раз база их считает.
-- 2) ИНДЕКСЫ по clan_id (и clan_id + week_start) на всех таблицах с данными кланов: база сразу находит строки
--    своего клана, а не перебирает строки всех кланов подряд.
-- 3) Функция attendance_summary(): сводка явки по нику (сколько раз был, когда последний раз) считается в базе.
--    «Группы» и «Участники клана» раньше ради этого выкачивали ВСЮ историю явки клана (растёт каждую неделю).
-- 4) Функции census_summary() и census_week_list(): то же для переписи («Мой кабинет», «Выплаты»).
-- Пока миграция не выполнена, сайт работает по-старому (страницы сами откатываются на прежние запросы).

-- ---------- 1. правила доступа: функции — один раз на запрос, а не на каждую строку ----------
do $$
declare
  p record;
  -- только наши «кто я» функции (все возвращают одно значение); уже обёрнутые (после SELECT) не трогаем
  re constant text := '(?<!SELECT )(?<![.[:alnum:]_])((?:public\.|auth\.)?(?:uid|jwt|current_clan_id|current_role_key|is_glavadmin|is_platform_admin))\(\)';
  new_qual text;
  new_check text;
  sql text;
  changed int := 0;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    new_qual  := case when p.qual is null then null else regexp_replace(p.qual, re, '(SELECT \1())', 'g') end;
    new_check := case when p.with_check is null then null else regexp_replace(p.with_check, re, '(SELECT \1())', 'g') end;
    if new_qual is distinct from p.qual or new_check is distinct from p.with_check then
      sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
      if new_qual is not null then sql := sql || ' using (' || new_qual || ')'; end if;
      if new_check is not null then sql := sql || ' with check (' || new_check || ')'; end if;
      execute sql;
      changed := changed + 1;
    end if;
  end loop;
  raise notice 'Правил доступа ускорено: %', changed;
end $$;

-- ---------- 2. индексы по клану ----------
do $$
declare
  t record;
  made int := 0;
begin
  -- clan_id первым столбцом — на каждой таблице, где он есть и где такого индекса ещё нет
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'clan_id' and not a.attisdropped
    where c.relkind = 'r'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.oid and i.indkey[0] = a.attnum
      )
  loop
    execute format('create index if not exists %I on public.%I (clan_id)', t.tbl || '_clan_id_perf_idx', t.tbl);
    made := made + 1;
  end loop;
  -- clan_id + week_start — таблицы «по неделям» (перепись, налоги, мероприятия…): «последняя неделя своего клана»
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a1 on a1.attrelid = c.oid and a1.attname = 'clan_id' and not a1.attisdropped
    join pg_attribute a2 on a2.attrelid = c.oid and a2.attname = 'week_start' and not a2.attisdropped
    where c.relkind = 'r'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.oid and i.indkey[0] = a1.attnum and i.indnatts >= 2 and i.indkey[1] = a2.attnum
      )
  loop
    execute format('create index if not exists %I on public.%I (clan_id, week_start)', t.tbl || '_clan_week_perf_idx', t.tbl);
    made := made + 1;
  end loop;
  -- event_id — связи «строки мероприятия» (явка, статистика), если индекса ещё нет
  for t in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'event_id' and not a.attisdropped
    where c.relkind = 'r'
      and not exists (select 1 from pg_index i where i.indrelid = c.oid and i.indkey[0] = a.attnum)
  loop
    execute format('create index if not exists %I on public.%I (event_id)', t.tbl || '_event_id_perf_idx', t.tbl);
    made := made + 1;
  end loop;
  raise notice 'Индексов создано: %', made;
end $$;

-- ---------- 3. сводка явки по нику (для «Групп» и «Участников клана») ----------
-- security invoker (по умолчанию): работают обычные правила доступа — каждый видит только свой клан.
-- entries — сколько отметок всего; events — на скольких мероприятиях (с датой); last_date — последнее посещение
create or replace function public.attendance_summary()
returns table(nickname text, entries bigint, events bigint, last_date date)
language sql
stable
set search_path = public
as $$
  select e.nickname,
         count(*) as entries,
         count(distinct e.event_id) filter (where ev.event_date is not null) as events,
         max(ev.event_date) as last_date
  from public.attendance_entries e
  left join public.attendance_events ev on ev.id = e.event_id
  where e.clan_id = (select public.current_clan_id())
  group by e.nickname
$$;
grant execute on function public.attendance_summary() to authenticated;

-- ---------- 4. сводка переписи по нику (для «Моего кабинета» и «Выплат») ----------
-- раньше эти страницы выкачивали всю историю переписи (~150 строк каждую неделю, за год — тысячи)
-- weeks — в скольких неделях переписи был; first_week / last_week — первая и последняя такая неделя
create or replace function public.census_summary()
returns table(nickname text, weeks bigint, first_week date, last_week date)
language sql
stable
set search_path = public
as $$
  select c.nickname, count(distinct c.week_start), min(c.week_start), max(c.week_start)
  from public.census_entries c
  where c.clan_id = (select public.current_clan_id())
  group by c.nickname
$$;
grant execute on function public.census_summary() to authenticated;

-- все недели, за которые есть перепись (по возрастанию) — десятки строк, а не тысячи
create or replace function public.census_week_list()
returns table(week_start date)
language sql
stable
set search_path = public
as $$
  select distinct c.week_start
  from public.census_entries c
  where c.clan_id = (select public.current_clan_id())
  order by 1
$$;
grant execute on function public.census_week_list() to authenticated;

-- свежая статистика для планировщика запросов
analyze;
