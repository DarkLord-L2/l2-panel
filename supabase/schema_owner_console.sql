-- L2 Clan Cabinet — консоль владельца: срок оплаты, причина отключения, сводка по кланам, проверка миграций.
-- Выполнить в Supabase Dashboard → SQL Editor целиком (после schema_platform_admin.sql). Повторный запуск безопасен.
--
-- 1) clans.paid_until — «оплачен до» (включительно). Пустая дата = без срока. Как только дата прошла, доступ клана
--    пропадает САМ, без cron: current_clan_id() (на ней держатся все правила доступа) возвращает NULL, как при отключении.
-- 2) clans.access_note — сообщение клану: показывается на экране «Доступ приостановлен» (причина отключения, куда писать).
-- 3) my_clan_access() — состояние доступа СВОЕГО клана для экрана блокировки и предупреждения «оплата заканчивается».
-- 4) owner_clan_overview() — для консоли владельца: по каждому клану людей, последний вход, перепись, события, объём данных.
-- 5) owner_schema_status() — для консоли владельца: какие миграции выполнены, а каких не хватает.
-- Все owner_* функции проверяют is_platform_admin() и для остальных падают с «forbidden».

alter table public.clans add column if not exists paid_until date;
alter table public.clans add column if not exists access_note text;

-- ---------- 1. срок оплаты встроен в правила доступа ----------
create or replace function public.current_clan_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select p.clan_id
  from public.profiles p
  join public.clans c on c.id = p.clan_id
  where p.id = auth.uid()
    and c.access_enabled = true
    and (c.paid_until is null or c.paid_until >= current_date)
$$;

-- ---------- 3. состояние доступа своего клана ----------
-- blocked: отключён вручную или срок оплаты вышел. Работает и для заблокированного клана (читает clans напрямую).
create or replace function public.my_clan_access()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'blocked', (not c.access_enabled) or (c.paid_until is not null and c.paid_until < current_date),
    'reason', case when not c.access_enabled then 'disabled'
                   when c.paid_until is not null and c.paid_until < current_date then 'expired'
                   else null end,
    'note', c.access_note,
    'paid_until', c.paid_until,
    'days_left', case when c.paid_until is null then null else (c.paid_until - current_date) end
  )
  from public.profiles p
  join public.clans c on c.id = p.clan_id
  where p.id = auth.uid()
$$;
grant execute on function public.my_clan_access() to authenticated;

-- ---------- 4. сводка по кланам для консоли владельца ----------
create or replace function public.owner_clan_overview()
returns table(
  clan_id uuid,
  members bigint,
  last_sign_in timestamptz,
  last_census date,
  census_people bigint,
  events bigint,
  last_event date,
  rows_total bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  return query
  select c.id,
         (select count(*) from public.profiles p where p.clan_id = c.id),
         (select max(u.last_sign_in_at) from public.profiles p join auth.users u on u.id = p.id where p.clan_id = c.id),
         (select max(ce.week_start) from public.census_entries ce where ce.clan_id = c.id),
         (select count(*) from public.census_entries ce
            where ce.clan_id = c.id
              and ce.week_start = (select max(x.week_start) from public.census_entries x where x.clan_id = c.id)),
         (select count(*) from public.attendance_events ev where ev.clan_id = c.id),
         (select max(ev.event_date) from public.attendance_events ev where ev.clan_id = c.id),
         (select count(*) from public.census_entries where clan_id = c.id)
         + (select count(*) from public.attendance_entries where clan_id = c.id)
         + (select count(*) from public.event_stats where clan_id = c.id)
         + (select count(*) from public.clan_group_members m join public.clan_groups g on g.id = m.group_id where g.clan_id = c.id)
         + (select count(*) from public.member_classes where clan_id = c.id)
  from public.clans c;
end;
$$;
grant execute on function public.owner_clan_overview() to authenticated;

-- ---------- 5. проверка миграций ----------
-- kind: table / column / function / index / section. Возвращает ВСЕ проверки (ok true/false) — консоль сама покажет красным недостающие.
create or replace function public.owner_schema_status()
returns table(file text, what text, ok boolean)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden';
  end if;
  return query
  with expected(file, kind, a, b) as (values
    ('schema_owner_console.sql',      'column',   'clans', 'paid_until'),
    ('schema_owner_console.sql',      'column',   'clans', 'access_note'),
    ('schema_owner_console.sql',      'function', 'my_clan_access', null),
    ('schema_owner_console.sql',      'function', 'owner_clan_overview', null),
    ('schema_brand_style.sql',        'column',   'clans', 'brand_style'),
    ('schema_brand_style.sql',        'function', 'update_clan_brand_style', null),
    ('schema_clan_branding.sql',      'column',   'clans', 'theme_preset'),
    ('schema_clan_branding_rpc.sql',  'function', 'update_clan_branding', null),
    ('schema_attendance_dedupe.sql',  'index',    'attendance_entries_event_nick_uniq', null),
    ('schema_attendance_join_mark.sql','column',  'attendance_report_style', 'mark_before_join'),
    ('schema_report_settings.sql',    'table',    'report_settings', null),
    ('schema_ability_standards.sql',  'table',    'ability_standards', null),
    ('schema_abilities_section.sql',  'section',  'abilities', null),
    ('schema_perf.sql',               'function', 'attendance_summary', null),
    ('schema_perf.sql',               'function', 'census_summary', null),
    ('schema_perf.sql',               'function', 'census_week_list', null),
    ('schema_nick_aliases.sql',       'table',    'nick_aliases', null),
    ('schema_invite_links.sql',       'table',    'invite_links', null),
    ('schema_admin_audit_log.sql',    'table',    'admin_audit_log', null),
    ('schema_delete_protection.sql',  'column',   'profiles', 'delete_protected'),
    ('schema_skill_cd.sql',           'table',    'cd_skills', null),
    ('schema_event_screenshot_batches.sql', 'table', 'event_screenshot_batches', null),
    ('schema_event_stats_party_leader.sql', 'column', 'event_stats', 'is_party_leader'),
    ('schema_event_stats_removed.sql','column',   'event_stats', 'removed')
  )
  select e.file,
         case e.kind
           when 'column' then e.a || '.' || e.b
           when 'section' then 'раздел «' || e.a || '» в меню'
           else e.a
         end,
         case e.kind
           when 'table'    then exists(select 1 from information_schema.tables t where t.table_schema = 'public' and t.table_name = e.a)
           when 'column'   then exists(select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = e.a and c.column_name = e.b)
           when 'function' then exists(select 1 from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace where n.nspname = 'public' and pr.proname = e.a)
           when 'index'    then exists(select 1 from pg_indexes i where i.schemaname = 'public' and i.indexname = e.a)
           when 'section'  then exists(select 1 from public.sections s where s.key = e.a)
           else false
         end
  from expected e;
end;
$$;
grant execute on function public.owner_schema_status() to authenticated;
