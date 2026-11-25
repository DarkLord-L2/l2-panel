// Общий модуль кабинета: подключение к Supabase, сессия, профиль, права по ролям.
// Подключать после <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
//
// Данные проекта Supabase (Project Settings → API).
// Оба значения публичные (anon key рассчитан на то, чтобы быть виден в браузере) —
// реальная защита данных обеспечивается RLS-политиками в supabase/schema.sql, не секретностью этих строк.
const SUPABASE_URL = "https://owacpvydbqxdhrxxitlj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_eQhDBY7sz0esE6HwwfNUYA_tRh9_OvL";

// ---------- стиль интерфейса (js/theme-minimal.css): data-ui на <html> ----------
// Стиль выбирает глав-админ на весь клан («Админ-панель → Оформление», clans.ui_style). Оболочка index.html читает его
// из базы и кладёт в localStorage (UI_CLAN_KEY) — оттуда его сразу при загрузке берут все разделы-iframe, без мигания.
// Поверх — личный предпросмотр только для своего браузера: ?ui=minimal / ?ui=default у любой страницы; ?ui=clan — снять
// предпросмотр и вернуться к стилю клана (выбор в «Оформлении» тоже снимает предпросмотр)
const UI_PREVIEW_KEY = "l2UiPreview";
const UI_CLAN_KEY = "l2UiStyle";
const UI_STYLES = ["default", "minimal"];
function currentUiStyle(){
  try{
    const p = localStorage.getItem(UI_PREVIEW_KEY);
    if(UI_STYLES.includes(p)) return p;
    const c = localStorage.getItem(UI_CLAN_KEY);
    if(UI_STYLES.includes(c)) return c;
  }catch(e){}
  return "default";
}
function paintUiStyle(){
  const ui = currentUiStyle();
  if(ui === "default") delete document.documentElement.dataset.ui;
  else document.documentElement.dataset.ui = ui;
}
(function initUiStyle(){
  try{
    const q = new URLSearchParams(location.search).get("ui");
    if(q === "clan") localStorage.removeItem(UI_PREVIEW_KEY);
    else if(UI_STYLES.includes(q)) localStorage.setItem(UI_PREVIEW_KEY, q);
  }catch(e){}
  paintUiStyle();
})();
// стиль клана сменили в «Оформлении» / в другой вкладке — перекрашиваемся без перезагрузки
window.addEventListener("storage", (e) => {
  if(e.key === UI_PREVIEW_KEY || e.key === UI_CLAN_KEY) paintUiStyle();
});
// стиль клана из базы (вызывает оболочка index.html и «Оформление»): запомнить и применить здесь же
function setClanUiStyle(style, opts){
  const s = UI_STYLES.includes(style) ? style : "default";
  try{
    localStorage.setItem(UI_CLAN_KEY, s);
    if(opts && opts.clearPreview) localStorage.removeItem(UI_PREVIEW_KEY);
  }catch(e){}
  paintUiStyle();
}

const REMEMBER_KEY = "l2RememberMe";
const EMAIL_DOMAIN = "@l2clan.local";

// Запасное хранилище в памяти вкладки — если браузер запретил хранилище (режим инкогнито с жёсткими
// настройками, заблокированные данные сайта), доступ к localStorage бросает исключение и раньше ронял ВЕСЬ сайт
// ещё до входа. Теперь вход работает, просто сессия живёт до закрытия вкладки.
const memoryStorage = (() => { const m = new Map(); return {
  getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
}; })();
function currentBackingStorage(){
  try{
    const remember = localStorage.getItem(REMEMBER_KEY) !== "0";
    return remember ? window.localStorage : window.sessionStorage;
  }catch(e){ return memoryStorage; }
}
// адаптер хранилища сессии: "запомнить меня" снята → токены живут в sessionStorage
// (переживают перезагрузку вкладки, но не переживают закрытие браузера/новую вкладку)
const sessionAwareStorage = {
  // в памяти значение появляется только если запись в хранилище не удалась — тогда оно и свежее
  getItem: (k) => { const m = memoryStorage.getItem(k); if(m !== null) return m; try{ return currentBackingStorage().getItem(k); }catch(e){ return null; } },
  setItem: (k, v) => { try{ currentBackingStorage().setItem(k, v); memoryStorage.removeItem(k); }catch(e){ memoryStorage.setItem(k, v); } },
  removeItem: (k) => { try{ currentBackingStorage().removeItem(k); }catch(e){} memoryStorage.removeItem(k); },
};
function setRemember(on){ try{ localStorage.setItem(REMEMBER_KEY, on ? "1" : "0"); }catch(e){} }

// Адрес картинки из базы (иконки участников/предметов/мероприятий, лого клана) перед вставкой в HTML-строку
// (src="…", style="background-image:url('…')"). Сайт сам кладёт туда только data:image/…;base64 (canvas.toDataURL)
// или http(s)-ссылку на лого, классы — assets/…. Кавычки, скобки, пробелы, javascript: и прочее значат, что значение
// подложили в базу в обход интерфейса (через API своим токеном) — его отбрасываем, иначе это XSS у всех, кто откроет
// страницу, включая владельца платформы в режиме «Войти в клан».
function safeImageUrl(u, fallback){
  const s = typeof u === "string" ? u.trim() : "";
  if(s && !/["'<>()\\\s`]/.test(s) &&
     /^(data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,[A-Za-z0-9+/=]+$|https?:\/\/|(\.\/)?assets\/)/i.test(s)) return s;
  return fallback === undefined ? "" : fallback;
}
window.l2SafeImg = safeImageUrl;

// ---------- режим «просмотр клана» для владельца платформы (owner-console → «Войти в клан») ----------
// Владелец заходит в чужой клан под сессией лидера этого клана (без создания своего пользователя), но ТОЛЬКО ДЛЯ ЧТЕНИЯ:
// пока стоит метка OWNER_VIEW_KEY, любой запрос на изменение данных (запись в таблицы, вызов функций, загрузка файлов, смена
// пароля) блокируется прямо в клиенте и возвращает ошибку «режим просмотра». Метка в localStorage — общая для всех вкладок,
// потому что сессия тоже общая.
const OWNER_VIEW_KEY = "l2OwnerView";
const OWNER_VIEW_READ_RPC = new Set(["is_platform_admin", "my_clan_access", "census_week_list", "census_summary", "attendance_summary"]);
function ownerView(){
  try{ return JSON.parse(localStorage.getItem(OWNER_VIEW_KEY) || "null"); }catch(e){ return null; }
}
function guardedFetch(input, init){
  try{
    if(ownerView()){
      const url = typeof input === "string" ? input : (input && input.url) || String(input);
      const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if(method !== "GET" && method !== "HEAD" && method !== "OPTIONS"){
        let blocked = false;
        if(url.indexOf("/rest/v1/rpc/") >= 0){
          const name = url.split("/rest/v1/rpc/")[1].split("?")[0];
          blocked = !OWNER_VIEW_READ_RPC.has(name);
        } else if(url.indexOf("/rest/v1/") >= 0 || url.indexOf("/functions/v1/") >= 0 || url.indexOf("/storage/v1/") >= 0 || url.indexOf("/auth/v1/user") >= 0){
          blocked = true;
        }
        if(blocked){
          return Promise.resolve(new Response(JSON.stringify({ message: "Режим просмотра: изменения запрещены", code: "owner_view_readonly" }),
            { status: 403, headers: { "Content-Type": "application/json" } }));
        }
      }
    }
  }catch(e){}
  const p = fetch(input, init);
  // Сбой сети / ошибка сервера при обращении к базе или авторизации — показываем плашку. Многие страницы читают
  // `const { data } = await db.from(…)` без проверки error, и при обрыве связи рисовали «пусто», будто данных нет.
  // 4xx сюда не попадают: 404 у rpc — штатная проверка «миграция не выполнена», ошибки записи страницы обрабатывают сами
  let watch = false;
  try{
    const url = typeof input === "string" ? input : (input && input.url) || String(input);
    watch = url.indexOf(SUPABASE_URL + "/rest/v1/") === 0 || url.indexOf(SUPABASE_URL + "/auth/v1/") === 0;
  }catch(e){}
  if(!watch) return p;
  return p.then(
    (res) => { if(res.status >= 500) notifyDbProblem(); return res; },
    (err) => { if(!(err && err.name === "AbortError")) notifyDbProblem(); throw err; },
  );
}

// плашка «нет связи с сервером» — одна на страницу (у каждого раздела-iframe своя), закрывается крестиком
let dbProblemShown = false;
function notifyDbProblem(){
  if(dbProblemShown) return;
  const show = () => {
    if(dbProblemShown || !document.body) return;
    dbProblemShown = true;
    const T = (k, f) => (window.L2I18n ? window.L2I18n.t(k, f) : f);
    const bar = document.createElement("div");
    bar.className = "db-problem-bar";
    bar.setAttribute("role", "alert");
    const text = document.createElement("span");
    text.textContent = T("common.dbProblem", "Нет связи с сервером — часть данных могла не загрузиться или не сохраниться.");
    const reload = document.createElement("button");
    reload.type = "button"; reload.className = "btn";
    reload.textContent = T("common.reloadPage", "Обновить страницу");
    reload.addEventListener("click", () => location.reload());
    const close = document.createElement("button");
    close.type = "button"; close.className = "db-problem-x";
    close.textContent = "×";
    close.setAttribute("aria-label", T("common.close", "Закрыть"));
    close.addEventListener("click", () => { bar.remove(); dbProblemShown = false; });
    bar.append(text, reload, close);
    document.body.appendChild(bar);
  };
  if(document.body) show(); else document.addEventListener("DOMContentLoaded", show, { once: true });
}

// Обращение к localStorage для настроек интерфейса (ширина таблиц, выбранная вкладка, фильтры): если браузер запретил
// хранилище или оно переполнено, getItem/setItem бросают исключение — раньше это роняло всю страницу. Теперь
// настройка просто не запоминается, страница работает
const l2LS = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k, v){ try{ localStorage.setItem(k, v); return true; }catch(e){ return false; } },
  remove(k){ try{ localStorage.removeItem(k); }catch(e){} },
  sget(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } },
  sset(k, v){ try{ sessionStorage.setItem(k, v); return true; }catch(e){ return false; } },
  sremove(k){ try{ sessionStorage.removeItem(k); }catch(e){} },
};
window.l2LS = l2LS;

// Общая проверка результата записи в базу: ошибка → сообщение человеку, true/false — удалось ли.
// Для мест, где раньше писали `await db.from(…).update(…)` и не смотрели на error (изменение молча не сохранялось,
// например в режиме просмотра владельца, при отказе RLS или обрыве связи)
function reportWriteError(res, context){
  const err = res && res.error;
  if(!err) return true;
  console.error(context || "db write failed", err);
  const T = (k, f) => (window.L2I18n ? window.L2I18n.t(k, f) : f);
  const readonly = err.code === "owner_view_readonly";
  alert(readonly
    ? T("common.ownerViewReadonly", "Режим просмотра: изменения запрещены.")
    : T("common.saveFailed", "Не удалось сохранить изменение:") + " " + (err.message || String(err)));
  return false;
}
window.l2WriteOk = reportWriteError;

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: sessionAwareStorage, autoRefreshToken: true, persistSession: true },
  global: { fetch: guardedFetch },
});

function usernameToEmail(username){
  return username.trim().toLowerCase() + EMAIL_DOMAIN;
}

async function login(username, password, remember){
  try{ localStorage.removeItem(OWNER_VIEW_KEY); }catch(e){}
  setRemember(remember);
  return client.auth.signInWithPassword({ email: usernameToEmail(username), password });
}

async function signOut(){
  // в режиме просмотра клана «Выйти» значит «выйти из чужого клана обратно к себе», а НЕ завершить сессии лидера
  if(ownerView()){
    const back = await exitClanView();
    location.href = back ? "owner-console.html" : "login.html";
    return;
  }
  const { data: { session } } = await client.auth.getSession();
  if(session) forgetAccount(session.user.id);
  await client.auth.signOut();
  location.href = "login.html";
}

// Войти в клан: token_hash выдаёт функция owner-enter-clan (только владельцу платформы). Свою сессию владелец сохраняет в список
// аккаунтов (чтобы вернуться), затем входит под лидером клана; включается режим «только чтение» (см. guardedFetch выше)
async function enterClanView(tokenHash, meta){
  // токены владельца сохраняются ВСЕГДА, даже при выключенном «Помнить вход в аккаунты» — без них из клана не вернуться;
  // при выходе (exitClanView) запись снова сохраняется по общему правилу, т.е. без токенов, если настройка выключена
  await persistCurrentAccountSession({ withTokens: true });
  const { data: { session: cur } } = await client.auth.getSession();
  const ownerId = cur && cur.user ? cur.user.id : null;
  setRemember(true);
  let r = await client.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if(r.error) r = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if(r.error) throw r.error;
  localStorage.setItem(OWNER_VIEW_KEY, JSON.stringify({ ownerId, leaderId: r.data.user.id, clanName: (meta && meta.clanName) || "", t: Date.now() }));
}
// Выйти из чужого клана: сессия лидера закрывается ТОЛЬКО в этом браузере (локально), владелец возвращается на свою сохранённую.
// true — вернулись к владельцу; false — его сессия не восстановилась (нужно войти заново)
async function exitClanView(){
  const ov = ownerView();
  try{ localStorage.removeItem(OWNER_VIEW_KEY); }catch(e){} // сначала снимаем блокировку записи — иначе не восстановить сессию
  try{ await client.auth.signOut({ scope: "local" }); }catch(e){}
  if(ov && ov.leaderId) forgetAccount(ov.leaderId);
  const acc = ov && loadSavedAccounts().find(a => a.userId === ov.ownerId);
  if(acc && acc.refresh_token){
    const { error } = await client.auth.setSession({ access_token: acc.access_token, refresh_token: acc.refresh_token });
    if(!error){ await persistCurrentAccountSession(); return true; }
  }
  return false;
}

// ---------- переключение между несколькими аккаунтами (как в Google «Добавить
// аккаунт») — храним не пароли, а токены уже состоявшейся сессии (то же самое,
// что и так лежит в хранилище сессии) под отдельным ключом на каждый аккаунт,
// чтобы переключаться между несколькими логинами (одного клана или разных
// клана — не важно) без повторного ввода пароля ----------
const ACCOUNTS_KEY = "l2SavedAccounts";

function loadSavedAccounts(){
  try{ return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]"); }catch(e){ return []; }
}
function saveSavedAccountsList(list){
  try{ localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); }catch(e){}
}
function forgetAccount(userId){
  saveSavedAccountsList(loadSavedAccounts().filter(a => a.userId !== userId));
}

// «Помнить вход в аккаунты» (меню профиля). Включено — как раньше: у каждого добавленного аккаунта в этом браузере лежат
// его токены, переключение без пароля. Выключено (по умолчанию) — в списке остаются только логин/клан, токены есть лишь у
// ТЕКУЩЕЙ сессии (её хранит сам Supabase), при переключении пароль вводится заново. Смысл: если на сайте когда-нибудь найдётся
// XSS, украсть можно будет одну сессию, а не все добавленные аккаунты сразу (и не токен владельца платформы).
const KEEP_ACCOUNTS_KEY = "l2KeepAccounts";
function keepAccountsEnabled(){
  try{
    const v = localStorage.getItem(KEEP_ACCOUNTS_KEY);
    if(v === "1") return true;
    if(v === "0") return false;
    // ключа ещё нет — первый заход после обновления сайта. Кто уже пользовался быстрым переключением (в списке токены
    // больше чем одного аккаунта), тому оставляем как было; остальным — выключено
    const ov = ownerView();
    const withTokens = loadSavedAccounts().filter(a => a.refresh_token && !(ov && a.userId === ov.leaderId)).length;
    const on = withTokens > 1;
    localStorage.setItem(KEEP_ACCOUNTS_KEY, on ? "1" : "0");
    return on;
  }catch(e){ return false; }
}
function stripTokens(a){
  const { access_token, refresh_token, ...rest } = a;
  return rest;
}
// выключение сразу стирает токены всех сохранённых аккаунтов, кроме токена владельца, пока он внутри чужого клана
// (иначе ему не вернуться); включение сохраняет токены текущей сессии — остальные появятся при следующем входе в них
async function setKeepAccounts(on){
  try{ localStorage.setItem(KEEP_ACCOUNTS_KEY, on ? "1" : "0"); }catch(e){}
  if(on) return persistCurrentAccountSession();
  const ov = ownerView();
  saveSavedAccountsList(loadSavedAccounts().map(a => (ov && a.userId === ov.ownerId) ? a : stripTokens(a)));
}

// сохраняет АКТУАЛЬНУЮ активную сессию в список — вызывается перед уходом на
// другой аккаунт (чтобы не потерять её свежий refresh_token) и сразу после
// входа/переключения (сохранить то, что реально стало активным).
// opts.withTokens — сохранить токены, даже если «Помнить вход в аккаунты» выключено (только для enterClanView)
async function persistCurrentAccountSession(opts){
  const { data: { session } } = await client.auth.getSession();
  if(!session) return;
  const profile = await getProfile().catch(() => null);
  // у владельца платформы (public.platform_admins) нет строки в public.profiles —
  // getProfile() для него вернёт null. Раньше в этом случае username откатывался
  // на "session.user.email", то есть в список аккаунтов утекал настоящий email —
  // проверяем этот случай отдельно и подписываем строку понятной меткой вместо адреса
  let isPlatformAdmin = false;
  if(!profile){
    isPlatformAdmin = await client.rpc("is_platform_admin").then(r => r.data === true).catch(() => false);
  }
  const keep = keepAccountsEnabled();
  const ov = ownerView();
  // настройка выключена — у остальных записей токенов быть не должно (кроме владельца, пока он в чужом клане)
  const list = keep ? loadSavedAccounts() : loadSavedAccounts().map(a => (ov && a.userId === ov.ownerId) ? a : stripTokens(a));
  const entry = {
    userId: session.user.id,
    username: profile?.username || (isPlatformAdmin ? "" : (session.user.email?.replace(EMAIL_DOMAIN, "") || "")),
    nickname: profile?.nickname || null,
    clanName: profile?.clans?.display_name || profile?.clans?.name || null,
    isPlatformAdmin,
  };
  if(keep || (opts && opts.withTokens)){
    entry.access_token = session.access_token;
    entry.refresh_token = session.refresh_token;
  }
  const i = list.findIndex(a => a.userId === entry.userId);
  if(i >= 0) list[i] = entry; else list.push(entry);
  saveSavedAccountsList(list);
}

// вход НОВЫМ логином/паролем поверх уже открытой сессии — сохраняет текущий
// аккаунт (чтобы вернуться к нему потом), входит под новым и тоже его сохраняет.
// Всегда переводит на «запомнить меня» (localStorage) — иначе переключение между
// сохранёнными аккаунтами не переживёт закрытие вкладки
async function addAccount(username, password){
  await persistCurrentAccountSession();
  setRemember(true);
  const { data, error } = await client.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if(error) throw error;
  await persistCurrentAccountSession();
  return data;
}

// «Изменить…» для УЖЕ сохранённого (необязательно активного сейчас) аккаунта —
// перезаходит тем же логином/новым паролем, чтобы обновить протухший/неверный
// токен, но НЕ остаётся на нём: сразу возвращается на ту сессию, что была активна
// до вызова. В отличие от addAccount(), эта функция не должна менять то, чем
// пользователь занят прямо сейчас — просто чинит запись в списке аккаунтов
async function reauthAccount(username, password){
  const { data: { session: prevSession } } = await client.auth.getSession();
  const prevUserId = prevSession?.user?.id || null;

  await persistCurrentAccountSession();
  setRemember(true);
  const { data, error } = await client.auth.signInWithPassword({ email: usernameToEmail(username), password });
  if(error) throw error;
  await persistCurrentAccountSession(); // свежие токены под её userId

  if(prevUserId && prevUserId !== data.session.user.id){
    const prevAcc = loadSavedAccounts().find(a => a.userId === prevUserId);
    if(prevAcc && prevAcc.refresh_token) await client.auth.setSession({ access_token: prevAcc.access_token, refresh_token: prevAcc.refresh_token });
  }
  return data;
}

// переключение на уже сохранённый аккаунт по его userId — client.auth.setSession
// сам обновит токены через refresh_token, если access_token уже протух.
// Если у клана целевого аккаунта отключён доступ (owner-console → «access_enabled»),
// на него НЕ переключаемся — откатываемся обратно на прежнюю сессию и бросаем
// ошибку с кодом "clan_access_disabled", чтобы вызывающий код (index.html) просто
// показал сообщение, а не уронил человека на мёртвый экран без пути назад
async function switchAccount(userId){
  const acc = loadSavedAccounts().find(a => a.userId === userId);
  if(!acc) throw new Error("account_not_found");
  // «Помнить вход» выключено — токенов нет, переключаться только через пароль (index.html открывает форму входа)
  if(!acc.refresh_token){ const err = new Error("password_required"); err.code = "password_required"; throw err; }

  const { data: { session: prevSession } } = await client.auth.getSession();
  const prevUserId = prevSession?.user?.id || null;

  await persistCurrentAccountSession();
  setRemember(true);
  const { data, error } = await client.auth.setSession({ access_token: acc.access_token, refresh_token: acc.refresh_token });
  if(error) throw error;

  const profile = await getProfile({ fresh: true }).catch(() => null);
  if(profile?.clans?.access_enabled === false){
    if(prevUserId && prevUserId !== userId){
      const prevAcc = loadSavedAccounts().find(a => a.userId === prevUserId);
      if(prevAcc && prevAcc.refresh_token) await client.auth.setSession({ access_token: prevAcc.access_token, refresh_token: prevAcc.refresh_token });
    }
    const err = new Error("clan_access_disabled");
    err.code = "clan_access_disabled";
    throw err;
  }

  await persistCurrentAccountSession();
  return data;
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
//
// Скорость: каждый раздел — отдельный iframe, и раньше КАЖДЫЙ заново шёл на сервер авторизации (getUser) и за профилем
// с названием роли — три запроса друг за другом (~0.3 с) перед своими данными. Теперь:
//  • кто вошёл — из локальной сессии (getSession, без сети). Это безопасно: токен всё равно проверяет база при
//    каждом запросе (RLS), подделанный или отозванный токен просто не получит данных;
//  • профиль кэшируется в sessionStorage (общий для оболочки и всех разделов одной вкладки) на PROFILE_TTL_MS.
//    Оболочка (index.html) при каждой загрузке берёт свежий — getProfile({ fresh: true }), так что после F5 всё
//    актуально; права всё равно проверяет база, кэш влияет только на то, что нарисовано
const PROFILE_TTL_MS = 3 * 60 * 1000;
const profileCacheKey = (uid) => "l2Profile:" + uid;
function invalidateProfile(){
  try { Object.keys(sessionStorage).filter(k => k.indexOf("l2Profile:") === 0).forEach(k => sessionStorage.removeItem(k)); } catch(e){}
}
async function getProfile(opts){
  const { data: { session } } = await client.auth.getSession();
  const user = session?.user;
  if(!user) return null;
  if(!(opts && opts.fresh)){
    try {
      const c = JSON.parse(sessionStorage.getItem(profileCacheKey(user.id)) || "null");
      if(c && Date.now() - c.t < PROFILE_TTL_MS && c.data){ applyClanBranding(c.data.clans); return c.data; }
    } catch(e){}
  }
  const { data, error } = await client
    .from("profiles")
    .select("id, username, nickname, clan_id, party_id, must_change_password, role_id, roles(key, label, rank), clan_groups(name), clans(access_enabled, name, theme_preset, accent_color, display_name, logo_url)")
    .eq("id", user.id)
    .maybeSingle();
  if(error) throw error;
  applyClanBranding(data?.clans);
  // своё название роли для этого клана (Админ-панель → «Пользователи») — public.roles
  // общая на всю платформу таблица, поэтому подмена названия делается только тут,
  // поверх ответа, а не в самой roles.label; нет своей строки — остаётся как было
  if(data?.roles && data.clan_id && data.role_id){
    const { data: override } = await client
      .from("clan_role_labels")
      .select("label")
      .eq("clan_id", data.clan_id)
      .eq("role_id", data.role_id)
      .maybeSingle();
    if(override?.label){ data.roles.label = override.label; data.role_label_override = override.label; }
  }
  if(data){ try { sessionStorage.setItem(profileCacheKey(user.id), JSON.stringify({ t: Date.now(), data })); } catch(e){} }
  return data;
}

// Разделы сайта, видимые роли (уже отсортированные для навигации). roleKey — например "glavadmin".
// roleId (profile.role_id) — если известен, лишний запрос «id роли по ключу» не нужен
async function getVisibleSections(roleKey, roleId){
  let roleRow = roleId ? { id: roleId } : null;
  if(!roleRow){
    const { data: r, error: roleErr } = await client.from("roles").select("id").eq("key", roleKey).single();
    if(roleErr) throw roleErr;
    roleRow = r;
  }

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

// Новый пароль пользователю своего клана — для ссылки-приглашения (🔗 в «Пользователях»).
// Только главный админ, через Edge Function set-user-password; phrase — только для
// защищённых от удаления аккаунтов (пароль защиты или мастер-сид-фраза)
async function adminSetUserPassword(userId, password, phrase){
  const { data: { session } } = await client.auth.getSession();
  if(!session) throw new Error("no_session");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/set-user-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
    body: JSON.stringify({ user_id: userId, password, phrase: phrase || undefined }),
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(body.error || (res.status === 404 ? "function_not_deployed" : "request_failed"));
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
  invalidateProfile();
}

// Все строки запроса, а не первые 1000. Supabase (PostgREST) отдаёт за один запрос не больше 1000 строк и остальное
// МОЛЧА обрезает — на растущих таблицах (перепись по неделям, явка, статистика мероприятий, буст) данные терялись бы.
// make() каждый раз строит НОВЫЙ запрос с устойчивым порядком (order по уникальному полю, обычно "id"), дальше
// забираем его страницами по 1000. Возвращает то же, что обычный запрос: { data, error }.
async function selectAll(make, pageSize = 1000){
  const out = [];
  for(let from = 0; from < 500000; from += pageSize){
    const { data, error } = await make().range(from, from + pageSize - 1);
    // ошибка посреди выгрузки — отдаём data: null, как обычный запрос. Половина таблицы, выданная за целую, опаснее ошибки
    // (деньги, явка, налоги посчитались бы по неполным данным молча)
    if(error) return { data: null, error };
    if(data && data.length) out.push(...data);
    if(!data || data.length < pageSize) break;
  }
  return { data: out, error: null };
}

// То же для запросов вида `.in("event_id", ids)` с длинным списком: адрес запроса с сотнями uuid получается слишком длинным
// (сервер отвечает ошибкой), поэтому список режем на части и склеиваем результат. make(часть) строит запрос по этой части.
async function selectAllIn(make, ids, chunkSize = 100){
  const out = [];
  const list = Array.from(ids || []);
  for(let i = 0; i < list.length; i += chunkSize){
    const part = list.slice(i, i + chunkSize);
    const { data, error } = await selectAll(() => make(part));
    if(error) return { data: null, error };
    out.push(...data);
  }
  return { data: out, error: null };
}

// Последние `count` недель переписи и ники в них — пара маленьких запросов вместо всей истории переписи.
// weeks — от новой к старой; rows — [{nickname, week_start}] только этих недель.
async function censusWeeks(count = 1){
  const weeks = [];
  for(let i = 0; i < count; i++){
    let q = client.from("census_entries").select("week_start").order("week_start", { ascending: false }).limit(1);
    if(weeks.length) q = q.lt("week_start", weeks[weeks.length - 1]);
    const { data, error } = await q;
    if(error) return { weeks, rows: [], error };
    if(!data || !data.length) break;
    weeks.push(data[0].week_start);
  }
  if(!weeks.length) return { weeks, rows: [], error: null };
  const res = await selectAll(() => client.from("census_entries").select("nickname, week_start").in("week_start", weeks).order("id"));
  return { weeks, rows: res.data || [], error: res.error };
}

// Сводка явки по нику за всё время: сколько отметок, на скольких мероприятиях, дата последнего — считается В БАЗЕ
// (функция attendance_summary, supabase/schema_perf.sql), а не выкачиванием всей истории явки страницами по 1000 строк.
// Нет функции (миграция не выполнена) — null, страница считает по-старому.
// Ответ — [{ nickname, entries, events, last_date }]; кэш на вкладку на 60 с (сводку берут и «Группы», и «Участники»)
async function attendanceSummary(){
  const ck = "l2AttSummary";
  try { const c = JSON.parse(sessionStorage.getItem(ck) || "null"); if(c && Date.now() - c.t < 60000) return c.rows; } catch(e){}
  const { data, error } = await selectAll(() => client.rpc("attendance_summary").order("nickname"));
  if(error) return null;
  try { sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), rows: data })); } catch(e){}
  return data;
}

// Сводка переписи: { weeks: [все недели по возрастанию], rows: [{ nickname, weeks, first_week, last_week }] } — считается
// в базе (census_summary / census_week_list, supabase/schema_perf.sql) вместо выкачивания всей истории переписи.
// Нет функций (миграция не выполнена) — null, страница считает по-старому. Кэш на вкладку на 60 с
async function censusSummary(){
  const ck = "l2CensusSummary";
  try { const c = JSON.parse(sessionStorage.getItem(ck) || "null"); if(c && Date.now() - c.t < 60000) return c.v; } catch(e){}
  const [s, w] = await Promise.all([
    selectAll(() => client.rpc("census_summary").order("nickname")),
    selectAll(() => client.rpc("census_week_list").order("week_start")),
  ]);
  if(s.error || w.error) return null;
  const v = { weeks: (w.data || []).map(r => r.week_start), rows: s.data || [] };
  try { sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), v })); } catch(e){}
  return v;
}

// Сбросить кэш сводок: после замены/удаления ника (js/nick-tools.js) и перед проверкой ников — иначе минуту видны старые написания
function invalidateSummaries(){
  try { sessionStorage.removeItem("l2AttSummary"); sessionStorage.removeItem("l2CensusSummary"); } catch(e){}
}

// Страницы, где правят перепись/явку: сводки выше сбрасываются при заходе на них. Разделы открываются по одному (iframe),
// поэтому следующая страница со сводкой («Группы», «Участники», «Мой кабинет», «Выплаты») возьмёт уже свежие данные
if(/\/(attendance|census|loot-split|loot-split-party)\.html$/.test(location.pathname)){
  try { sessionStorage.removeItem("l2AttSummary"); sessionStorage.removeItem("l2CensusSummary"); } catch(e){}
}

window.L2Cabinet = {
  ownerView,
  enterClanView,
  exitClanView,
  invalidateSummaries,
  censusSummary,
  attendanceSummary,
  client,
  selectAll,
  selectAllIn,
  censusWeeks,
  login,
  signOut,
  requireSession,
  getProfile,
  invalidateProfile,
  getVisibleSections,
  adminCreateUser,
  adminSetUserPassword,
  adminDeleteUser,
  adminSetDeleteProtection,
  adminRemoveDeleteProtection,
  adminOcrNicknames,
  adminOcrEventStats,
  clearMustChangePassword,
  applyClanBranding,
  setClanUiStyle,
  currentUiStyle,
  safeImageUrl,
  getSavedAccounts: loadSavedAccounts,
  addAccount,
  reauthAccount,
  switchAccount,
  forgetAccount,
  keepAccountsEnabled,
  setKeepAccounts,
  rememberCurrentAccount: () => persistCurrentAccountSession(),
};
