// Одноразовые ссылки для входа (см. supabase/schema_invite_links.sql).
//   L2Invite.makeLink({ db, clanId, userId, createdBy, username, password }) → "https://…/login.html#invite=…"
//   L2Invite.parseHash(location.hash) → { id, iv, ct } | null
//   L2Invite.openLink(db, parsed) → { u, p } | null   (null — ссылка уже использована/устарела/битая)
// Логин и пароль шифруются AES-GCM случайным ключом прямо в браузере админа; в ссылку
// (после «#», на сервер эта часть не уходит) идут только iv и шифротекст, в базу — только
// ключ. Пока ссылка жива, страница входа получает ключ через invite_key(); после первого
// входа invite_consume() гасит её, и ключ больше не выдаётся — та же ссылка бесполезна.
(function(global){
  "use strict";
  const enc = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const dec = (s) => {
    s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
    while(s.length % 4) s += "=";
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  };

  async function makeLink({ db, clanId, userId, createdBy, username, password }){
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify({ u: username, p: password })));
    // прежние неиспользованные ссылки этого человека больше не нужны — гасим
    // не погасили — не выдаём новую: иначе по старой ссылке тоже можно было бы войти
    const revoke = await db.from("invite_links").update({ used_at: new Date().toISOString() }).eq("user_id", userId).is("used_at", null);
    if(revoke.error) throw revoke.error;
    const { data, error } = await db.from("invite_links")
      .insert({ clan_id: clanId, user_id: userId, key: enc(raw), created_by: createdBy || null })
      .select("id").single();
    if(error) throw error;
    const base = new URL("login.html", location.href);
    base.search = ""; base.hash = "";
    return base.href + "#invite=" + data.id + "." + enc(iv) + "." + enc(ct);
  }

  function parseHash(hash){
    const m = /invite=([0-9a-fA-F-]{36})\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/.exec(hash || "");
    return m ? { id: m[1], iv: m[2], ct: m[3] } : null;
  }

  async function openLink(db, inv){
    if(!inv) return null;
    const { data: keyB64, error } = await db.rpc("invite_key", { p_id: inv.id });
    if(error || !keyB64) return null;
    try{
      const key = await crypto.subtle.importKey("raw", dec(keyB64), "AES-GCM", false, ["decrypt"]);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dec(inv.iv) }, key, dec(inv.ct));
      const cred = JSON.parse(new TextDecoder().decode(pt));
      return (cred && cred.u && cred.p) ? cred : null;
    }catch(e){ return null; } // ссылку обрезали при пересылке или подменили
  }

  // читаемый пароль: без похожих символов (0/O, 1/l/I), две группы по 4 через дефис
  function generatePassword(){
    const abc = "abcdefghjkmnpqrstuvwxyz23456789";
    const r = crypto.getRandomValues(new Uint8Array(8));
    const s = [...r].map(b => abc[b % abc.length]).join("");
    return s.slice(0, 4) + "-" + s.slice(4);
  }

  global.L2Invite = { makeLink, parseHash, openLink, generatePassword };
})(window);
