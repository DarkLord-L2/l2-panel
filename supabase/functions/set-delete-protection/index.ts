// Edge Function: set-delete-protection
// Вызывается только из admin.html. Главный админ вписывает кодовую фразу — если она
// совпадает с секретом DELETE_PROTECTION_SEED_PHRASE (задаётся в Supabase → Edge
// Functions → Secrets, в код не попадает), его СОБСТВЕННЫЙ аккаунт помечается
// delete_protected=true. После этого другие главные админы того же клана не смогут
// удалить эту учётку — только через отдельную фразу-снятие (remove-delete-protection).
//
// Фраза сверяется только здесь, на сервере — в браузер/исходники сайта она не попадает.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEED_PHRASE = (Deno.env.get("DELETE_PROTECTION_SEED_PHRASE") ?? "").trim();

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
    .select("roles(key)")
    .eq("id", userData.user.id)
    .single();

  const callerRoleKey = (callerProfile as { roles?: { key?: string } } | null)?.roles?.key;
  if (profileErr || callerRoleKey !== "glavadmin") {
    return json({ error: "forbidden" }, 403);
  }

  let body: { phrase?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const phrase = (body.phrase ?? "").trim();
  if (!SEED_PHRASE || !phrase || phrase !== SEED_PHRASE) {
    return json({ error: "invalid_phrase" }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error: updErr } = await admin
    .from("profiles")
    .update({ delete_protected: true })
    .eq("id", userData.user.id);
  if (updErr) {
    return json({ error: updErr.message }, 400);
  }

  return json({ ok: true });
});
