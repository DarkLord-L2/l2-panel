-- L2 Clan Cabinet — Многокланность: платформенный супер-админ + доступ клану по подписке
-- Выполнить ЦЕЛИКОМ, ОДИН РАЗ, в Supabase Dashboard → SQL Editor, ПОСЛЕ всех остальных
-- уже применённых schema*.sql.
--
-- ⚠️ ВАЖНО: выполнить этот файл нужно ДО первого использования Edge Function create-clan —
-- бэкфилл в шаге 5 (role_sections.clan_id) полагается на то, что на момент выполнения
-- этого файла в базе есть ровно один клан. Если вы уже создали второй клан до того,
-- как выполнили этот файл — остановитесь и разберитесь отдельно, не запускайте вслепую.

-- ---------- 1. Платформенный супер-админ ----------
-- Отдельная сущность от profiles/roles/clan_id — у супер-админа нет строки в profiles
-- вообще, только в auth.users и в этой таблице. Из-за этого он автоматически не проходит
-- НИ ОДНУ существующую clan-scoped RLS-политику (все они читают clan_id через profiles,
-- а у него такой строки нет) — то есть физически не может увидеть данные ни одного клана.

create table public.platform_admins (
  id uuid primary key references auth.users(id) on delete cascade
);
alter table public.platform_admins enable row level security;

-- прочитать можно только свою собственную строку (ни узнать, кто ещё супер-админ, нельзя).
-- Write-политик нет вообще ни одной — значит добавить сюда строку через обычный API-запрос
-- нельзя никому, включая самого супер-админа; только вручную через SQL Editor / service-role.
-- Это и гарантирует «максимум один аккаунт» и невозможность самоэскалации.
create policy "platform_admins_select_self" on public.platform_admins for select
  using (id = auth.uid());

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(select 1 from public.platform_admins where id = auth.uid())
$$;

-- ---------- 2. clans: доступ клану целиком + отображаемый логин лидера ----------

alter table public.clans add column if not exists access_enabled boolean not null default true;
alter table public.clans add column if not exists leader_username text;

-- разово подставить логин уже существующего лидера в уже существующий клан
-- (дальше create-clan будет всегда заполнять эту колонку сам)
update public.clans c
set leader_username = p.username
from public.profiles p
join public.roles r on r.id = p.role_id
where p.clan_id = c.id and r.key = 'glavadmin' and c.leader_username is null;

-- ---------- 3. current_clan_id(): clan_id вызывающего, но только если его клану включён доступ ----------
-- Ключевая функция всей миграции. Как только у клана access_enabled = false, она возвращает
-- NULL для АБСОЛЮТНО ВСЕХ его аккаунтов, включая лидера — а значит везде ниже, где RLS
-- сравнивает clan_id = public.current_clan_id(), сравнение с NULL даёт false, и доступ
-- ко ВСЕМ данным клана (перепись, группы, буст, налоги, посещаемость, пати) пропадает разом,
-- на уровне базы — не просто визуально в JS, это нельзя обойти прямым запросом к API.

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
  where p.id = auth.uid() and c.access_enabled = true
$$;

-- ---------- 4. Сузить дырявые глобальные политики: clans / profiles / roles / sections / parties ----------
-- Раньше "using (public.is_glavadmin())" проверяло только РОЛЬ вызывающего, без привязки
-- к его клану — то есть лидер ЛЮБОГО клана технически мог прочитать/переписать профили,
-- пати и общие настройки ЛЮБОГО ДРУГОГО клана. Это уже было багом до этой задачи.

drop policy if exists "clans_select" on public.clans;
drop policy if exists "clans_write_glavadmin" on public.clans;

-- свой клан читает любой залогиненный БЕЗ учёта access_enabled — иначе при отключённом
-- доступе не на чем будет показать пользователю понятный экран «клан отключён» (замкнутый круг).
create policy "clans_select_own" on public.clans for select
  using (id in (select clan_id from public.profiles where id = auth.uid()));
create policy "clans_select_platform_admin" on public.clans for select
  using (public.is_platform_admin());
create policy "clans_write_platform_admin" on public.clans for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "profiles_select_glavadmin" on public.profiles;
drop policy if exists "profiles_write_glavadmin" on public.profiles;
create policy "profiles_select_glavadmin" on public.profiles for select
  using (public.is_glavadmin() and clan_id = public.current_clan_id());
create policy "profiles_write_glavadmin" on public.profiles for all
  using (public.is_glavadmin() and clan_id = public.current_clan_id())
  with check (public.is_glavadmin() and clan_id = public.current_clan_id());

drop policy if exists "roles_write_glavadmin" on public.roles;
create policy "roles_write_platform_admin" on public.roles for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "sections_write_glavadmin" on public.sections;
create policy "sections_write_platform_admin" on public.sections for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "parties_select" on public.parties;
drop policy if exists "parties_write_glavadmin" on public.parties;
create policy "parties_select" on public.parties for select
  using (clan_id = public.current_clan_id());
create policy "parties_write_glavadmin" on public.parties for all
  using (public.is_glavadmin() and clan_id = public.current_clan_id())
  with check (public.is_glavadmin() and clan_id = public.current_clan_id());

-- ---------- 5. role_sections: превратить из общей на все кланы таблицы в per-клан ----------
-- Раньше эта таблица не имела clan_id вовсе — то есть все кланы делили ОДНУ И ТУ ЖЕ
-- настройку «какая роль видит какой раздел». Один клан переключает галочку — меняется
-- у всех. Порядок ниже важен: сначала добавить колонку nullable, потом бэкфилл,
-- потом NOT NULL, потом сменить первичный ключ — иначе упадёт на существующих строках.

alter table public.role_sections add column if not exists clan_id uuid references public.clans(id) on delete cascade;
update public.role_sections set clan_id = (select id from public.clans limit 1) where clan_id is null;
alter table public.role_sections alter column clan_id set not null;

alter table public.role_sections drop constraint if exists role_sections_pkey;
alter table public.role_sections add primary key (clan_id, role_id, section_key);

drop policy if exists "role_sections_select" on public.role_sections;
drop policy if exists "role_sections_write_glavadmin" on public.role_sections;
create policy "role_sections_select" on public.role_sections for select
  using (clan_id = public.current_clan_id());
create policy "role_sections_write_glavadmin" on public.role_sections for all
  using (public.is_glavadmin() and clan_id = public.current_clan_id())
  with check (public.is_glavadmin() and clan_id = public.current_clan_id());

-- ⚠️ admin.html записывает сюда через upsert с onConflict:"role_id,section_key" —
-- после смены первичного ключа этот onConflict больше не существует и апсерт станет
-- падать. Это исправлено в самом admin.html (onConflict → "clan_id,role_id,section_key"),
-- обновите файл вместе с этой миграцией.

-- ---------- 6. Остальные таблицы клана: тот же паттерн замены, clan_id in (select ... profiles ...)
-- → clan_id = public.current_clan_id() — единственное, что реально гасит доступ ко всем
-- данным клана при access_enabled = false. Роль-проверка (glavadmin/admin) не меняется.

-- census_entries
drop policy if exists "census_select" on public.census_entries;
drop policy if exists "census_write_admins" on public.census_entries;
create policy "census_select" on public.census_entries for select
  using (clan_id = public.current_clan_id());
create policy "census_write_admins" on public.census_entries for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- clan_groups
drop policy if exists "clan_groups_select" on public.clan_groups;
drop policy if exists "clan_groups_write_admins" on public.clan_groups;
create policy "clan_groups_select" on public.clan_groups for select
  using (clan_id = public.current_clan_id());
create policy "clan_groups_write_admins" on public.clan_groups for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- clan_group_members (сам по себе без clan_id — идёт через clan_groups)
drop policy if exists "clan_group_members_select" on public.clan_group_members;
drop policy if exists "clan_group_members_write_admins" on public.clan_group_members;
create policy "clan_group_members_select" on public.clan_group_members for select
  using (group_id in (select id from public.clan_groups where clan_id = public.current_clan_id()));
create policy "clan_group_members_write_admins" on public.clan_group_members for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and group_id in (select id from public.clan_groups where clan_id = public.current_clan_id())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and group_id in (select id from public.clan_groups where clan_id = public.current_clan_id())
  );

-- member_classes
drop policy if exists "member_classes_select" on public.member_classes;
drop policy if exists "member_classes_write_admins" on public.member_classes;
create policy "member_classes_select" on public.member_classes for select
  using (clan_id = public.current_clan_id());
create policy "member_classes_write_admins" on public.member_classes for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- boost_sections
drop policy if exists "boost_sections_select" on public.boost_sections;
drop policy if exists "boost_sections_write_admins" on public.boost_sections;
create policy "boost_sections_select" on public.boost_sections for select
  using (clan_id = public.current_clan_id());
create policy "boost_sections_write_admins" on public.boost_sections for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- boost_items
drop policy if exists "boost_items_select" on public.boost_items;
drop policy if exists "boost_items_write_admins" on public.boost_items;
create policy "boost_items_select" on public.boost_items for select
  using (clan_id = public.current_clan_id());
create policy "boost_items_write_admins" on public.boost_items for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- boost_member_values
drop policy if exists "boost_member_values_select" on public.boost_member_values;
drop policy if exists "boost_member_values_write_admins" on public.boost_member_values;
create policy "boost_member_values_select" on public.boost_member_values for select
  using (clan_id = public.current_clan_id());
create policy "boost_member_values_write_admins" on public.boost_member_values for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- boost_class_values
drop policy if exists "boost_class_values_select" on public.boost_class_values;
drop policy if exists "boost_class_values_write_admins" on public.boost_class_values;
create policy "boost_class_values_select" on public.boost_class_values for select
  using (clan_id = public.current_clan_id());
create policy "boost_class_values_write_admins" on public.boost_class_values for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- tax_payments
drop policy if exists "tax_payments_select" on public.tax_payments;
drop policy if exists "tax_payments_write_admins" on public.tax_payments;
create policy "tax_payments_select" on public.tax_payments for select
  using (clan_id = public.current_clan_id());
create policy "tax_payments_write_admins" on public.tax_payments for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- tax_archived_weeks
drop policy if exists "tax_archived_select" on public.tax_archived_weeks;
drop policy if exists "tax_archived_write_admins" on public.tax_archived_weeks;
create policy "tax_archived_select" on public.tax_archived_weeks for select
  using (clan_id = public.current_clan_id());
create policy "tax_archived_write_admins" on public.tax_archived_weeks for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- attendance_schedule_template
drop policy if exists "attendance_template_select" on public.attendance_schedule_template;
drop policy if exists "attendance_template_write_admins" on public.attendance_schedule_template;
create policy "attendance_template_select" on public.attendance_schedule_template for select
  using (clan_id = public.current_clan_id());
create policy "attendance_template_write_admins" on public.attendance_schedule_template for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- attendance_events
drop policy if exists "attendance_events_select" on public.attendance_events;
drop policy if exists "attendance_events_write_admins" on public.attendance_events;
create policy "attendance_events_select" on public.attendance_events for select
  using (clan_id = public.current_clan_id());
create policy "attendance_events_write_admins" on public.attendance_events for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- attendance_entries
drop policy if exists "attendance_entries_select" on public.attendance_entries;
drop policy if exists "attendance_entries_write_admins" on public.attendance_entries;
create policy "attendance_entries_select" on public.attendance_entries for select
  using (clan_id = public.current_clan_id());
create policy "attendance_entries_write_admins" on public.attendance_entries for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- attendance_report_filters
drop policy if exists "attendance_report_filters_select" on public.attendance_report_filters;
drop policy if exists "attendance_report_filters_write_admins" on public.attendance_report_filters;
create policy "attendance_report_filters_select" on public.attendance_report_filters for select
  using (clan_id = public.current_clan_id());
create policy "attendance_report_filters_write_admins" on public.attendance_report_filters for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- attendance_day_visibility
drop policy if exists "attendance_day_visibility_select" on public.attendance_day_visibility;
drop policy if exists "attendance_day_visibility_write_admins" on public.attendance_day_visibility;
create policy "attendance_day_visibility_select" on public.attendance_day_visibility for select
  using (clan_id = public.current_clan_id());
create policy "attendance_day_visibility_write_admins" on public.attendance_day_visibility for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- attendance_week_init
drop policy if exists "attendance_week_init_select" on public.attendance_week_init;
drop policy if exists "attendance_week_init_write_admins" on public.attendance_week_init;
create policy "attendance_week_init_select" on public.attendance_week_init for select
  using (clan_id = public.current_clan_id());
create policy "attendance_week_init_write_admins" on public.attendance_week_init for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- attendance_report_style
drop policy if exists "attendance_report_style_select" on public.attendance_report_style;
drop policy if exists "attendance_report_style_write_admins" on public.attendance_report_style;
create policy "attendance_report_style_select" on public.attendance_report_style for select
  using (clan_id = public.current_clan_id());
create policy "attendance_report_style_write_admins" on public.attendance_report_style for all
  using (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id())
  with check (public.current_role_key() in ('glavadmin','admin') and clan_id = public.current_clan_id());

-- ---------- 7. Обязательная смена пароля при первом входе ----------
-- Узкая RPC вместо общего self-write на profiles (тот специально запрещён — иначе
-- участник мог бы сам себе поменять роль/клан). Эта функция может снять только один
-- конкретный флаг у своей же строки, больше ничего.

alter table public.profiles add column if not exists must_change_password boolean not null default false;

create or replace function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set must_change_password = false where id = auth.uid()
$$;

-- ---------- 8. Косметика: человеческое название верхней роли клана ----------
-- Ключ 'glavadmin' в коде не меняется (isAdmin-проверки разбросаны по всем html-файлам),
-- меняется только то, что видит пользователь.
update public.roles set label = 'Клан-лидер' where key = 'glavadmin';

-- ---------- 9. Бутстрап первого (и единственного) супер-админа — вручную, один раз ----------
--
-- 1. Dashboard → Authentication → Users → Add user. Свой собственный email/пароль
--    (НЕ по шаблону *@l2clan.local — тот только для аккаунтов кланов). Скопируйте UID.
-- 2. Выполните (замените UID):
--
-- insert into public.platform_admins (id) values ('<UID из шага 1>');
--
-- У этого аккаунта НЕ должно быть строки в public.profiles — не создавайте её,
-- это как раз то, что делает его невидимым для всех clan-scoped таблиц.
