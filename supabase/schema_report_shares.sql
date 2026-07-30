-- L2 Clan Cabinet — публичные ссылки «Поделиться» на снимок отчёта (Посещаемость,
-- Налоги). Выполнить в Supabase Dashboard → SQL Editor (после schema_platform_admin.sql)
--
-- Ссылка ведёт на share.html?id=<uuid> — отдельную страницу БЕЗ логина. Вместо
-- того чтобы открывать анониму доступ к «живым» защищённым таблицам (attendance_entries,
-- tax_payments и т.п.), при клике «Поделиться» таблица, как она отрисована СЕЙЧАС
-- (с учётом текущих фильтров/периода), замораживается снимком в этой отдельной
-- таблице. id — uuid (128 бит), угадать его перебором нереально, поэтому отдельный
-- пароль для просмотра не нужен — сама ссылка и есть секрет. Просрочка — по
-- expires_at, без отдельной задачи на чистку: RLS просто перестаёт отдавать
-- строку после дедлайна, а сама строка тихо остаётся в таблице.

create table public.report_shares (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  title text not null,
  columns jsonb not null,        -- [{"key":"c0","label":"Никнейм"}, ...]
  search_column text,            -- ключ колонки, по которой ищем (обычно ник)
  rows jsonb not null,           -- [{"c0":"...", "c1":"...", ...}, ...]
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.report_shares enable row level security;

-- читает кто угодно (в т.ч. анонимно, без сессии) — но только пока не истёк срок
create policy "report_shares_select_public" on public.report_shares for select
  using (expires_at > now());

-- создавать снимок может любой залогиненный участник СВОЕГО клана (та же
-- популяция, что и так уже видит эти отчёты и могла бы просто скопировать
-- данные руками — публикация снимка ничего дополнительно не открывает)
create policy "report_shares_insert_own_clan" on public.report_shares for insert
  with check (clan_id = public.current_clan_id());
