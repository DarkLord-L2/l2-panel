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
async function getProfile(){
  const { data: { user } } = await client.auth.getUser();
  if(!user) return null;
  const { data, error } = await client
    .from("profiles")
    .select("id, username, clan_id, party_id, roles(key, label, rank), parties(name)")
    .eq("id", user.id)
    .single();
  if(error) throw error;
  return data;
}

// Разделы сайта, видимые роли (уже отсортированные для навигации). roleKey — например "glavadmin".
async function getVisibleSections(roleKey){
  const { data: roleRow, error: roleErr } = await client
    .from("roles").select("id").eq("key", roleKey).single();
  if(roleErr) throw roleErr;

  const { data, error } = await client
    .from("role_sections")
    .select("visible, sections(key, label, sort)")
    .eq("role_id", roleRow.id)
    .eq("visible", true);
  if(error) throw error;

  return (data || [])
    .map(row => row.sections)
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort);
}

// Создание нового пользователя — только для главного админа, идёт через Edge Function
// (там же живёт service-role ключ, в браузере его нет и быть не должно).
async function adminCreateUser({ username, password, role_key, party_id }){
  const { data: { session } } = await client.auth.getSession();
  if(!session) throw new Error("no_session");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ username, password, role_key, party_id: party_id || null }),
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(body.error || "request_failed");
  return body;
}

// Удаление пользователя — тоже только для главного админа, тоже через Edge Function
// (нужен service-role, чтобы удалить саму учётку в auth.users, не только строку в profiles).
async function adminDeleteUser(userId){
  const { data: { session } } = await client.auth.getSession();
  if(!session) throw new Error("no_session");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  const body = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(body.error || "request_failed");
  return body;
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
};
