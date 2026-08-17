-- L2 Clan Cabinet — автоочистка просроченных ссылок «Поделиться»
-- report_shares раньше не чистился вообще: после expires_at строка переставала
-- быть видна через RLS (report_shares_select_public: expires_at > now()), но
-- физически оставалась в базе навсегда — при активном использовании фичи
-- «Поделиться» это росло бы бесконтрольно. Планируем ежедневную задачу через
-- pg_cron, которая физически удаляет строки через сутки после истечения
-- (небольшой запас, чтобы не зацепить строку в момент истечения).
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_report_shares.sql)

create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-expired-report-shares') then
    perform cron.unschedule('cleanup-expired-report-shares');
  end if;
end $$;

select cron.schedule(
  'cleanup-expired-report-shares',
  '0 3 * * *', -- каждый день в 03:00 UTC
  $$ delete from public.report_shares where expires_at < now() - interval '1 day'; $$
);
