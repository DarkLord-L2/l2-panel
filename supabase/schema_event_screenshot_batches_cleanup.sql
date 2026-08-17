-- L2 Clan Cabinet — автоочистка осиротевших меток скринов явки.
-- event_screenshot_batches ничем физически не чистился: если все ники старого
-- скрина перезаписаны новой загрузкой (например, повторно залили тот же скрин
-- с поправками), старая batch-запись остаётся в базе навсегда, хотя на нее уже
-- не ссылается ни одна строка event_stats. Тот же паттерн pg_cron, что уже
-- используется в schema_report_shares_cleanup.sql.
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_event_screenshot_batches.sql)

create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-orphan-screenshot-batches') then
    perform cron.unschedule('cleanup-orphan-screenshot-batches');
  end if;
end $$;

select cron.schedule(
  'cleanup-orphan-screenshot-batches',
  '15 3 * * *', -- каждый день в 03:15 UTC, следом за cleanup-expired-report-shares
  $$
    delete from public.event_screenshot_batches b
    where b.created_at < now() - interval '1 day'
      and not exists (select 1 from public.event_stats s where s.batch_id = b.id);
  $$
);
