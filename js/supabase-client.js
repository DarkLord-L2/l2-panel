// Общий модуль кабинета: подключение к Supabase, сессия, профиль, права по ролям.
// Подключать после <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
//
// ⚠️ TODO: вписать сюда данные вашего Supabase-проекта (Project Settings → API).
// Оба значения публичные (anon key рассчитан на то, чтобы быть виден в браузере) —
// реальная защита данных обеспечивается RLS-политиками в supabase/schema.sql, не секретностью этих строк.
const SUPABASE_URL = "https://owacpvydbqxdhrxxitlj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_eQhDBY7sz0esE6HwwfNUYA_tRh9_OvL";

const REMEMBER_KEY = "l2RememberMe";
const EMAIL_DOMAIN = "@l2clan.local";

function currentBackingStorage(){
  const remember = localStorage.getItem(REMEMBER_KEY) !== "0";
  return remember ? window.localStorage : window.sessionStorage;
}
// адаптер хранилища сессии: "запомнить меня" снята → токены живут в sessionStorage
// (переживают перезагрузку вкладки, но не переживают закрытие браузера/новую вкладку)
const sessionAwareStorage = {
  getItem: (k) => currentBackingStorage().getItem(k),
  setItem: (k, v) => currentBackingStorage().setItem(k, v),
  removeItem: (k) => currentBackingStorage().removeItem(k),
};

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: sessionAwareStorage, autoRefreshToken: true, persistSession: true },
});

function usernameToEmail(username){
  return username.trim().toLowerCase() + EMAIL_DOMAIN;
}

async function login(username, password, remember){
  localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  return client.auth.signInWithPassword({ email: usernameToEmail(username), password });
}

async function signOut(){
  await client.auth.signOut();
  location.href = "login.html";
}

// Вызывать в начале любой защищённой страницы. Без сессии — редирект на логин.
async function requireSession(){
  const { data: { session } } = await client.auth.getSession();
  if(!session){
    location.href = "login.html";
    return null;
  }
  return session;
}

// Профиль текущего пользователя вместе с ролью и пати.
// .maybeSingle(), не .single() — у платформенного супер-админа (и у любой учётки без
// строки в profiles, например незавершённо созданной) 0 строк — это ожидаемый случай,
// а не ошибка: .single() в такой ситуации бросает PGRST116 и рвёт всю страницу вместо
// того, чтобы дать index.html показать «Профиль не найден».
// Применяет оформление клана (конструктор → «Оформление») ко ТЕКУЩЕМУ документу —
// вызывается из getProfile(), поэтому срабатывает на каждой странице, включая
// каждый iframe-раздел (у каждого свой document, наследования CSS-переменных
// между iframe и родителем нет). accent_color — точечный оверрайд поверх пресета,
// применяется отдельно, чтобы клан мог подправить именно акцент, не теряя пресет.
function applyClanBranding(clan){
  if(!clan) return;
  document.documentElement.dataset.preset = clan.theme_preset || "default";
  if(clan.accent_color){
    document.documentElement.style.setProperty("--gold", clan.accent_color);
    document.documentElement.style.setProperty("--focus", clan.accent_color);
  }
}

// Профиль текущего пользователя вместе с ролью и пати.
// .maybeSingle(), не .single() — у платформенного супер-админа (и у любой учётки без
// строки в profiles, например незавершённо созданной) 0 строк — это ожидаемый случай,
// а не ошибка: .single() в такой ситуации бросает PGRST116 и рвёт всю страницу вместо
// того, чтобы дать index.html показать «Профиль не найден».
async function getProfile(){
  const { data: { user } } = await client.auth.getUser();
  if(!user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id, username, nickname, clan_id, party_id, must_change_password, roles(key, label, rank), clan_groups(name), clans(access_enabled, name, theme_preset, accent_color, display_name, logo_url)")
    .eq("id", user.id)
    .maybeSingle();
  if(error) throw error;
  applyClanBranding(data?.clans);
  return data;
}

// Разделы сайта, видимые роли (уже отсортированные для навигации). roleKey — например "glavadmin".
async function getVisibleSections(roleKey){
  const { data: roleRow, error: roleErr } = await client
    .from("roles").select("id").eq("key", roleKey).single();
  if(roleErr) throw roleErr;

  // порядок пунктов меню клан-лидер задаёт сам (Админ-панель → «Порядок разделов в меню»);
  // clan_section_order виден только своему клану, а чего в нём нет — идёт по sections.sort.
  // clan_section_toggles — отдельный, более грубый выключатель: раздел, выключенный на
  // весь клан («Разделы и права» → «Какие разделы вообще есть»), не покажется НИ ОДНОЙ
  // роли, даже если у роли стоит галочка видимости в role_sections.
  const [{ data, error }, { data: orderRows, error: orderErr }, { data: toggleRows, error: toggleErr }] = await Promise.all([
    client
      .from("role_sections")
      .select("visible, sections(key, label, sort)")
      .eq("role_id", roleRow.id)
      .eq("visible", true),
    client.from("clan_section_order").select("section_key, sort"),
    client.from("clan_section_toggles").select("section_key, enabled"),
  ]);
  if(error) throw error;
  if(orderErr) console.error(orderErr); // порядок не критичен — откатимся на sections.sort
  if(toggleErr) console.error(toggleErr); // тоже не критично — откатимся на «все разделы включены»

  const customSort = new Map((orderRows || []).map(r => [r.section_key, r.sort]));
  // отсутствие строки в clan_section_toggles = раздел включён (значение по умолчанию)
  const disabledKeys = new Set((toggleRows || []).filter(r => r.enabled === false).map(r => r.section_key));

  return (data || [])
    .map(row => row.sections)
    .filter(Boolean)
    .filter(s => s.key === "admin" || !disabledKeys.has(s.key))
    .sort((a, b) => (customSort.get(a.key) ?? a.sort) - (customSort.get(b.key) ?? b.sort));
}

// Создание нового пользователя — только для главного админа, идёт через Edge Function
// (там же живёт service-role ключ, в браузере его нет и быть не должно).
async function adminCreateUser({ username, password, nickname, role_key, party_id }){
  const { data: { session } } = await client.auth.getSession();
  if(!session) throw new Error("no_session");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ username, password, nickname: nickname || null, role_key, party_id: party_id || null }),
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(body.error || "request_failed");
  return body;
}

// Удаление пользователя — тоже только для главного админа, тоже через Edge Function
// (нужен service-role, чтобы удалить саму учётку в auth.users, не только строку в profiles).
// phrase нужен, только если аккаунт защищён (delete_protected) — пароль защиты
// этого же аккаунта либо мастер-сид-фраза; для незащищённых можно не передавать
async function adminDeleteUser(userId, phrase){
  const { data: { session } } = await client.auth.getSession();
  if(!session) throw new Error("no_session");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ user_id: userId, phrase }),
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(body.error || "request_failed");
  return body;
}

// Защита своего аккаунта от удаления сид-фразой — только для главного админа,
// фраза сверяется внутри Edge Function, в браузер/исходники не попадает.
async function adminSetDeleteProtection(phrase){
  const { data: { session } } = await client.auth.getSession();
  if(!session) throw new Error("no_session");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/set-delete-protection`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ phrase }),
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(body.error || "request_failed");
  return body;
}

// Снятие защиты от удаления — отдельная фраза, известная только владельцу сайта.
async function adminRemoveDeleteProtection(phrase, userId){
  const { data: { session } } = await client.auth.getSession();
  if(!session) throw new Error("no_session");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/remove-delete-protection`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ phrase, user_id: userId }),
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(body.error || "request_failed");
  return body;
}

// Распознавание ников на одном скриншоте (переписи/налогов) через Gemini.
// Доступно только glavadmin/admin — проверяется внутри самой функции.
async function adminOcrNicknames(imageDataUrl){
  const { data: { session } } = await client.auth.getSession();
  if(!session) throw new Error("no_session");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-nicknames`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ image: imageDataUrl }),
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error((body.error || `request_failed (HTTP ${res.status})`) + (body.detail ? ": " + body.detail : ""));
  return body.nicknames || [];
}

// Распознавание таблицы боевой статистики (килы/смерти/PvP/PvE урон) на одном
// скриншоте (Журнал посещаемости) через Gemini. Доступно только glavadmin/admin.
// Распознавание класса персонажа по иконке пробовали (вторым запросом,
// adminOcrClassifyIcons) и убрали — иконку (36 похожих вариантов) не удалось
// распознавать стабильно, ник и цифры модель читает надёжно и без этого.
async function adminOcrEventStats(imageDataUrl){
  const { data: { session } } = await client.auth.getSession();
  if(!session) throw new Error("no_session");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ocr-event-stats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ image: imageDataUrl }),
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error((body.error || `request_failed (HTTP ${res.status})`) + (body.detail ? ": " + body.detail : ""));
  // leader — ник из подписи «Лидер: …» над таблицей на скрине (может быть null,
  // если такой подписи не было или модель её не распознала)
  return { stats: body.stats || [], leader: body.leader || null };
}

// Снимает флаг «нужно сменить пароль» у своей же строки после успешной смены
// (узкая RPC — общий self-write на profiles запрещён специально, чтобы никто
// не мог поменять себе роль/клан).
async function clearMustChangePassword(){
  const { error } = await client.rpc("clear_must_change_password");
  if(error) throw error;
}

window.L2Cabinet = {
  client,
  login,
  signOut,
  requireSession,
  getProfile,
  getVisibleSections,
  adminCreateUser,
  adminDeleteUser,
  adminSetDeleteProtection,
  adminRemoveDeleteProtection,
  adminOcrNicknames,
  adminOcrEventStats,
  clearMustChangePassword,
  applyClanBranding,
};
