-- L2 Clan Cabinet — брендинг/оформление клана (конструктор → «Оформление»)
-- Выполнить в Supabase Dashboard → SQL Editor (после schema.sql)
--
-- Один клан = один набор настроек внешнего вида, поэтому это просто колонки на
-- уже существующей public.clans, а не отдельная таблица. theme_preset выбирает
-- готовую цветовую схему (см. js/theme.css, [data-preset]); accent_color — не
-- обязательный точечный оверрайд акцента поверх выбранного пресета; display_name/
-- logo_url подменяют заголовок «Кабинет клана» и добавляют лого в шапку.

alter table public.clans add column if not exists theme_preset text not null default 'default';
alter table public.clans add column if not exists accent_color text;
alter table public.clans add column if not exists display_name text;
alter table public.clans add column if not exists logo_url text;
