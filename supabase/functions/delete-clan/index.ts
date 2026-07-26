// Edge Function: delete-clan
// Вызывается только из owner-console.html. НЕОБРАТИМО удаляет клан целиком:
// сперва все аккаунты его участников (auth.users — это каскадом сносит их
// profiles), затем саму строку в clans — а это уже каскадом сносит всё
// остальное (census_entries, clan_groups/_members, member_classes, boost_*,
// tax_*, attendance_*, role_sections, parties), у всех этих таблиц
// clan_id references public.clans(id) on delete cascade.
// Требует, чтобы вызывающий был платформенным супер-админом — проверяется
// через public.is_platform_admin() под его же JWT, не под service-role.

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

  const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_platform_admin");
  if (adminErr || !isAdmin) {
    return json({ error: "forbidden" }, 403);
  }

  let body: { clan_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const clanId = body.clan_id ?? "";
  if (!clanId) {
    return json({ error: "missing_clan_id" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: clanRow, error: clanErr } = await admin
    .from("clans")
    .select("id")
    .eq("id", clanId)
    .single();
  if (clanErr || !clanRow) {
    return json({ error: "clan_not_found" }, 404);
  }

  // сначала все аккаунты участников — profiles.clan_id НЕ каскадный от clans,
  // поэтому строку клана нельзя будет удалить, пока хоть один профиль на неё ссылается
  const { data: memberProfiles, error: membersErr } = await admin
    .from("profiles")
    .select("id")
    .eq("clan_id", clanId);
  if (membersErr) {
    return json({ error: membersErr.message }, 400);
  }

  const failedDeletes: string[] = [];
  for (const m of memberProfiles ?? []) {
    const { error: delErr } = await admin.auth.admin.deleteUser(m.id);
    if (delErr) failedDeletes.push(m.id);
  }
  if (failedDeletes.length) {
    // часть участников не удалилась — клан намеренно не трогаем дальше, чтобы
    // не оставить его в ещё более странном промежуточном состоянии
    return json({ error: "some_members_not_deleted", failed_ids: failedDeletes }, 500);
  }

  const { error: clanDelErr } = await admin.from("clans").delete().eq("id", clanId);
  if (clanDelErr) {
    return json({ error: clanDelErr.message }, 400);
  }

  return json({ ok: true });
});
