// Edge Function: ocr-event-stats
// Вызывается из «Журнала посещаемости» (js/event-roster.js) и reports.html.
// Принимает один скриншот (data URL, base64) со списком пати и колонками
// Килы/Смерти/K:D/PvP урон/PvE урон, отдаёт его в Gemini с промптом «верни
// таблицу как JSON», возвращает распознанные строки. Требует роль glavadmin
// или admin. K:D не запрашивается у модели — это производная величина
// (kills/deaths), фронт считает её сам, чтобы не путать с уроном.
// Заодно просим распознать класс персонажа по маленькой иконке в строке —
// event-roster.js при сохранении явки сам заполняет им member_classes для
// тех, у кого класс ещё не указан.
//
// SUPABASE_URL / SUPABASE_ANON_KEY подставляются Supabase автоматически.
// GEMINI_API_KEY — тот же секрет, что уже задан для ocr-nicknames (Edge Functions → Secrets).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
// flash-lite достаточно для простого чтения текста (см. ocr-nicknames), но для
// тонкого 35-вариантного визуального различения похожих иконок классов точности
// не хватало — тут нужна модель посильнее. (Пробовали ещё слать модели эталонные
// иконки из assets/classes для сверки — убрали: сам набор картинок там разнородный
// [портреты/арт/иконки скиллов], не то, что реально в партийном окне игры, поэтому
// как эталон только сбивало с толку. Точность теперь только на самом промпте ниже.)
// Перебор конкретных версий бил мимо: gemini-2.5-pro упирается в квоту (429),
// gemini-2.5-flash задепрекейтили для новых аккаунтов (404). Берём алиас
// "-latest" от самого Google — он всегда указывает на актуальную нележалую
// flash-модель, конкретная версия под ним может меняться сама по себе
const GEMINI_MODEL = "gemini-flash-latest";

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

// Тот же список финальных (3rd) классов, что в js/classes.js (window.L2_CLASSES) —
// держим его прямо в промпте, чтобы модель не придумывала свои названия/переводы,
// а выбирала точное совпадение из фиксированного словаря, который дальше match-ится
// на 1:1 с window.L2_CLASS_ICON на фронте.
const CLASS_NAMES = [
  "Dreadnought", "Duelist", "Phoenix Knight", "Hell Knight", "Adventurer",
  "Sagittarius", "Archmage", "Soultaker", "Arcana Lord", "Cardinal", "Hierophant",
  "Eva's Templar", "Sword Muse", "Wind Rider", "Moonlight Sentinel", "Mystic Muse",
  "Elemental Master", "Eva's Saint", "Shillien Templar", "Spectral Dancer",
  "Ghost Hunter", "Ghost Sentinel", "Storm Screamer", "Spectral Master",
  "Shillien Saint", "Titan", "Grand Khavatari", "Dominator", "Doomcryer",
  "Fortune Seeker", "Maestro", "Doombringer", "Soul Hound", "Judicator",
  "Female Soul Hound", "Trickster",
];

const PROMPT = [
  "This is a screenshot from a game client showing a party member stats table.",
  "Columns typically include, in some order: a small class icon, member/nickname, kills, deaths, K/D ratio, PvP damage, PvE damage.",
  "For every row, extract: the nickname, the kills count, the deaths count, the PvP damage number, the PvE damage number, and the character class shown by the small icon in that row (usually the leftmost column, right before or next to the nickname).",
  "The nickname must be copied EXACTLY as written, character-for-character — preserve original case, and keep every digit, hyphen, underscore or other symbol that is part of the nickname text itself.",
  "Nicknames often include a numeric prefix or suffix, e.g. \"3-Echo\", \"RastaDwarf420\" — these numbers/hyphens are part of the name and must NEVER be dropped or confused with the row's stat columns.",
  "If you are unsure whether a character belongs to the nickname, KEEP it rather than drop it — do not silently normalize or shorten names.",
  "For the class icon, identify it as a Lineage 2 THIRD-CLASS (final class) job icon and return the EXACT name from this fixed list, matched to the icon's silhouette/weapon/colors: " + CLASS_NAMES.join(", ") + ".",
  "Pay extra attention to these specific pairs, which have been observed to be confused with each other in real screenshots — look very carefully at weapon type, race and robe/armor color before deciding between them: " +
    "(1) \"Cardinal\" (Human priest — light-colored robes, mace/staff, healer) vs \"Storm Screamer\" (Dark Elf mystic — dark purple/black robes, debuffer, no melee weapon); " +
    "(2) \"Phoenix Knight\" (Human paladin — sword and shield, heavy plate armor, phoenix-themed crest) vs \"Titan\" (Orc warrior — heavy dual-wield or two-handed weapon, no shield) vs \"Sagittarius\" (archer — holding a bow, light/leather armor, no shield); " +
    "(3) \"Storm Screamer\" vs \"Ghost Hunter\" (Kamael assassin — dual daggers, dark agile armor, no robe); " +
    "(4) \"Dreadnought\" (Orc warrior — huge two-handed crushing weapon, tribal/bone ornamentation, brutish silhouette) vs \"Titan\" (Orc warrior — heavy dual-wield or two-handed bladed/axe weapon, descended from Destroyer) — both are heavy Orc melee icons and are VERY often mixed up; look very carefully at the weapon shape (blunt crushing weapon = Dreadnought, bladed/axe weapon = Titan) rather than guessing — do not default to either one when uncertain, re-examine the weapon silhouette instead; " +
    "(5) \"Sagittarius\" (archer — any bow or arrows visible) vs \"Phoenix Knight\" — if a bow is visible, it is always Sagittarius, never Phoenix Knight, regardless of armor color; " +
    "(6) \"Phoenix Knight\" (Human paladin — sword and shield, heavy ornate plate armor, phoenix crest) vs \"Grand Khavatari\" (Orc monk — bare fists/claws or kick stance, tribal leather, no weapon and no shield) — these are visually very different, do not default to Grand Khavatari when a weapon or shield is clearly visible; " +
    "(7) \"Elemental Master\" (Human/Elf elemental summoner — staff, a small elemental spirit creature floating near the character) vs \"Cardinal\" (Human priest — mace or staff, plain light-colored robe, no elemental spirit companion); " +
    "(8) \"Shillien Templar\" (Dark Elf paladin — sword and shield, dark ornate plate armor) vs \"Spectral Dancer\" (Dark Elf dancer — dual blades or fans, no shield, dance/performance pose, no heavy armor); " +
    "(9) \"Shillien Templar\" (Dark Elf paladin — always has a visible SHIELD in the off-hand) vs \"Ghost Hunter\" (Kamael assassin — dual daggers or a single dagger, NEVER a shield, more agile/lighter armor silhouette) — presence of a shield means Shillien Templar, absence of a shield with dagger(s) means Ghost Hunter.",
  "These pairs are only examples of mistakes seen before — they are not the full list of possible classes. Apply the exact same careful silhouette/weapon/armor/race comparison to EVERY icon, including all the other classes in the list that aren't mentioned above; do not assume the class must be one of the classes named in these examples.",
  "Return the class name EXACTLY as spelled in that list (same capitalization/apostrophes). If the icon is missing, unreadable, or you cannot confidently match it to one of these exact classes, return null for class_name — never guess or invent a class name outside this list.",
  "Ignore any K/D or ratio column entirely — do not return it, it will be computed separately.",
  "Damage numbers may contain thousands separators (commas or spaces) — return them as plain integers without separators.",
  "If a numeric cell is empty or unreadable, use 0.",
  "Respond with ONLY a JSON array of objects — no markdown, no code fences, no explanation.",
  'Example response: [{"nickname":"3-NickOne","kills":21,"deaths":18,"pvp_damage":814,"pve_damage":253,"class_name":"Duelist"}]',
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

type StatRow = { nickname: string; kills: number; deaths: number; pvp_damage: number; pve_damage: number; class_name: string | null };

const CLASS_NAMES_LOWER = new Set(CLASS_NAMES.map(c => c.toLowerCase()));

// подстраховка сверх самого промпта: если модель всё же вернула что-то за
// пределами фиксированного списка, лучше молча выбросить это поле, чем
// протащить в member_classes значение, для которого нет иконки на фронте
function normalizeClassName(v: unknown): string | null {
  if(typeof v !== "string") return null;
  const trimmed = v.trim();
  const match = CLASS_NAMES.find(c => c.toLowerCase() === trimmed.toLowerCase());
  return match ?? (CLASS_NAMES_LOWER.has(trimmed.toLowerCase()) ? trimmed : null);
}

function extractStats(text: string): StatRow[] {
  let t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(t);
  if(fence) t = fence[1];
  try{
    const parsed = JSON.parse(t);
    if(!Array.isArray(parsed)) return [];
    return parsed
      .filter(x => x && typeof x === "object" && typeof x.nickname === "string" && x.nickname.trim())
      .map(x => ({
        nickname: x.nickname.trim(),
        kills: toInt(x.kills),
        deaths: toInt(x.deaths),
        pvp_damage: toInt(x.pvp_damage),
        pve_damage: toInt(x.pve_damage),
        class_name: normalizeClassName(x.class_name),
      }));
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
        // низкая температура — это классификация по фиксированному списку, а не
        // творческая задача; модельный дефолт (~1) даёт больше "выдумывания" и
        // нестабильности между одинаковыми запросами, чем здесь нужно
        generationConfig: { temperature: 0.1 },
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
  const stats = extractStats(text);

  return json({ stats });
});
