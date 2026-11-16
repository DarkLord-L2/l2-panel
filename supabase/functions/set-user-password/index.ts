// Edge Function: set-user-password
// Вызывается только из admin.html (кнопка 🔗 «Ссылка для входа» у пользователя).
// Главный админ задаёт пользователю своего клана новый пароль — нужно, чтобы сделать
// одноразовую ссылку-приглашение для уже созданной учётки: старый пароль нигде не
// хранится в открытом виде, узнать его нельзя, поэтому ссылка идёт с новым паролем.
// Те же правила, что у delete-user: только glavadmin, только свой клан; защищённый
// аккаунт (delete_protected) — только с паролем защиты этого аккаунта или мастер-сид-фразой
// DELETE_PROTECTION_SEED_PHRASE; свой собственный пароль так менять нельзя
// (для этого есть обычная смена пароля — иначе легко выкинуть себя из всех сессий).
// Деплой: supabase functions deploy set-user-password

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

  const callerRoleKey = (callerProfile as { roles?: { key?: string } } | null)?.roles?.key;
  if (profileErr || callerRoleKey !== "glavadmin") {
    return json({ error: "forbidden" }, 403);
  }

  let body: { user_id?: string; password?: string; phrase?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const targetId = body.user_id ?? "";
  const password = body.password ?? "";
  const phrase = (body.phrase ?? "").trim();
  if (!targetId) return json({ error: "missing_user_id" }, 400);
  if (targetId === userData.user.id) return json({ error: "cannot_change_self" }, 400);
  if (password.length < 6) return json({ error: "weak_password" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // клан цели — через service-role (чужой профиль по RLS не виден); без этой проверки
  // лидер одного клана мог бы сменить пароль человеку другого клана по одному UID
  const { data: targetProfile, error: targetErr } = await admin
    .from("profiles")
    .select("clan_id, delete_protected, delete_protection_hash, delete_protection_salt")
    .eq("id", targetId)
    .single();
  if (targetErr || !targetProfile || targetProfile.clan_id !== (callerProfile as { clan_id: string }).clan_id) {
    return json({ error: "forbidden" }, 403);
  }

  if (targetProfile.delete_protected) {
    const isSeedPhrase = !!SEED_PHRASE && !!phrase && phrase === SEED_PHRASE;
    let matchesOwnPassword = false;
    if (phrase && targetProfile.delete_protection_hash && targetProfile.delete_protection_salt) {
      const candidate = await hashPhrase(phrase, targetProfile.delete_protection_salt);
      matchesOwnPassword = candidate === targetProfile.delete_protection_hash;
    }
    if (!isSeedPhrase && !matchesOwnPassword) {
      return json({ error: "protected" }, 403);
    }
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(targetId, { password });
  if (updErr) {
    return json({ error: updErr.message }, 400);
  }

  return json({ ok: true });
});
