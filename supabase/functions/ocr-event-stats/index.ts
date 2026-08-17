// Edge Function: ocr-event-stats
// Вызывается из «Журнала посещаемости» (js/event-roster.js) и reports.html.
// Принимает один скриншот (data URL, base64) со списком пати и колонками
// Килы/Смерти/K:D/PvP урон/PvE урон, отдаёт его в Gemini с промптом «верни
// таблицу как JSON», возвращает распознанные строки. Требует роль glavadmin
// или admin. K:D не запрашивается у модели — это производная величина
// (kills/deaths), фронт считает её сам, чтобы не путать с уроном.
//
// Распознавание класса персонажа по иконке пробовали — сначала за один проход,
// потом двумя (bbox + отдельная классификация иконки через Gemini), потом
// локальным пиксельным сравнением на фронте — и в итоге убрали целиком: ник и
// цифры модель читает надёжно, а иконку (маленькая, 36 похожих вариантов) не
// удалось распознавать стабильно ни одним из способов. Профессия участника
// по-прежнему видна в «Группах»/«Проверке буста» (member_classes) — просто не
// автоматизирована по скрину явки.
//
// SUPABASE_URL / SUPABASE_ANON_KEY подставляются Supabase автоматически.
// GEMINI_API_KEY — тот же секрет, что уже задан для ocr-nicknames (Edge Functions → Secrets).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
// Задача — простое чтение текста/цифр из таблицы, flash-lite для этого хватает
// с запасом (тяжёлая визуальная классификация иконок, ради которой раньше
// ставили pro первой в очереди, отсюда убрана). Перебираем по кругу: первая
// рабочая модель из списка используется, на 429/503/404 сразу пробуем
// следующую (404 бывает по двум причинам: модель недоступна конкретно этому
// Google-аккаунту, ИЛИ Google реально отключил версию — так и умерла
// "gemini-2.0-flash" в этом списке, 2026-08). Только self-updating алиасы
// (-latest — их Google сам переключает на актуальную модель), никаких
// дат-пиновок: они гарантированно протухают со временем, а алиас с тем же
// уровнем возможностей — нет.
const GEMINI_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-pro-latest",
];

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

const STATS_PROMPT = [
  "This is a screenshot from a game client showing a party member stats table.",
  "Columns typically include, in some order: a small class icon, member/nickname, kills, deaths, K/D ratio, PvP damage, PvE damage.",
  "For every row, extract: the nickname, the kills count, the deaths count, the PvP damage number, and the PvE damage number. Ignore the class icon column entirely — do not try to identify or describe it.",
  "The nickname must be copied EXACTLY as written, character-for-character — preserve original case, and keep every digit, hyphen, underscore or other symbol that is part of the nickname text itself.",
  "Nicknames often include a numeric prefix or suffix, e.g. \"3-Echo\", \"RastaDwarf420\" — these numbers/hyphens are part of the name and must NEVER be dropped or confused with the row's stat columns.",
  "If you are unsure whether a character belongs to the nickname, KEEP it rather than drop it — do not silently normalize or shorten names.",
  "Ignore any K/D or ratio column entirely — do not return it, it will be computed separately.",
  "Damage numbers may contain thousands separators (commas or spaces) — return them as plain integers without separators.",
  "If a numeric cell is empty or unreadable, use 0.",
  "Respond with ONLY a JSON array of objects — no markdown, no code fences, no explanation.",
  'Example response: [{"nickname":"3-NickOne","kills":21,"deaths":18,"pvp_damage":814,"pve_damage":253}]',
].join(" ");

function parseDataUrl(dataUrl: string){
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if(!m) return { mimeType: "image/png", base64: dataUrl };
  return { mimeType: m[1], base64: m[2] };
}

function toInt(v: unknown): number {
  if(typeof v === "number" && isFinite(v)) return Math.round(v);
  if(typeof v === "string"){
    const n = Number(v.replace(/[,\s]/g, ""));
    if(isFinite(n)) return Math.round(n);
  }
  return 0;
}

type StatRow = {
  nickname: string; kills: number; deaths: number; pvp_damage: number; pve_damage: number;
};

function stripFence(text: string): string {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  return fence ? fence[1] : t;
}

function extractStats(text: string): StatRow[] {
  try{
    const parsed = JSON.parse(stripFence(text));
    if(!Array.isArray(parsed)) return [];
    return parsed
      .filter(x => x && typeof x === "object" && typeof x.nickname === "string" && x.nickname.trim())
      .map(x => ({
        nickname: x.nickname.trim(),
        kills: toInt(x.kills),
        deaths: toInt(x.deaths),
        pvp_damage: toInt(x.pvp_damage),
        pve_damage: toInt(x.pve_damage),
      }));
  }catch{
    // не JSON — оставляем пустой список, фронт покажет "не распознано"
    return [];
  }
}

// Google иногда отвечает очень медленно — без своего таймаута fetch может
// висеть, пока саму edge-функцию не убьёт по ЕЁ лимиту времени сама платформа
// Supabase — тогда клиент получает голый обрыв соединения (нестандартный
// HTTP-код вроде 546) вместо понятной JSON-ошибки, и ни о каком переключении
// на следующую модель речи уже не идёт. 25с на попытку — заведомо меньше
// лимита платформы, чтобы на зависшей модели успеть отвалиться и попробовать
// следующую, а не рухнуть всей функцией разом.
const GEMINI_TIMEOUT_MS = 25000;

async function callGemini(parts: unknown[]){
  let lastErr: Error | null = null;
  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            // низкая температура — это извлечение по фиксированной схеме, а не
            // творческая задача; модельный дефолт (~1) даёт больше "выдумывания"
            // и нестабильности между одинаковыми запросами, чем здесь нужно
            generationConfig: { temperature: 0.1 },
          }),
          signal: controller.signal,
        }
      );
    } catch (err) {
      // таймаут (controller.abort()) или сетевой сбой — для fallback-цикла это
      // ровно то же самое, что и 503: у следующей модели свои шансы, пробуем её
      console.error("gemini_request_timeout_or_network", model, err instanceof Error ? err.message : String(err));
      lastErr = err instanceof Error ? err : new Error(String(err));
      continue;
    } finally {
      clearTimeout(timeoutId);
    }
    if (res.ok) {
      const data = await res.json();
      console.log("gemini_model_used", model);
      return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }
    const errText = await res.text().catch(() => "");
    console.error("gemini_request_failed", model, res.status, errText);
    lastErr = new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
    // квота (429), временная перегрузка (503) или модель недоступна конкретно
    // этому аккаунту (404) — у следующей модели в списке свои квота/доступность,
    // есть смысл пробовать её; на любой другой ошибке (400/403 и т.п. — то есть
    // проблема в самом запросе, а не в конкретной модели) смысла перебирать
    // дальше нет, она повторится и на остальных
    if (res.status !== 429 && res.status !== 503 && res.status !== 404) break;
  }
  throw lastErr ?? new Error("gemini_request_failed");
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

  try {
    const { mimeType, base64 } = parseDataUrl(body.image);
    const parts: unknown[] = [
      { text: STATS_PROMPT },
      { inline_data: { mime_type: mimeType, data: base64 } },
    ];
    const text = await callGemini(parts);
    console.log("stats raw:", text);
    const stats = extractStats(text);
    console.log("stats parsed:", JSON.stringify(stats));
    return json({ stats });
  } catch (err) {
    return json({ error: "gemini_request_failed", detail: err instanceof Error ? err.message : String(err) }, 502);
  }
});
