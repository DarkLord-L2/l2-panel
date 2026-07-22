// Edge Function: create-user
// Вызывается только из admin.html. Создаёт логин/пароль для нового человека клана.
// Требует, чтобы вызывающий был главным админом — проверяется его JWT и роль в profiles.
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

  const { data: callerProfile, error: profileErr } = await callerClient
    .from("profiles")
    .select("clan_id, roles(key)")
    .eq("id", userData.user.id)
    .single();

  const callerRoleKey = (callerProfile as { roles?: { key?: string } } | null)?.roles?.key;
  if (profileErr || callerRoleKey !== "glavadmin") {
    return json({ error: "forbidden" }, 403);
  }

  // 2. Разбор запроса
  let body: { username?: string; password?: string; role_key?: string; party_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  const roleKey = body.role_key ?? "";
  const partyId = body.party_id || null;

  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
    return json({ error: "invalid_username" }, 400);
  }
  if (password.length < 6) {
    return json({ error: "weak_password" }, 400);
  }

  // 3. Дальше — уже с service-role ключом, в обход RLS (только на сервере, никогда не в браузере)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: roleRow, error: roleErr } = await admin
    .from("roles")
    .select("id")
    .eq("key", roleKey)
    .single();
  if (roleErr || !roleRow) {
    return json({ error: "invalid_role" }, 400);
  }

  const email = `${username.toLowerCase()}@l2clan.local`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    return json({ error: createErr?.message ?? "create_failed" }, 400);
  }

  const { error: insertErr } = await admin.from("profiles").insert({
    id: created.user.id,
    username,
    clan_id: (callerProfile as { clan_id: string }).clan_id,
    role_id: roleRow.id,
    party_id: partyId,
    created_by: userData.user.id,
  });

  if (insertErr) {
    // без профиля учётка бесполезна и опасна (нет роли/клана) — откатываем создание
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: insertErr.message }, 400);
  }

  return json({ ok: true, id: created.user.id, username });
});
