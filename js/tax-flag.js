// Общий выключатель налогов клана (tax_settings.taxes_enabled, переключается в Админ-панели → «Правила клана» → «Налоги»).
// Страницы, где налоги показываются, спрашивают его так:
//   await L2Taxes.init(db, clanId);
//   if(!L2Taxes.enabled()) { ... показать «выключен» / спрятать ... }
// Пока колонки в базе нет (миграция не выполнена) или запрос не удался — налоги считаются включёнными, как раньше.
(function(global){
  "use strict";
  const TTL_MS = 60 * 1000; // между разделами одной сессии не гоняем один и тот же запрос
  const cacheKey = (clanId) => "l2TaxFlag:" + clanId;
  let enabled = true, ready = false;

  async function init(db, clanId){
    if(ready) return;
    try {
      const raw = global.sessionStorage.getItem(cacheKey(clanId));
      if(raw){
        const c = JSON.parse(raw);
        if(c && Date.now() - c.t < TTL_MS){ enabled = c.enabled !== false; ready = true; return; }
      }
    } catch(e){}
    try {
      const res = await db.from("tax_settings").select("taxes_enabled").eq("clan_id", clanId).maybeSingle();
      enabled = res.error ? true : (res.data ? res.data.taxes_enabled !== false : true);
      try { global.sessionStorage.setItem(cacheKey(clanId), JSON.stringify({ t: Date.now(), enabled })); } catch(e){}
    } catch(e){ enabled = true; }
    ready = true;
  }
  function invalidate(clanId){
    try { global.sessionStorage.removeItem(cacheKey(clanId)); } catch(e){}
  }
  global.L2Taxes = { init, invalidate, enabled: () => enabled, ready: () => ready };
})(window);
