// Единое сопоставление ников для ДКП и «Раздачи».
//
// Ник попадает в систему из разных источников: перепись (набирается/распознаётся одним способом),
// «Журнал посещаемости» и скрины мероприятий (распознаются OCR другим способом), «Группы» (вводятся руками).
// Один и тот же человек в них часто записан чуть по-разному: BloodyRaB3n / BloodYRaB3n, B1oodShaman / BloodShaman.
//
// Принципы:
//  1. Точность важнее охвата: если подходящих ников больше одного («Олежа» и «ОлЕжА» — разные игроки), не склеиваем.
//  2. Ступени от строгой к мягкой, первая сработавшая и есть ответ: точное совпадение → без учёта регистра →
//     с учётом путаницы символов при распознавании (l/I/1/|, 0/O, rn/m, vv/w, cl/d, 5/S, 8/B ...).
//  3. Справочники идут по важности (tiers): сначала ищем среди ников последней переписи, потом среди остальных.
//  4. Привязки (aliases) — ручные решения клан-лидера «этот ник = вот этот игрок», хранятся в базе (nick_aliases)
//     и имеют приоритет над любым автоматическим угадыванием.
//  5. Для всего, что не опознано, есть подсказки (suggest) — самые похожие ники из переписи.
//
// Использование:
//   const r = L2Nick.createResolver({ tiers: [censusNicks, otherNicks], aliases: [{ alias, canonical }] });
//   r.key(nick)    — ключ человека (одинаков у всех написаний одного и того же человека)
//   r.canon(nick)  — «правильное» написание из справочника (или сам nick, если не опознан)
//   r.resolve(nick) -> { canon, key, how: "alias"|"exact"|"case"|"ocr"|"ambiguous"|"none", candidates }
//   r.suggest(nick, pool, max) -> [{ nick, dist }]
(function(global){
  "use strict";

  // кириллица ↔ латиница одного регистра и путаемые символы (та же схема, что normalizeNick в остальных разделах)
  const CYR = { "а":"a","в":"b","е":"e","к":"k","м":"m","н":"h","о":"o","р":"p","с":"c","т":"t","у":"y","х":"x","ё":"e",
    "А":"A","В":"B","Е":"E","К":"K","М":"M","Н":"H","О":"O","Р":"P","С":"C","Т":"T","У":"Y","Х":"X","Ё":"E",
    "0":"O","l":"I","|":"I" };
  const ONLY_CONFUSABLE = /^[0Oo1lIi|!]{3,}$/;

  // ступень 1 — «ключ человека» (регистр сохраняется)
  function norm(s){
    const raw = String(s == null ? "" : s);
    if(ONLY_CONFUSABLE.test(raw)) return "=" + raw; // ники целиком из путаемых символов — только точное совпадение
    const key = raw.split("").map(ch => CYR[ch] || ch).join("").replace(/[^A-Za-zА-Яа-яЁё0-9]/g, "");
    return key || "=" + raw;
  }

  // ступень 2 — то же без учёта регистра
  const LOOSE = { "а":"a","в":"b","е":"e","к":"k","м":"m","н":"h","о":"o","р":"p","с":"c","т":"t","у":"y","х":"x","ё":"e","0":"o","l":"i" };
  function caseKey(s){
    return String(s == null ? "" : s).toLowerCase().split("").map(ch => LOOSE[ch] || ch).join("").replace(/[^a-zа-яё0-9]/g, "");
  }

  // ступень 3 — с учётом типичной путаницы при распознавании
  function ocrKey(s){
    let k = String(s == null ? "" : s).toLowerCase();
    k = k.replace(/rn/g, "m").replace(/vv/g, "w").replace(/cl/g, "d"); // до замены l→i
    k = k.replace(/[!|¡]/g, "i");
    k = k.split("").map(ch => LOOSE[ch] || ch).join("");
    k = k.replace(/1/g, "i").replace(/5/g, "s").replace(/8/g, "b").replace(/2/g, "z").replace(/6/g, "g");
    return k.replace(/[^a-zа-яё0-9]/g, "");
  }

  // расстояние Дамерау–Левенштейна (вставка/удаление/замена/перестановка соседних) — для подсказок
  function distance(a, b){
    if(a === b) return 0;
    const la = a.length, lb = b.length;
    if(!la) return lb; if(!lb) return la;
    const d = [];
    for(let i = 0; i <= la; i++){ d[i] = [i]; }
    for(let j = 0; j <= lb; j++){ d[0][j] = j; }
    for(let i = 1; i <= la; i++){
      for(let j = 1; j <= lb; j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost);
        if(i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) d[i][j] = Math.min(d[i][j], d[i-2][j-2] + 1);
      }
    }
    return d[la][lb];
  }

  function addTo(map, k, nkey, display){
    if(!map.has(k)) map.set(k, new Map());
    if(!map.get(k).has(nkey)) map.get(k).set(nkey, display);
  }
  function buildTier(list){
    const exact = new Map(), byCase = new Map(), byOcr = new Map();
    (list || []).forEach(n => {
      const k = norm(n);
      if(!exact.has(k)) exact.set(k, n);
      if(!k.startsWith("=")){
        addTo(byCase, caseKey(n), k, n);
        addTo(byOcr, ocrKey(n), k, n);
      }
    });
    return { exact, byCase, byOcr, list: list || [] };
  }
  const firstOf = (m) => { const e = m.entries().next().value; return { key: e[0], display: e[1] }; };

  function createResolver(opts){
    opts = opts || {};
    const tiers = (opts.tiers || []).map(buildTier);
    const aliasMap = new Map();
    (opts.aliases || []).forEach(a => { if(a && a.alias && a.canonical) aliasMap.set(norm(a.alias), a.canonical); });

    function resolve(nick){
      const k = norm(nick);
      // 1. ручная привязка клан-лидера — главнее любого угадывания
      if(aliasMap.has(k)){ const c = aliasMap.get(k); return { canon: c, key: norm(c), how: "alias", candidates: [] }; }
      // 2. ники из одних путаемых символов — только точное совпадение
      if(k.startsWith("=")){
        for(const t of tiers) if(t.exact.has(k)) return { canon: t.exact.get(k), key: k, how: "exact", candidates: [] };
        return { canon: nick, key: k, how: "none", candidates: [] };
      }
      // 3. по справочникам: в каждом точное → без регистра → путаница при распознавании; единственное совпадение
      const ck = caseKey(nick), ok = ocrKey(nick);
      let ambiguous = null;
      for(const t of tiers){
        if(t.exact.has(k)) return { canon: t.exact.get(k), key: k, how: "exact", candidates: [] };
        const m1 = t.byCase.get(ck);
        if(m1){
          if(m1.size === 1){ const f = firstOf(m1); return { canon: f.display, key: f.key, how: "case", candidates: [] }; }
          ambiguous = ambiguous || [...m1.values()];
        }
        const m2 = t.byOcr.get(ok);
        if(m2){
          if(m2.size === 1){ const f = firstOf(m2); return { canon: f.display, key: f.key, how: "ocr", candidates: [] }; }
          ambiguous = ambiguous || [...m2.values()];
        }
      }
      return { canon: nick, key: k, how: ambiguous ? "ambiguous" : "none", candidates: ambiguous || [] };
    }

    // подсказки для неопознанного ника: самые похожие ники из pool (по умолчанию — первый справочник)
    function suggest(nick, pool, max){
      const src = pool || (tiers[0] ? tiers[0].list : []);
      const q = ocrKey(nick);
      if(!q) return [];
      const maxDist = q.length >= 9 ? 2 : (q.length >= 5 ? 1 : 0);
      const seen = new Set(), out = [];
      src.forEach(n => {
        if(seen.has(n)) return; seen.add(n);
        const c = ocrKey(n);
        if(!c || Math.abs(c.length - q.length) > maxDist) return;
        const dist = distance(q, c);
        if(dist <= maxDist) out.push({ nick: n, dist });
      });
      out.sort((a, b) => a.dist - b.dist || a.nick.localeCompare(b.nick));
      return out.slice(0, max || 3);
    }

    return { resolve, key: (n) => resolve(n).key, canon: (n) => resolve(n).canon, suggest };
  }

  global.L2Nick = { norm, caseKey, ocrKey, distance, createResolver };
})(window);
