-- L2 Clan Cabinet — «Проверка буста»: лидер пати отмечает буст в своей группе
-- Раньше boost_member_values редактировали только glavadmin/admin. Добавляет
-- policy, разрешающую запись назначенному лидеру группы (clan_groups.leader_nickname,
-- см. schema_group_leader.sql) — но только для ников из его же группы, и только
-- пока сам лидер числится в этой группе (profiles.party_id = clan_groups.id) —
-- та же защита, что уже применяется в groups.html для управления карточками участников.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_gear_check.sql,
-- schema_platform_admin.sql и schema_group_leader.sql)

drop policy if exists "boost_member_values_write_party_leader" on public.boost_member_values;
create policy "boost_member_values_write_party_leader" on public.boost_member_values for all
  using (
    clan_id = public.current_clan_id()
    and exists (
      select 1
      from public.clan_group_members cgm
      join public.clan_groups cg on cg.id = cgm.group_id
      join public.profiles p on p.id = auth.uid()
      where cgm.nickname = boost_member_values.nickname
        and cg.id = p.party_id
        and cg.leader_nickname is not null
        and lower(cg.leader_nickname) = lower(p.nickname)
    )
  )
  with check (
    clan_id = public.current_clan_id()
    and exists (
      select 1
      from public.clan_group_members cgm
      join public.clan_groups cg on cg.id = cgm.group_id
      join public.profiles p on p.id = auth.uid()
      where cgm.nickname = boost_member_values.nickname
        and cg.id = p.party_id
        and cg.leader_nickname is not null
        and lower(cg.leader_nickname) = lower(p.nickname)
    )
  );
