-- L2 Clan Cabinet — правила автоподбора иконки для «дуал-класса» в «Отчётах по
-- мероприятиям»: если у ника с двумя профессиями килов на мероприятии меньше
-- порога — показываем ту профессию, что отмечена как «саппорт», иначе — вторую.
-- И список саппорт-классов, и сам порог редактируются в Админ-панели —
-- в коде ничего не зашито намертво.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

create table public.support_classes (
  clan_id uuid not null references public.clans(id) on delete cascade,
  class_name text not null,
  primary key (clan_id, class_name)
);
alter table public.support_classes enable row level security;
create policy "support_classes_select" on public.support_classes for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "support_classes_write_admins" on public.support_classes for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

create table public.dual_class_settings (
  clan_id uuid primary key references public.clans(id) on delete cascade,
  kill_threshold int not null default 8
);
alter table public.dual_class_settings enable row level security;
create policy "dual_class_settings_select" on public.dual_class_settings for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "dual_class_settings_write_admins" on public.dual_class_settings for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- сид: стандартные саппорт-классы + порог по умолчанию для уже существующих кланов
-- (дальше правится в Админ-панели, этот сид не пересоздаётся при повторном запуске)
insert into public.support_classes (clan_id, class_name)
select c.id, t.cn from public.clans c
cross join (values ('Cardinal'),('Eva''s Saint'),('Shillien Saint'),('Hierophant'),('Dominator')) as t(cn)
on conflict do nothing;

insert into public.dual_class_settings (clan_id, kill_threshold)
select id, 8 from public.clans
on conflict do nothing;
