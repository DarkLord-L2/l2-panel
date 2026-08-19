-- L2 Clan Cabinet — «Раздача»: кто с каким пати-лидером сколько раз был в одной
-- группе на скринах «Журнала посещаемости», чтобы лидер знал, кому и сколько раз
-- он должен передать долю при разделе денег/дропа лично (не через ДКП-расчёт).
--
-- Лидера на скрине не распознаём отдельным ОСР-полем (это был бы новый источник
-- ошибок) — просто помечаем ПЕРВЫЙ по порядку валидный ник в скрине лидером:
-- в игре лидер пати всегда идёт первой строкой в таблице участников (см. event-roster.js).
--
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_event_stats.sql,
-- schema_event_screenshot_batches.sql, schema_event_stats_ocr_class.sql)

alter table public.event_stats add column if not exists is_party_leader boolean not null default false;

insert into public.sections (key, label, sort)
values ('loot_payout', 'Раздача', 58)
on conflict (key) do nothing;

-- виден всем ролям во всех кланах по умолчанию, как и остальные разделы ДКП
insert into public.role_sections (clan_id, role_id, section_key, visible)
select c.id, r.id, 'loot_payout', true
from public.clans c
cross join public.roles r
on conflict (clan_id, role_id, section_key) do nothing;
