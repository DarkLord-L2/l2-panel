// Edge Function: delete-user
// Вызывается только из admin.html. Удаляет учётку целиком (auth.users + связанный profiles —
// вторая часть уходит сама через "on delete cascade" в схеме).
// Требует, чтобы вызывающий был главным админом. SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY подставляются Supabase автоматически, вручную задавать не нужно.

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

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const targetId = body.user_id ?? "";
  if (!targetId) {
    return json({ error: "missing_user_id" }, 400);
  }
  if (targetId === userData.user.id) {
    return json({ error: "cannot_delete_self" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // проверяем клан удаляемого через service-role (обычный клиент вызывающего не увидит
  // чужой профиль по RLS) — без этой проверки лидер любого клана мог удалить
  // пользователя ЛЮБОГО другого клана по одному только UID.
  const { data: targetProfile, error: targetErr } = await admin
    .from("profiles")
    .select("clan_id")
    .eq("id", targetId)
    .single();
  if (targetErr || !targetProfile || targetProfile.clan_id !== (callerProfile as { clan_id: string }).clan_id) {
    return json({ error: "forbidden" }, 403);
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(targetId);
  if (deleteErr) {
    return json({ error: deleteErr.message }, 400);
  }

  return json({ ok: true });
});
