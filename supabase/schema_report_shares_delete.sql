-- L2 Clan Cabinet — право удалять свои ссылки «Поделиться» (Админ-панель → «Ссылки»)
-- Выполнить в Supabase Dashboard → SQL Editor (после schema_report_shares.sql)
--
-- schema_report_shares.sql завёл только select (публичный, по сроку) и insert
-- (свой клан) — без отдельной policy на delete RLS блокирует любое удаление.

create policy "report_shares_delete_own_clan" on public.report_shares for delete
  using (clan_id = public.current_clan_id());
