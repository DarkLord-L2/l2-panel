-- L2 Clan Cabinet — класс и аватарка участника (подпись под ником в таблицах)
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)
--
-- Ники живут в переписи (census_entries), здесь только дополнение к ним:
-- название класса и картинка. Строки нет — значит класс просто не заполнен.

create table public.member_classes (
  clan_id uuid not null references public.clans(id) on delete cascade,
  nickname text not null,
  class_name text,
  icon text,                       -- data-URL картинки, уменьшенной на клиенте
  primary key (clan_id, nickname)
);

alter table public.member_classes enable row level security;

create policy "member_classes_select" on public.member_classes for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
create policy "member_classes_write_admins" on public.member_classes for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
