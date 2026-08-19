-- L2 Clan Cabinet — «ДКП»: группа в меню из двух пунктов — «ДКП Соло» (это же
-- «Раздел дропа», просто переименован) и новый «ДКП Пати» (тот же расчёт голды,
-- но по пати целиком: начальные баллы — суммарная явка участников пати, % буста
-- и коэффициент — их среднее по пати).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_loot_split.sql,
-- schema_groups.sql, schema_clan_groups_hidden.sql)

update public.sections set label = 'ДКП Соло' where key = 'loot_split';

insert into public.sections (key, label, sort)
values ('loot_split_party', 'ДКП Пати', 56)
on conflict (key) do nothing;

-- виден всем ролям во всех кланах по умолчанию, как и остальные не-админские разделы
insert into public.role_sections (clan_id, role_id, section_key, visible)
select c.id, r.id, 'loot_split_party', true
from public.clans c
cross join public.roles r
on conflict (clan_id, role_id, section_key) do nothing;
