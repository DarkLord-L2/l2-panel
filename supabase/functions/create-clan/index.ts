// Edge Function: create-clan
// Вызывается только из owner-console.html (платформенный супер-админ, невидим
// для обычных пользователей). Создаёт новый клан + единственный аккаунт его
// «Клан-лидера» (роль glavadmin), с временным паролем, который нужно сменить
// при первом входе. Требует, чтобы вызывающий был платформенным супер-админом —
// проверяется через public.is_platform_admin() под его же JWT, не под service-role.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY подставляются Supabase
// автоматически для каждой Edge Function — вручную их задавать не нужно.

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

// временный пароль лидера — без похожих символов (0/O, 1/l), чтобы было легко
// продиктовать/скопировать; меняется всё равно при первом входе.
function generateTempPassword(length = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // 1. Кто вызывает — обычный клиент с JWT вызывающего, RLS работает как для него
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "unauthenticated" }, 401);
  }

  // is_platform_admin() читает auth.uid() из JWT вызывающего — не путать с service-role ниже
  const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_platform_admin");
  if (adminErr || !isAdmin) {
    return json({ error: "forbidden" }, 403);
  }

  // 2. Разбор запроса
  let body: { clan_name?: string; leader_username?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const clanName = (body.clan_name ?? "").trim();
  const leaderUsername = (body.leader_username ?? "").trim();

  if (!clanName || clanName.length > 80) {
    return json({ error: "invalid_clan_name" }, 400);
  }
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(leaderUsername)) {
    return json({ error: "invalid_username" }, 400);
  }

  // 3. Дальше — уже с service-role ключом, в обход RLS (только на сервере, никогда не в браузере)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: roleRow, error: roleErr } = await admin
    .from("roles")
    .select("id")
    .eq("key", "glavadmin")
    .single();
  if (roleErr || !roleRow) {
    return json({ error: "role_lookup_failed" }, 400);
  }

  const tempPassword = generateTempPassword();
  const email = `${leaderUsername.toLowerCase()}@l2clan.local`;

  // шаг 1: аккаунт лидера
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    return json({ error: createErr?.message ?? "create_failed" }, 400);
  }

  // шаг 2: сам клан
  const { data: clanRow, error: clanErr } = await admin
    .from("clans")
    .insert({ name: clanName, access_enabled: true, leader_username: leaderUsername })
    .select("id")
    .single();
  if (clanErr || !clanRow) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: clanErr?.message ?? "clan_create_failed" }, 400);
  }

  // шаг 3: профиль лидера — must_change_password, чтобы супер-админ больше не мог
  // войти этим паролем после передачи аккаунта
  const { error: profileErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username: leaderUsername,
    clan_id: clanRow.id,
    role_id: roleRow.id,
    party_id: null,
    created_by: userData.user.id,
    must_change_password: true,
  });
  if (profileErr) {
    await admin.from("clans").delete().eq("id", clanRow.id);
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: profileErr.message }, 400);
  }

  // шаг 4: без этого у нового клана role_sections будет пуст — лидер увидит
  // полностью пустую навигацию и не сможет даже открыть админ-панель, чтобы
  // включить разделы самому. Тот же паттерн видимости, что в сиде schema.sql.
  const [{ data: allRoles }, { data: allSections }] = await Promise.all([
    admin.from("roles").select("id, key"),
    admin.from("sections").select("key"),
  ]);
  const seedRows = (allRoles ?? []).flatMap((r) =>
    (allSections ?? [])
      .filter((s) => !(s.key === "admin" && r.key !== "glavadmin"))
      .map((s) => ({ clan_id: clanRow.id, role_id: r.id, section_key: s.key, visible: true }))
  );
  if (seedRows.length) {
    const { error: seedErr } = await admin.from("role_sections").insert(seedRows);
    if (seedErr) {
      await admin.from("profiles").delete().eq("id", created.user.id);
      await admin.from("clans").delete().eq("id", clanRow.id);
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: seedErr.message }, 400);
    }
  }

  return json({
    ok: true,
    clan_id: clanRow.id,
    id: created.user.id,
    username: leaderUsername,
    temp_password: tempPassword,
  });
});
