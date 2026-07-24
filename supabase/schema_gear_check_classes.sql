-- L2 Clan Cabinet — «Проверка буста»: подписи у пунктов и значения, зависящие от класса
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_gear_check.sql и schema_member_classes.sql)
--
-- Часть пунктов одинакова для всех (Агатіон), а часть завязана на профессию:
-- у баффа свой код под каждый класс, у тату — свои статы. Поэтому у пункта есть
-- либо общая подпись (subtitle), либо признак per_class — и тогда текст берётся
-- из boost_class_values по классу конкретного участника.

alter table public.boost_items add column if not exists subtitle text;
alter table public.boost_items add column if not exists per_class boolean not null default false;
alter table public.boost_items add column if not exists full_width boolean not null default false;
-- необязательная подгруппа внутри раздела (например, «Еліксири» внутри «Загальна») —
-- пункты с одинаковым текстом группируются под общей подписью, без своей рамки раздела
alter table public.boost_items add column if not exists subgroup text;

-- скрытый пункт не идёт в таблицу и в общий счёт баллов, но данные (тумблеры по
-- участникам) не удаляются — админ может в любой момент снова его показать
alter table public.boost_items add column if not exists hidden boolean not null default false;

create table public.boost_class_values (
  clan_id uuid not null references public.clans(id) on delete cascade,
  item_id uuid not null references public.boost_items(id) on delete cascade,
  class_name text not null,
  value_text text,
  primary key (item_id, class_name)
);
create index boost_class_values_item_idx on public.boost_class_values(item_id);

alter table public.boost_class_values enable row level security;

create policy "boost_class_values_select" on public.boost_class_values for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "boost_class_values_write_admins" on public.boost_class_values for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
