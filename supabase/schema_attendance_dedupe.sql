-- L2 Clan Cabinet — «Журнал посещаемости»: убрать дубли явки и запретить их на уровне базы.
-- Причина дублей: при двойном нажатии «Сохранить» весь список ников записывался дважды, из-за чего в отчёте было
-- «39 из 38» и «107%», а в окне мероприятия каждый ник стоял два раза. Сайт теперь не даёт этого сделать,
-- а этот файл чистит то, что уже накопилось, и закрывает вопрос навсегда.
-- Данные не теряются: из одинаковых строк (то же мероприятие + тот же ник) остаётся самая ранняя.
-- Выполнить в Supabase Dashboard → SQL Editor. Повторный запуск безопасен.

-- 1) сколько лишних строк сейчас (можно запустить отдельно, ничего не меняет)
-- select count(*) from public.attendance_entries a
--   join public.attendance_entries b on a.event_id = b.event_id and a.nickname = b.nickname and (a.created_at, a.id) > (b.created_at, b.id);

-- 2) удалить дубли, оставив самую раннюю запись
delete from public.attendance_entries a
using public.attendance_entries b
where a.event_id = b.event_id
  and a.nickname = b.nickname
  and (a.created_at, a.id) > (b.created_at, b.id);

-- 3) один ник — одна запись на мероприятие (дальше повторная запись просто пропускается)
create unique index if not exists attendance_entries_event_nick_uniq
  on public.attendance_entries (event_id, nickname);
