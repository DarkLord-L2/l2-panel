-- L2 Clan Cabinet — «Отчёт по мероприятиям»: настройка авто-подписи скрина явки именем
-- группы. Если среди распознанных на скрине ников минимум min_group_count состоят в одной
-- группе клана — скрин подписывается её названием, иначе — solo_label. Порог и название
-- редактируются прямо в reports.html (шестерёнка настроек), в коде ничего не зашито намертво.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

create table public.group_label_settings (
  clan_id uuid primary key references public.clans(id) on delete cascade,
  min_group_count int not null default 5 check (min_group_count between 1 and 9),
  solo_label text not null default 'Соло'
);
alter table public.group_label_settings enable row level security;

create policy "group_label_settings_select" on public.group_label_settings for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "group_label_settings_write_admins" on public.group_label_settings for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- сид: дефолтные значения для уже существующих кланов (дальше правится в reports.html,
-- этот сид не пересоздаётся при повторном запуске)
insert into public.group_label_settings (clan_id, min_group_count, solo_label)
select id, 5, 'Соло' from public.clans
on conflict do nothing;
