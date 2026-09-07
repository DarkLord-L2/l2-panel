-- «Проверка буста»: необязательный скриншот-подсказка у раздела (например, «Бижа» —
-- кому какое украшение по классам). Вставляется через Ctrl+V прямо в интерфейсе,
-- хранится как data-URL (тот же подход, что и boost_items.icon) — отдельный
-- Storage-бакет не используется.
alter table public.boost_sections add column if not exists reference_image text;
