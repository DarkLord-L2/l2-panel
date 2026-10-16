-- L2 Clan Cabinet — «Отчёты по мероприятиям»: откуда взялась правка профессии (вручную или распознана по иконке на скрине).
-- Распознанные по иконкам профессии (js/class-icon-match.js) пишутся в report_class_overrides с source = 'auto'.
-- Ручные правки (клик по аватарке в «Отчётах») остаются source = 'manual' и ВСЕГДА главнее: повторная загрузка скрина
-- их не перезаписывает, а свои автоматические значения (auto) обновляет.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_report_class_overrides.sql). Можно запускать повторно.
-- Без этого файла всё работает: автоматические правки просто не отличаются от ручных (ручные при этом тоже не затираются).

alter table public.report_class_overrides add column if not exists source text not null default 'manual';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'report_class_overrides_source_chk') then
    alter table public.report_class_overrides
      add constraint report_class_overrides_source_chk check (source in ('manual', 'auto'));
  end if;
end $$;
