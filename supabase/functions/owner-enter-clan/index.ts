// Edge Function: owner-enter-clan
// Вызывается только из owner-console.html («Войти в клан»). Позволяет владельцу платформы посмотреть клан изнутри, не заводя
// там своего пользователя: функция выдаёт одноразовый токен входа под аккаунтом клан-лидера этого клана (без отправки писем,
// пароль лидера НЕ меняется). Сайт после этого включает режим «только чтение» (запись блокируется в js/supabase-client.js).
// Каждый вход записывается в public.owner_access_log — клан-лидер при желании может узнать, что владелец заходил.
// Вызывающий проверяется через public.is_platform_admin() под его же JWT, не под service-role.
// Деплой: supabase functions deploy owner-enter-clan   (или через панель Supabase: Edge Functions → Deploy a new function)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthenticated" }, 401);

  const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_platform_admin");
  if (adminErr || !isAdmin) {
    // причина в тексте ошибки: либо сбой самой проверки, либо не владелец, либо сессия без кода 2FA (aal1 при включённом require_mfa)
    let aal = "?";
    try { aal = JSON.parse(atob(authHeader.replace("Bearer ", "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal ?? "?"; } catch { /* не критично */ }
    return json({ error: "forbidden: " + (adminErr ? "rpc_error " + adminErr.message : "not_platform_admin") + " (aal=" + aal + ")" }, 403);
  }

  let body: { clan_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const clanId = body.clan_id ?? "";
  if (!clanId) return json({ error: "missing_clan_id" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: clan, error: clanErr } = await admin
    .from("clans")
    .select("id, name, display_name, leader_username")
    .eq("id", clanId)
    .single();
  if (clanErr || !clan) return json({ error: "clan_not_found" }, 404);

  // аккаунт для входа — клан-лидер (роль glavadmin); если их несколько, тот, чей логин записан в clans.leader_username
  const { data: leaders, error: leadersErr } = await admin
    .from("profiles")
    .select("id, username, roles!inner(key)")
    .eq("clan_id", clanId)
    .eq("roles.key", "glavadmin");
  if (leadersErr || !leaders || !leaders.length) return json({ error: "leader_not_found" }, 404);
  const leader = leaders.find((p) => p.username === clan.leader_username) ?? leaders[0];

  const { data: leaderUser, error: leaderUserErr } = await admin.auth.admin.getUserById(leader.id);
  const email = leaderUser?.user?.email;
  if (leaderUserErr || !email) return json({ error: "leader_email_not_found" }, 400);

  // одноразовая ссылка входа: письмо НЕ отправляется, нам нужен только hashed_token для verifyOtp на стороне браузера
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) return json({ error: linkErr?.message ?? "link_failed" }, 400);

  // запись в журнал; если таблицы ещё нет (SQL не выполнен) — не мешаем входу
  await admin.from("owner_access_log").insert({ admin_id: userData.user.id, clan_id: clanId, leader_id: leader.id });

  return json({
    ok: true,
    token_hash: tokenHash,
    username: leader.username,
    clan_name: clan.display_name || clan.name,
  });
});
