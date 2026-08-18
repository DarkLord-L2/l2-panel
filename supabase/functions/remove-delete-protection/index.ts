// Edge Function: remove-delete-protection
// Вызывается только из admin.html. Снимает delete_protected с аккаунта (свой или чужой
// в своём клане) — если введённая фраза совпадает либо с ХЕШЕМ ПАРОЛЯ, которым сам
// владелец аккаунта ставил защиту (set-delete-protection), либо с мастер-сид-фразой
// DELETE_PROTECTION_SEED_PHRASE (секрет в Supabase → Edge Functions → Secrets,
// известна только владельцу сайта и работает поверх ЛЮБОГО чужого пароля).
//
// Обе фразы сверяются только здесь, на сервере.

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

async function hashPhrase(phrase: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(salt + ":" + phrase);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
  if (profileErr || !callerProfile) {
    return json({ error: "forbidden" }, 403);
  }
  const callerRoleKey = (callerProfile as { roles?: { key?: string } }).roles?.key;
  const callerClanId = (callerProfile as { clan_id: string }).clan_id;

  let body: { phrase?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const phrase = (body.phrase ?? "").trim();
  const targetId = body.user_id || userData.user.id; // без user_id — снимаем со своего аккаунта
  if (!phrase) {
    return json({ error: "invalid_phrase" }, 403);
  }

  const isSelf = targetId === userData.user.id;
  // на чужой аккаунт может покуситься только главный админ того же клана —
  // самого себя снять может кто угодно, кто вообще смог зайти в Админ-панель
  if (!isSelf && callerRoleKey !== "glavadmin") {
    return json({ error: "forbidden" }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: targetProfile, error: targetErr } = await admin
    .from("profiles")
    .select("clan_id, delete_protection_hash, delete_protection_salt")
    .eq("id", targetId)
    .single();
  if (targetErr || !targetProfile || targetProfile.clan_id !== callerClanId) {
    return json({ error: "forbidden" }, 403);
  }

  const isSeedPhrase = !!SEED_PHRASE && phrase === SEED_PHRASE;
  let matchesOwnPassword = false;
  if (targetProfile.delete_protection_hash && targetProfile.delete_protection_salt) {
    const candidate = await hashPhrase(phrase, targetProfile.delete_protection_salt);
    matchesOwnPassword = candidate === targetProfile.delete_protection_hash;
  }
  if (!isSeedPhrase && !matchesOwnPassword) {
    return json({ error: "invalid_phrase" }, 403);
  }

  const { error: updErr } = await admin
    .from("profiles")
    .update({ delete_protected: false, delete_protection_hash: null, delete_protection_salt: null })
    .eq("id", targetId);
  if (updErr) {
    return json({ error: updErr.message }, 400);
  }

  return json({ ok: true });
});
