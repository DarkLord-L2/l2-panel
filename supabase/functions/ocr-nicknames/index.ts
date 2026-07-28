// Edge Function: ocr-nicknames
// Вызывается только из census.html (и позже из налогов). Принимает один скриншот
// (data URL, base64), отдаёт его в Gemini с промптом «верни только список ников»,
// возвращает распознанные ники. Требует роль glavadmin или admin.
//
// SUPABASE_URL / SUPABASE_ANON_KEY подставляются Supabase автоматически.
// GEMINI_API_KEY — секрет, который нужно задать вручную в Supabase Dashboard
// (Edge Functions → Secrets), сюда его никто не передаёт и в браузере он не появляется.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = "gemini-3.1-flash-lite";

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

const PROMPT = [
  "This is a screenshot from a game client showing a vertical list of player nicknames.",
  "Extract every nickname EXACTLY as written, character-for-character — preserve original case, and keep every digit, hyphen, underscore or other symbol that is part of the nickname text itself.",
  "Nicknames often include a numeric prefix or suffix, e.g. \"3-Echo\", \"RastaDwarf420\" — these numbers/hyphens are part of the name and must NEVER be dropped or treated as noise.",
  "Only ignore elements that are clearly separate UI chrome and NOT part of the nickname string: list bullet/index numbers rendered in their own column, icons, HP/MP/level bars, timestamps.",
  "If you are unsure whether a character belongs to the nickname, KEEP it rather than drop it — do not silently normalize or shorten names.",
  "One nickname per entry.",
  "Respond with ONLY a JSON array of strings — no markdown, no code fences, no explanation.",
  'Example response: ["NickOne","3-NickTwo","NickThree_99"]',
].join(" ");

function parseDataUrl(dataUrl: string){
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if(!m) return { mimeType: "image/png", base64: dataUrl };
  return { mimeType: m[1], base64: m[2] };
}

function extractNicknames(text: string): string[] {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  if(fence) t = fence[1];
  try{
    const parsed = JSON.parse(t);
    if(Array.isArray(parsed)) return parsed.filter(x => typeof x === "string").map(s => s.trim()).filter(Boolean);
  }catch{
    // не JSON — оставляем пустой список, фронт покажет "не распознано"
  }
  return [];
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
  if (profileErr || !["glavadmin", "admin"].includes(callerRoleKey ?? "")) {
    return json({ error: "forbidden" }, 403);
  }

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  if (!body.image) {
    return json({ error: "missing_image" }, 400);
  }
  const { mimeType, base64 } = parseDataUrl(body.image);

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => "");
    console.error("gemini_request_failed", geminiRes.status, errText);
    return json({ error: "gemini_request_failed", detail: `HTTP ${geminiRes.status}: ${errText.slice(0, 300)}` }, 502);
  }

  const geminiData = await geminiRes.json();
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const nicknames = extractNicknames(text);

  return json({ nicknames });
});
