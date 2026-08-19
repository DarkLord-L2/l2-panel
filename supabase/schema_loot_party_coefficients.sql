-- L2 Clan Cabinet — «ДКП Пати»: коэффициент задаётся на саму пати (Админ-панель →
-- «Правила клана», список справа от коэффициентов профессий), а не считается как
-- среднее коэффициентов участников — тот же принцип, что у loot_class_coefficients,
-- только ключ — group_id вместо class_name.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_groups.sql, schema_loot_split_party.sql)

create table if not exists public.loot_party_coefficients (
  clan_id uuid not null references public.clans(id) on delete cascade,
  group_id uuid not null references public.clan_groups(id) on delete cascade,
  coefficient numeric not null default 1,
  primary key (clan_id, group_id)
);

alter table public.loot_party_coefficients enable row level security;

drop policy if exists "loot_party_coefficients_select" on public.loot_party_coefficients;
create policy "loot_party_coefficients_select" on public.loot_party_coefficients for select
  using (clan_id in (select clan_id from public.profiles where id = auth.uid()));
drop policy if exists "loot_party_coefficients_write_admins" on public.loot_party_coefficients;
create policy "loot_party_coefficients_write_admins" on public.loot_party_coefficients for all
  using (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  )
  with check (
    public.current_role_key() in ('glavadmin','admin')
    and clan_id in (select clan_id from public.profiles where id = auth.uid())
  );
