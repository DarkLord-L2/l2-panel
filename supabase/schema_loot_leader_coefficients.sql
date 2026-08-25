-- L2 Clan Cabinet — «ДКП Пати»: коэффициент пати-лидерам теперь настраивается
-- ОТДЕЛЬНО для каждого текущего пати-лидера (Группы → лидер), а не одним общим
-- числом на всех — тот же принцип, что у loot_class_coefficients/loot_party_coefficients,
-- только ключ — nickname лидера. Список в Админ-панели строится по текущим
-- значениям clan_groups.leader_nickname (не хранится отдельно) — если лидера
-- сняли с этой роли, его строка в таблице просто перестаёт использоваться
-- (не удаляется — назначат обратно, коэффициент никуда не денется).
-- Заменяет loot_split_settings.loot_leader_coefficient (то поле больше не
-- читается и не пишется кодом, но само не удаляется — можно почистить вручную).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_groups.sql, schema_loot_leader_coefficient.sql)

create table if not exists public.loot_leader_coefficients (
  clan_id uuid not null references public.clans(id) on delete cascade,
  nickname text not null,
  coefficient numeric not null default 1,
  primary key (clan_id, nickname)
);

alter table public.loot_leader_coefficients enable row level security;

drop policy if exists "loot_leader_coefficients_select" on public.loot_leader_coefficients;
create policy "loot_leader_coefficients_select" on public.loot_leader_coefficients for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "loot_leader_coefficients_write_admins" on public.loot_leader_coefficients;
create policy "loot_leader_coefficients_write_admins" on public.loot_leader_coefficients for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
