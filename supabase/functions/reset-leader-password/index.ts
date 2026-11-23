// Edge Function: reset-leader-password
// Вызывается только из owner-console.html (платформенный супер-админ). Если клан потерял доступ (лидер забыл пароль),
// владелец платформы задаёт лидеру новый временный пароль: тот же формат и те же правила, что у create-clan —
// пароль показывается один раз, лидер обязан сменить его при первом входе (must_change_password = true).
// Вызывающий проверяется через public.is_platform_admin() под его же JWT, не под service-role.
// Деплой: supabase functions deploy reset-leader-password

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

// без похожих символов (0/O, 1/l) — чтобы легко продиктовать/скопировать
function generateTempPassword(length = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
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

  // лидер клана — аккаунт с ролью glavadmin; если их несколько, берём того, чей логин записан в clans.leader_username
  const { data: clan, error: clanErr } = await admin.from("clans").select("id, leader_username").eq("id", clanId).single();
  if (clanErr || !clan) return json({ error: "clan_not_found" }, 404);

  const { data: leaders, error: leadersErr } = await admin
    .from("profiles")
    .select("id, username, roles!inner(key)")
    .eq("clan_id", clanId)
    .eq("roles.key", "glavadmin");
  if (leadersErr || !leaders || !leaders.length) return json({ error: "leader_not_found" }, 404);

  const leader = leaders.find((p) => p.username === clan.leader_username) ?? leaders[0];

  const tempPassword = generateTempPassword();
  const { error: updErr } = await admin.auth.admin.updateUserById(leader.id, { password: tempPassword });
  if (updErr) return json({ error: updErr.message }, 400);

  const { error: flagErr } = await admin.from("profiles").update({ must_change_password: true }).eq("id", leader.id);
  if (flagErr) return json({ error: flagErr.message }, 400);

  return json({ ok: true, username: leader.username, temp_password: tempPassword });
});
