// Edge Function: set-delete-protection
// Вызывается только из admin.html. Главный админ вписывает СВОЙ пароль (любой, на
// свой выбор) — сервер хеширует его (SHA-256 + случайная соль) и помечает СОБСТВЕННЫЙ
// аккаунт delete_protected=true. После этого другие главные админы того же клана не
// смогут удалить эту учётку без этого же пароля (или мастер-сид-фразы, см.
// remove-delete-protection / delete-user).
//
// Пароль хешируется только здесь, на сервере — в открытом виде никуда не попадает.

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

function randomSaltHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
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
  if (!phrase || phrase.length < 4) {
    return json({ error: "phrase_too_short" }, 400);
  }

  const salt = randomSaltHex();
  const hash = await hashPhrase(phrase, salt);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error: updErr } = await admin
    .from("profiles")
    .update({ delete_protected: true, delete_protection_hash: hash, delete_protection_salt: salt })
    .eq("id", userData.user.id);
  if (updErr) {
    return json({ error: updErr.message }, 400);
  }

  return json({ ok: true });
});
