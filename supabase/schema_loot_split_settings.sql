-- L2 Clan Cabinet — «Раздел дропа»: настройка «показывать только тех, кто хоть раз
-- ходил за отмеченный период» (initial > 0), выключаемая в Админ-панели → «Правила
-- клана». По умолчанию выключена — раздел ведёт себя как раньше, показывает всех
-- из последней переписи.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)

create table if not exists public.loot_split_settings (
  clan_id uuid primary key references public.clans(id) on delete cascade,
  hide_zero_attendance boolean not null default false
);

alter table public.loot_split_settings enable row level security;

drop policy if exists "loot_split_settings_select" on public.loot_split_settings;
create policy "loot_split_settings_select" on public.loot_split_settings for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "loot_split_settings_write_admins" on public.loot_split_settings;
create policy "loot_split_settings_write_admins" on public.loot_split_settings for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );

-- сид: дефолт "выключено" для уже существующих кланов
insert into public.loot_split_settings (clan_id, hide_zero_attendance)
select id, false from public.clans
on conflict do nothing;
