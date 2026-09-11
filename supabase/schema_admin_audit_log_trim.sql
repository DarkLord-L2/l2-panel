-- Лог действий администраторов: держим только последние 10 записей на клан,
-- чтобы не копилось бесконечно. Триггер на уровне БД (не в JS) — так обрезка
-- надёжна независимо от того, кто и как пишет в таблицу, без гонок между
-- несколькими одновременными действиями. SECURITY DEFINER — чтобы триггеру не
-- нужна была отдельная policy "админ может удалять записи лога" (её нет и не
-- будет: приложение само log-записи не удаляет, только читает и добавляет).
create or replace function public.trim_admin_audit_log() returns trigger
language plpgsql security definer as $$
begin
  delete from public.admin_audit_log
  where clan_id = new.clan_id
    and id not in (
      select id from public.admin_audit_log
      where clan_id = new.clan_id
      order by created_at desc
      limit 10
    );
  return null;
end;
$$;

drop trigger if exists trim_admin_audit_log_trigger on public.admin_audit_log;
create trigger trim_admin_audit_log_trigger
  after insert on public.admin_audit_log
  for each row execute function public.trim_admin_audit_log();
