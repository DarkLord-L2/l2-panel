-- L2 Clan Cabinet — «Отчёты по мероприятиям»: принудительно выбранная профессия.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_member_classes.sql)
--
-- По клику на иконку класса в отчёте админ может выбрать любую из профессий
-- участника вместо той, что подобралась автоматически по числу килов.
-- Выбор действует ТОЛЬКО в том периоде, в котором его сделали: period_key — это
-- то же значение, что стоит в фильтре периода ('all', 'week:2026-07-20',
-- 'event:<uuid>'). В соседней неделе или другом мероприятии профессия снова
-- подбирается автоматически, пока её не поменяют и там.
--
-- Ник хранится в нормализованном виде (нижний регистр, гомоглифы кириллица/латиница
-- схлопнуты, лишние символы убраны) — по всему сайту ники сверяются нечётко, и OCR
-- может записать одного человека по-разному в разных мероприятиях.

create table public.report_class_overrides (
  clan_id uuid not null references public.clans(id) on delete cascade,
  nickname_norm text not null,
  period_key text not null,
  class_name text not null,
  updated_at timestamptz not null default now(),
  primary key (clan_id, nickname_norm, period_key)
);
create index report_class_overrides_period_idx on public.report_class_overrides(clan_id, period_key);

alter table public.report_class_overrides enable row level security;

create policy "report_class_overrides_select" on public.report_class_overrides for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "report_class_overrides_write_admins" on public.report_class_overrides for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
