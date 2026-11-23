// Работа с никами клана: проверка, замена, удаление. Общий модуль для вкладки «Ники и игроки» (admin.html) и значка «!»
// у «Админ-панели» (index.html). Перепись — главный справочник игроков; всё остальное (группы, явка, статистика, налоги…)
// хранит ник текстом, поэтому один человек мог оказаться записан по-разному. Модуль:
//   audit(db, clanId)           — находит «проблемные» ники (их нет ни в одной переписи) и группы «похожих написаний»;
//   rename(db, ctx, old, new)   — заменяет ник везде, не плодя дублей (там, где у нового ника уже есть запись, старая убирается);
//   removeFromRoster(db, nick)  — убирает из состава (группы, профессия, буст…), историю не трогает;
//   usage(db, nick)             — сколько строк с этим ником в каждой таблице;
//   attentionCount(result, clanId) / cachedCount / setCachedCount — число «нужно проверить» для значка.
// db — клиент Supabase (или его имитация в тестах). Ничего не знает про страницу: всё нужное приходит аргументами.
(function(global){
  "use strict";
  const t = (k, fb) => (global.L2I18n ? global.L2I18n.t(k, fb) : fb);
  const AMB = /^[0Oo1lIi|!]{3,}$/; // ник целиком из неотличимых на скрине символов — автоматически не сопоставляем

  // scope — по какому полю у одного ника не может быть двух строк (если у нового ника запись уже есть — старую убираем);
  // null — деньги: строки не склеиваем и не теряем; roster — входит в «состав» (его убирает removeFromRoster)
  const TABLES = [
    { t: "clan_group_members", label: "Группы", i18n: "admin.nickTblGroups", scope: ["group_id"], roster: true, order: ["group_id", "nickname"] },
    { t: "member_classes", label: "Профессии", i18n: "admin.nickTblClasses", scope: [], roster: true, order: ["nickname"] },
    { t: "boost_member_values", label: "Буст", i18n: "admin.nickTblBoost", scope: ["item_id"], roster: true, order: ["nickname", "item_id"] },
    { t: "loot_leader_coefficients", label: "Коэф. лидеров", i18n: "admin.nickTblLeaderCoef", scope: [], roster: true, order: ["nickname"] },
    { t: "roster_tagged_members", label: "Отдельный список", i18n: "admin.nickTblTagged", scope: [], roster: true, order: ["nickname"] },
    { t: "attendance_entries", label: "Явка", i18n: "admin.nickTblAttendance", scope: ["event_id"], order: ["id"] },
    { t: "event_stats", label: "Статистика", i18n: "admin.nickTblStats", scope: ["event_id"], order: ["id"] },
    { t: "census_entries", label: "Перепись", i18n: "admin.nickTblCensus", scope: ["week_start"], order: ["id"] },
    { t: "tax_payments", label: "Налоги", i18n: "admin.nickTblTax", scope: null, order: ["id"] },
    { t: "tax_donations", label: "Пожертвования", i18n: "admin.nickTblDonations", scope: null, order: ["id"] },
  ];
  const label = (tb) => t(tb.i18n, tb.label);
  const LEADER = () => t("admin.nickTblLeader", "Лидер группы");
  const DEPUTY = () => t("admin.nickTblDeputy", "Зам группы");

  // ---------- «скрытые» (решение «это разные игроки» / «оставить как есть»): хранится в браузере ----------
  const ignoreKey = (clanId) => "l2NickIgnore:" + clanId;
  function loadIgnored(clanId){
    try { return new Set(JSON.parse(global.localStorage.getItem(ignoreKey(clanId)) || "[]")); } catch(e){ return new Set(); }
  }
  function saveIgnored(clanId, set){
    try { global.localStorage.setItem(ignoreKey(clanId), JSON.stringify([...set])); } catch(e){}
  }

  const selectAll = (make) => global.L2Cabinet.selectAll(make);
  const cols = (order) => order;

  // сколько строк с этим ником в каждой таблице
  async function usage(db, nick){
    const out = [];
    await Promise.all(TABLES.map(async tb => {
      const { count, error } = await db.from(tb.t).select("*", { count: "exact", head: true }).eq("nickname", nick);
      if(!error && count) out.push({ label: label(tb), count });
    }));
    for(const col of ["leader_nickname", "deputy_nickname"]){
      const { count, error } = await db.from("clan_groups").select("*", { count: "exact", head: true }).eq(col, nick);
      if(!error && count) out.push({ label: col === "leader_nickname" ? LEADER() : DEPUTY(), count });
    }
    return out;
  }

  // замена ника везде. ctx: { clanId, userId }. Возвращает список проблем (пустой — всё прошло)
  async function rename(db, ctx, oldNick, newNick){
    const problems = [];
    const chk = (res, what) => { if(res && res.error) problems.push(what + ": " + res.error.message); return res; };
    if(!oldNick || !newNick || oldNick === newNick) return problems;
    // таблицы друг от друга не зависят — идут одновременно; внутри одной таблицы порядок важен (сначала убрать конфликты, потом переименовать)
    await Promise.all(TABLES.map(async (tb) => {
      const what = label(tb);
      if(tb.scope && tb.scope.length === 0){
        const c = chk(await db.from(tb.t).select("*", { count: "exact", head: true }).eq("nickname", newNick), what);
        if(c && c.count > 0) chk(await db.from(tb.t).delete().eq("nickname", oldNick), what);
      } else if(tb.scope){
        const col = tb.scope[0];
        const [o, n] = await Promise.all([
          selectAll(() => db.from(tb.t).select(col).eq("nickname", oldNick).order(col)),
          selectAll(() => db.from(tb.t).select(col).eq("nickname", newNick).order(col)),
        ]);
        if(o.error || n.error){ problems.push(what + ": " + (o.error || n.error).message); return; }
        const have = new Set((n.data || []).map(r => r[col]));
        const clash = [...new Set((o.data || []).map(r => r[col]).filter(v => have.has(v)))];
        for(let i = 0; i < clash.length; i += 100) chk(await db.from(tb.t).delete().eq("nickname", oldNick).in(col, clash.slice(i, i + 100)), what);
      }
      chk(await db.from(tb.t).update({ nickname: newNick }).eq("nickname", oldNick), what);
    }));
    await Promise.all([
      ...["leader_nickname", "deputy_nickname"].map(async (col) => chk(await db.from("clan_groups").update({ [col]: newNick }).eq(col, oldNick), LEADER())),
      (async () => {
        // привязки: прежние, что вели на старый ник, переезжают на новый, и сам старый ник становится привязкой к новому
        chk(await db.from("nick_aliases").update({ canonical: newNick }).eq("canonical", oldNick), "nick_aliases");
        chk(await db.from("nick_aliases").upsert({ clan_id: ctx.clanId, alias: oldNick, canonical: newNick, created_by: ctx.userId }, { onConflict: "clan_id,alias" }), "nick_aliases");
      })(),
    ]);
    // Проверка результата: база может молча не обновить строки (нет прав у роли, запрет политикой — ошибки при этом нет).
    // Тогда старый ник остаётся и группа «похожих» появляется снова после каждого объединения. Считаем строки, что остались.
    if(!problems.length){
      try {
        const left = await usage(db, oldNick);
        left.forEach(u => problems.push(t("admin.nicksLeftover", "{t}: осталось строк со старым ником «{n}» — {c} (нет прав на изменение или конфликт)")
          .replace("{t}", u.label).replace("{n}", oldNick).replace("{c}", u.count)));
      } catch(e){ console.error(e); }
    }
    try { if(global.L2Nick){ global.L2Nick.invalidate(ctx.clanId); await global.L2Nick.refresh(db, ctx.clanId); } } catch(e){ console.error(e); }
    return problems;
  }

  // убрать игрока из состава: группы, профессия, буст, коэффициент лидера, метка; история (явка, статистика, налоги, перепись) остаётся
  async function removeFromRoster(db, nick){
    const problems = [];
    for(const tb of TABLES.filter(x => x.roster)){
      const { error } = await db.from(tb.t).delete().eq("nickname", nick);
      if(error) problems.push(label(tb) + ": " + error.message);
    }
    for(const col of ["leader_nickname", "deputy_nickname"]){
      const { error } = await db.from("clan_groups").update({ [col]: null }).eq(col, nick);
      if(error) problems.push(error.message);
    }
    return problems;
  }

  // ---------- поиск «похожих написаний» ----------
  // Ники, которые, судя по всему, один человек: одинаковы с точностью до регистра/похожих букв (ocrKey), у длинных — до одной
  // буквы. Если два написания стоят в ОДНОЙ переписи — это разные игроки, вместе их не склеиваем.
  function findTwins(used, censusWeeks){
    const L2N = global.L2Nick;
    if(!L2N) return [];
    const info = new Map(); // ник → { by: Map(подпись → число), total, last, cw }
    const touch = (n) => { if(!info.has(n)) info.set(n, { by: new Map(), total: 0, last: "", cw: 0 }); return info.get(n); };
    censusWeeks.forEach((weeks, n) => {
      const i = touch(n);
      i.by.set(t("admin.nickTblCensus", "Перепись"), weeks.size); i.total += weeks.size; i.cw = weeks.size;
      weeks.forEach(w => { if(w > i.last) i.last = w; });
    });
    used.forEach((by, n) => { const i = touch(n); by.forEach((c, l) => { i.by.set(l, (i.by.get(l) || 0) + c); i.total += c; }); });
    const nicks = [...info.keys()].filter(n => !AMB.test(n));
    const key = new Map(nicks.map(n => [n, L2N.ocrKey(n)]));
    const parent = new Map(nicks.map(n => [n, n]));
    const find = (x) => { while(parent.get(x) !== x){ parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const sameWeek = (a, b) => { const A = censusWeeks.get(a), B = censusWeeks.get(b); if(!A || !B) return false; for(const w of A) if(B.has(w)) return true; return false; };
    for(let i = 0; i < nicks.length; i++){
      for(let j = i + 1; j < nicks.length; j++){
        const a = nicks[i], b = nicks[j], ka = key.get(a), kb = key.get(b);
        if(!ka || !kb || sameWeek(a, b)) continue;
        let same = ka === kb;
        if(!same && Math.min(ka.length, kb.length) >= 9 && Math.abs(ka.length - kb.length) <= 1) same = L2N.distance(ka, kb) <= 1;
        if(same) parent.set(find(a), find(b));
      }
    }
    const groups = new Map();
    nicks.forEach(n => { const r = find(n); if(!groups.has(r)) groups.set(r, []); groups.get(r).push(n); });
    return [...groups.values()].filter(g => g.length > 1).map(g => {
      // главным по умолчанию — написание из переписи (где встречается в большем числе дат), дальше по общей используемости
      g.sort((a, b) => info.get(b).cw - info.get(a).cw || info.get(b).total - info.get(a).total || info.get(b).last.localeCompare(info.get(a).last));
      return { nicks: g, info: g.map(n => ({ nick: n, by: info.get(n).by, total: info.get(n).total, last: info.get(n).last, cw: info.get(n).cw })), key: g.slice().sort().join("\u0001") };
    }).sort((a, b) => b.info.reduce((s, x) => s + x.total, 0) - a.info.reduce((s, x) => s + x.total, 0));
  }

  // «очевидные» объединения: внутри группы ники, у которых совпадает ключ без регистра/с похожими символами (caseKey).
  // Целевое написание — то, что чаще в переписи (главный справочник), при равенстве — самое используемое.
  function obviousMerges(groups, ignored){
    const out = [];
    groups.filter(g => !ignored.has("twin:" + g.key)).forEach(g => {
      const parts = new Map();
      g.info.forEach(x => { const k = global.L2Nick.caseKey(x.nick); if(!parts.has(k)) parts.set(k, []); parts.get(k).push(x); });
      parts.forEach(arr => {
        if(arr.length < 2) return;
        arr.sort((a, b) => b.cw - a.cw || b.total - a.total || b.last.localeCompare(a.last));
        out.push({ target: arr[0].nick, others: arr.slice(1).map(x => x.nick) });
      });
    });
    return out;
  }

  // Что делать с ником, убранным из переписи: pool — ники самой свежей переписи. Если в ней есть ровно один ник с тем же «ключом»
  // (то же имя с точностью до регистра/похожих символов/потерянной буквы в ключе) — это двойник: { nick, merge: правильный ник }.
  // Иначе человек ушёл: { nick } — убрать из состава.
  function cleanupPlan(gone, pool){
    const L2N = global.L2Nick;
    return gone.map(n => {
      if(!L2N || AMB.test(n)) return { nick: n };
      const key = L2N.ocrKey(n);
      const twins = pool.filter(c => c !== n && L2N.ocrKey(c) === key);
      return twins.length === 1 ? { nick: n, merge: twins[0] } : { nick: n };
    });
  }

  // ---------- проверка всего клана ----------
  // Возвращает { censusNicks, censusWeeks, classes, used, orphans, twins }. L2Nick должен быть загружен (L2Nick.init) — без него
  // не сводятся написания, и «проблемных» было бы слишком много.
  async function audit(db, clanId){
    if(global.L2Nick && !global.L2Nick.ready()){ try { await global.L2Nick.init(db, clanId); } catch(e){ console.error(e); } }
    const pick = async (table, c, order) => {
      const r = await selectAll(() => order.reduce((q, o) => q.order(o), db.from(table).select(c)));
      if(r.error) console.error(table, r.error);
      return r.data || [];
    };
    const [census, classes, groupsRes, att, ...rest] = await Promise.all([
      selectAll(() => db.from("census_entries").select("nickname, week_start").order("id")),
      selectAll(() => db.from("member_classes").select("nickname, class_name").order("nickname")),
      db.from("clan_groups").select("leader_nickname, deputy_nickname"),
      global.L2Cabinet.attendanceSummary ? global.L2Cabinet.attendanceSummary() : Promise.resolve(null),
      ...["clan_group_members", "boost_member_values", "loot_leader_coefficients", "roster_tagged_members", "tax_payments", "tax_donations", "event_stats"]
        .map(tn => { const tb = TABLES.find(x => x.t === tn); return pick(tn, "nickname", tb.order); }),
    ]);
    if(census.error) throw census.error;
    const names = ["clan_group_members", "boost_member_values", "loot_leader_coefficients", "roster_tagged_members", "tax_payments", "tax_donations", "event_stats"];

    const censusNicks = new Set(), censusWeeks = new Map();
    (census.data || []).forEach(r => {
      censusNicks.add(r.nickname);
      if(!censusWeeks.has(r.nickname)) censusWeeks.set(r.nickname, new Set());
      censusWeeks.get(r.nickname).add(r.week_start);
    });
    const classMap = new Map((classes.data || []).map(r => [r.nickname, r.class_name]));

    const used = new Map(); // ник → Map(подпись → число)
    const add = (nick, lbl, n) => { if(!nick) return; if(!used.has(nick)) used.set(nick, new Map()); const m = used.get(nick); m.set(lbl, (m.get(lbl) || 0) + (n || 1)); };
    (classes.data || []).forEach(r => add(r.nickname, label(TABLES[1]), 1));
    names.forEach((tn, i) => { const tb = TABLES.find(x => x.t === tn); (rest[i] || []).forEach(r => add(r.nickname, label(tb), 1)); });
    ((groupsRes && groupsRes.data) || []).forEach(g => { add(g.leader_nickname, LEADER(), 1); add(g.deputy_nickname, DEPUTY(), 1); });
    if(att) att.forEach(r => add(r.nickname, label(TABLES[5]), Number(r.entries) || 1));
    else (await pick("attendance_entries", "nickname", ["id"])).forEach(r => add(r.nickname, label(TABLES[5]), 1));

    const resolve = (n) => (global.L2Nick && global.L2Nick.ready()) ? global.L2Nick.resolve(n) : { how: "none", canon: n };
    const orphans = [];
    used.forEach((by, nick) => {
      if(censusNicks.has(nick)) return;
      const r = resolve(nick);
      if(["alias", "exact", "case", "ocr"].includes(r.how) && censusNicks.has(r.canon)) return; // написание отличается, но уже сводится к нику из переписи
      orphans.push({ nick, by, total: [...by.values()].reduce((s, x) => s + x, 0) });
    });
    orphans.sort((a, b) => b.total - a.total || a.nick.localeCompare(b.nick));
    const pool = [...censusNicks];
    orphans.forEach(o => {
      const my = classMap.get(o.nick) ? String(classMap.get(o.nick)).toLowerCase() : "";
      const sameCls = (c) => !!(my && classMap.get(c) && String(classMap.get(c)).toLowerCase() === my);
      if(global.L2Nick && AMB.test(o.nick)){
        // ник из неотличимых символов: подсказки среди таких же ников, по профессии (если у этого ника она известна)
        o.sug = global.L2Nick.suggestAmbiguous(o.nick, pool, my ? sameCls : undefined).slice(0, 3);
      } else {
        o.sug = (global.L2Nick ? global.L2Nick.suggest(o.nick, pool, 6) : []).map(s => ({
          nick: s.nick, dist: s.dist, classMatch: sameCls(s.nick),
        })).sort((a, b) => (b.classMatch - a.classMatch) || (a.dist - b.dist)).slice(0, 3);
      }
    });
    const twins = findTwins(used, censusWeeks);
    return { censusNicks, censusWeeks, classes: classMap, used, orphans, twins, clanId };
  }

  // сколько всего «нужно проверить» (для значка «!»): проблемные ники + группы похожих написаний, которые не отмечены «разные игроки / скрыть»
  function attentionCount(result, clanId){
    const ig = loadIgnored(clanId || result.clanId);
    return result.orphans.filter(o => !ig.has(o.nick)).length + result.twins.filter(g => !ig.has("twin:" + g.key)).length;
  }
  // кэш числа в браузере: значок не должен ради каждой загрузки сайта гонять проверку всей базы
  const cacheKey = (clanId) => "l2NickAttention:" + clanId;
  function cachedCount(clanId){
    try { const c = JSON.parse(global.localStorage.getItem(cacheKey(clanId)) || "null"); return c && typeof c.n === "number" ? c : null; } catch(e){ return null; }
  }
  function setCachedCount(clanId, n){
    try { global.localStorage.setItem(cacheKey(clanId), JSON.stringify({ t: Date.now(), n })); } catch(e){}
  }

  global.L2NickTools = { TABLES, label, usage, rename, removeFromRoster, findTwins, obviousMerges, cleanupPlan, audit, attentionCount, cachedCount, setCachedCount, loadIgnored, saveIgnored };
})(window);
