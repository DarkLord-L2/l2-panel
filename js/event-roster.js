// Мини-ростер явки на одно мероприятие (используется «Журналом посещаемости»).
// В отличие от js/week-roster.js — не синглтон на страницу: работает в границах
// переданного root-элемента, поэтому на одной странице можно создать сколько
// угодно копий (по одной на мероприятие). Строит свою разметку сам — вызывающему
// коду достаточно передать пустой контейнер.
//
// Те же скрины, что отмечают явку, заодно читаются на боевую статистику (килы/
// смерти/PvP/PvE урон — L2Cabinet.adminOcrEventStats) и при сохранении явки
// автоматически попадают в event_stats. Отдельного шага «добавить статистику»
// в «Отчётах по мероприятиям» больше нет — эта страница лишь показывает то,
// что уже посчиталось здесь.
//
// Профессию по иконке нейросеть не читает (пробовали — не вышло). Теперь иконки сравниваются с эталонами локально,
// в браузере (js/class-icon-match.js): уверенные профессии записываются как правки «на это мероприятие»
// (report_class_overrides, source = auto), сомнительные админ подтверждает вопросом перед сохранением. Ручные правки
// из «Отчётов» всегда главнее автоматических.

// ---- сверка распознанного OCR-ника со списком реальных ников клана (перепись) ----
// точное/нормализованное совпадение уже спасает от похожих букв (0/O, кириллица/
// латиница — CYR_LOOKALIKES) и регистра; но иногда Gemini теряет/путает целую
// букву («Лунтик» → «Луник») — такое нормализация не ловит, нужно нечёткое
// сравнение (расстояние Левенштейна) с самым близким известным ником
const CYR_LOOKALIKES = { "а":"a","в":"b","е":"e","к":"k","м":"m","н":"h","о":"o","р":"p","с":"c","т":"t","у":"y","х":"x","ё":"e","0":"o","l":"i" };
function normalizeNick(s){
  return String(s || "")
    .toLowerCase()
    .split("").map(ch => CYR_LOOKALIKES[ch] || ch).join("")
    .replace(/[^a-zа-яё0-9]/gi, "");
}
function levenshtein(a, b){
  const m = a.length, n = b.length;
  if(!m) return n;
  if(!n) return m;
  const row = new Array(n + 1);
  for(let j = 0; j <= n; j++) row[j] = j;
  for(let i = 1; i <= m; i++){
    let prev = row[0];
    row[0] = i;
    for(let j = 1; j <= n; j++){
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}
// чем короче ник, тем рискованнее угадывать буквами — совсем коротким (≤4)
// доверяем только точному/нормализованному совпадению, длинным разрешаем
// побольше «слабины»
function maxAllowedDistance(len){
  if(len <= 4) return 0;
  if(len <= 7) return 1;
  return 2;
}

// список ников из переписи — за всё время (не только последняя неделя), чтобы не
// упустить того, кто просто выпал из самой свежей переписи, но реально на скрине.
// Один запрос на всю страницу, а не на каждый день/мероприятие — кэшируется тут же
let knownNicksPromise = null;
function loadKnownNicks(db){
  if(!knownNicksPromise){
    knownNicksPromise = L2Cabinet.selectAll(() => db.from("census_entries").select("nickname").order("id"))
      .then(({ data }) => [...new Set((data || []).map(r => r.nickname))]);
  }
  return knownNicksPromise;
}

// Контекст для проверки ников в окне «Проверка распознанного»: ники последней переписи, вся история переписи и профессии
// (для подсказки «это он?»: у похожего ника та же профессия — почти наверняка один человек). Грузится один раз на страницу
let nickCtxPromise = null;
function loadNickCtx(db){
  if(!nickCtxPromise){
    nickCtxPromise = (async () => {
      const known = await loadKnownNicks(db);
      let latest = new Set();
      try { const r = await L2Cabinet.censusWeeks(1); latest = new Set((r.rows || []).map(x => x.nickname)); } catch(e){ console.error(e); }
      let cls = new Map();
      try { const { data } = await db.from("member_classes").select("nickname, class_name"); cls = new Map((data || []).map(r => [r.nickname, r.class_name])); } catch(e){ console.error(e); }
      return { known: new Set(known), latest, cls, pool: [...new Set([...latest, ...known])], memo: new Map() };
    })();
  }
  return nickCtxPromise;
}
// (ник, профессия со скрина) → { status: "latest"|"old"|"unknown", sug: [{ nick, dist, classMatch }] }
function makeNickInfo(ctx){
  return (nick, clsName) => {
    const key = nick + "\u0001" + (clsName || "");
    if(ctx.memo.has(key)) return ctx.memo.get(key);
    let res;
    if(ctx.latest.has(nick)) res = { status: "latest", sug: [] };
    else if(ctx.known.has(nick)){
      // есть только в старых переписях: если в СВЕЖЕЙ есть очень похожий ник — это, скорее всего, прежнее неверное написание (двойник)
      const want = clsName ? String(clsName).toLowerCase() : "";
      const near = (window.L2Nick && !/^[0Oo1lIi|!]{3,}$/.test(nick) ? L2Nick.suggest(nick, [...ctx.latest], 3) : []).map(sg => ({
        nick: sg.nick, dist: sg.dist, classMatch: !!(want && ctx.cls.get(sg.nick) && String(ctx.cls.get(sg.nick)).toLowerCase() === want),
      }));
      res = { status: "old", sug: near };
    }
    else {
      const want = clsName ? String(clsName).toLowerCase() : "";
      const sameCls = (c) => !!(ctx.cls.get(c) && String(ctx.cls.get(c)).toLowerCase() === want);
      let cand;
      if(!window.L2Nick) cand = [];
      else if(/^[0Oo1lIi|!]{3,}$/.test(nick)){
        // ник из неотличимых символов: подсказки только среди таких же ников, по профессии со скрина (см. L2Nick.suggestAmbiguous)
        cand = L2Nick.suggestAmbiguous(nick, ctx.pool, want ? sameCls : undefined);
      } else {
        cand = L2Nick.suggest(nick, ctx.pool, 6).map(sg => ({ nick: sg.nick, dist: sg.dist, classMatch: !!(want && sameCls(sg.nick)) }));
        cand.sort((a, b) => (b.classMatch - a.classMatch) || (a.dist - b.dist));
      }
      res = { status: "unknown", sug: cand.slice(0, 3) };
    }
    ctx.memo.set(key, res);
    return res;
  };
}

// ник целиком из символов, которые в шрифте игры не отличить друг от друга
// (0 O o 1 l I i | !) — «0000000000», «1111111111», «iIiIiIiIIiIi». По картинке
// такие ники не различить, поэтому их не «исправляем» по базе, а только
// подсвечиваем админу: пусть сверит со скрином сам
function isAmbiguousNick(s){
  return /^[0Oo1lIi|!]{3,}$/.test(String(s || ""));
}

// Сверка распознанных ников ОДНОГО скрина с переписью. Правила:
//  1) точное совпадение (с регистром) — ник не трогаем; в L2 «Олежа» и «ОлЕжА»
//     могут быть двумя разными игроками;
//  2) неоднозначные ники (isAmbiguousNick) — только точное совпадение, никакой
//     нормализации/нечёткого поиска;
//  3) нормализованное совпадение принимаем, только если кандидат ровно один и
//     не занят другой строкой этого же скрина;
//  4) нечёткий (Левенштейн) — аналогично, занятые ники не берём;
//  5) один известный ник достаётся не больше чем одной строке скрина — иначе
//     два разных человека склеились бы в одного.
// Возвращает Set ников, которые НЕ удалось сопоставить из-за того, что кандидат
// уже занят/неоднозначен (чтобы подсветить их в чипах).
function resolveNicknames(rows, knownNicks){
  const collided = new Set();
  // проход -1 — правило ников клана (js/nick-match.js): латиница и кириллица в одном нике не смешиваются; если смесь
  // и каждой «чужой» букве есть однозначный двойник — приводим ник к одному алфавиту (латинская B вместо русской В и т.п.)
  if(window.L2Nick && L2Nick.scriptFix){
    const used0 = new Set(rows.map(r => r.nickname));
    rows.forEach(r => {
      const sf = L2Nick.scriptFix(r.nickname);
      if(sf && sf !== r.nickname && !used0.has(sf)){ used0.delete(r.nickname); r.nickname = sf; used0.add(sf); }
    });
  }
  // проход 0 — общий справочник (js/nick-match.js): ручные привязки и ник из ПОСЛЕДНЕЙ переписи (регистр, путаница
  // символов) главнее старых написаний за всё время. Если два разных ника скрина сошлись на один — не трогаем второй
  if(window.L2Nick && L2Nick.ready()){
    const used = new Set(rows.map(r => r.nickname));
    rows.forEach(r => {
      const g = L2Nick.resolve(r.nickname);
      if((g.how === "alias" || g.how === "case" || g.how === "ocr") && g.canon !== r.nickname && !used.has(g.canon)){
        used.delete(r.nickname); r.nickname = g.canon; used.add(g.canon);
      }
    });
  }
  if(!rows.length || !knownNicks || !knownNicks.length) return collided;
  const known = new Set(knownNicks);
  const taken = new Set();
  // проход 1: точные совпадения занимают свои ники первыми
  rows.forEach(r => { if(known.has(r.nickname)) taken.add(r.nickname); });
  // проход 2: остальные
  rows.forEach(r => {
    const raw = r.nickname;
    if(known.has(raw)) return;
    if(isAmbiguousNick(raw)) return;
    const rawNorm = normalizeNick(raw);
    if(!rawNorm) return;

    const sameNorm = knownNicks.filter(k => normalizeNick(k) === rawNorm);
    if(sameNorm.length){
      const free = sameNorm.filter(k => !taken.has(k));
      if(free.length === 1){ r.nickname = free[0]; taken.add(free[0]); }
      else collided.add(raw); // несколько кандидатов или единственный уже занят
      return;
    }

    const limit = maxAllowedDistance(rawNorm.length);
    if(limit === 0) return;
    let best = null, bestDist = Infinity, tie = false;
    knownNicks.forEach(k => {
      if(taken.has(k) || isAmbiguousNick(k)) return;
      const d = levenshtein(rawNorm, normalizeNick(k));
      if(d < bestDist){ bestDist = d; best = k; tie = false; }
      else if(d === bestDist) tie = true; // два одинаково близких ника — не угадываем
    });
    if(best && !tie && bestDist <= limit){ r.nickname = best; taken.add(best); }
  });
  return collided;
}

function initEventRoster({ root, eventId, profile, isAdmin, db }){
  root.innerHTML = `
    <div class="chip-row" data-role="list"></div>
    <p class="empty-hint" data-role="empty" style="display:none;">${L2I18n.t("eventRoster.notMarkedHint", "Явка ещё не отмечена.")}</p>
    ${isAdmin ? `<button class="btn" data-role="add-btn" style="margin-top:8px;">${L2I18n.t("eventRoster.addAttendanceBtn", "+ Добавить явку")}</button>` : ""}
    ${isAdmin ? `
    <div data-role="upload" class="er-up" style="display:none;">
      <input type="file" data-role="file-input" accept="image/*" multiple style="display:none;" />
      <div class="er-steps" data-role="steps">
        <div class="er-step on"><span class="er-n">1</span>${L2I18n.t("eventRoster.step1", "Загрузить")}</div>
        <div class="er-step"><span class="er-n">2</span>${L2I18n.t("eventRoster.step2", "Проверить")}</div>
        <div class="er-step"><span class="er-n">3</span>${L2I18n.t("eventRoster.step3", "Сохранить")}</div>
      </div>
      <div class="er-drop">
        <span class="er-drop-ic" aria-hidden="true">⇪</span>
        <div class="er-drop-txt">
          <b>${L2I18n.t("eventRoster.dropTitle", "Перетащите скрины сюда или вставьте Ctrl+V")}</b>
          <small>${L2I18n.t("eventRoster.dropHint", "Можно сразу несколько (до 9): пати 1, пати 2, соло — каждый скрин считается отдельной пати")}</small>
        </div>
        <button class="btn" data-role="file-btn">${L2I18n.t("eventRoster.pickFilesBtn", "Выбрать файлы…")}</button>
      </div>
      <p class="upload-status" data-role="status"></p>
      <div data-role="review-row" class="er-reviewrow"><button class="btn" data-role="review-btn" style="display:none;"></button></div>
      <div class="er-body" data-role="chips"></div>
      <div data-role="classes" class="er-classes"></div>
      <div class="er-manual">
        <div class="er-manual-title">${L2I18n.t("eventRoster.manualTitle", "Добавить игрока вручную")}</div>
        <div class="er-manual-row">
          <input type="text" data-role="manual-input" placeholder="${L2I18n.t("eventRoster.manualNickPh", "Ник игрока")}" />
          <select data-role="manual-party" title="${L2I18n.t("eventRoster.manualPartyTitle", "К какой пати отнести")}"></select>
          <button class="btn" data-role="manual-btn">${L2I18n.t("common.add", "Добавить")}</button>
        </div>
        <small class="er-manual-hint" data-role="manual-hint"></small>
      </div>
      <p class="error-msg" data-role="error"></p>
      <div class="er-foot">
        <span class="er-foot-info" data-role="foot-info"></span>
        <span class="er-foot-btns">
          <button class="btn btn-ghost" data-role="cancel-btn">${L2I18n.t("common.cancel", "Отмена")}</button>
          <button class="btn btn-primary" data-role="save-btn">${L2I18n.t("eventRoster.saveAttendance", "Сохранить явку")}</button>
        </span>
      </div>
    </div>` : ""}
  `;

  const q = (role) => root.querySelector(`[data-role="${role}"]`);
  // Ctrl+V скрина из буфера и перетаскивание файлов — в тот же file-input (js/paste-drop.js)
  if(isAdmin && window.L2PasteDrop) L2PasteDrop.attach(q("file-input"), q("upload")); // подсказка про Ctrl+V уже в самом блоке загрузки

  // язык может смениться, пока этот блок явки уже отрисован (переключатель живёт
  // в родительском окне) — точечно обновляем статичные подписи, не перестраивая
  // разметку целиком (иначе слетели бы уже навешанные обработчики)
  function applyLangRefresh(){
    q("empty").textContent = L2I18n.t("eventRoster.notMarkedHint", "Явка ещё не отмечена.");
    if(isAdmin){
      q("add-btn").textContent = L2I18n.t("eventRoster.addAttendanceBtn", "+ Добавить явку");
      q("file-btn").textContent = L2I18n.t("eventRoster.pickFilesBtn", "Выбрать файлы…");
      q("manual-input").placeholder = L2I18n.t("eventRoster.manualNickPh", "Ник игрока");
      q("manual-btn").textContent = L2I18n.t("common.add", "Добавить");
      q("cancel-btn").textContent = L2I18n.t("common.cancel", "Отмена");
    }
    render();
    if(isAdmin) renderChips();
  }
  // root живёт только пока открыто окно этого дня — после закрытия дальше не
  // трогаем (иначе за сессию накопились бы «зомби»-обработчики на старых блоках)
  // окно дня закрыли (root убран из страницы) — обработчик снимает сам себя, чтобы за сессию они не копились
  window.addEventListener("storage", function onLang(e){
    if(!document.body.contains(root)){ window.removeEventListener("storage", onLang); return; }
    if(e.key !== "l2Lang") return;
    applyLangRefresh();
  });

  let entries = [];
  let pending = [];
  let pendingStats = new Map(); // nickname -> {kills, deaths, pvp_damage, pve_damage}, из тех же скринов
  let pendingCollided = new Set(); // ники, которые не удалось сверить с переписью из-за конфликта внутри скрина
  let pendingBatchOf = new Map(); // nickname -> индекс скрина (в этой сессии загрузки), с которого он распознан
  let batchCount = 0; // сколько скринов в этой сессии дали хотя бы одного распознанного ника
  // индекс скрина -> ник его пати-лидера (для «Раздачи») — распознаётся OCR из
  // подписи «Лидер: …» над таблицей (ocr-event-stats возвращает её отдельно от
  // строк). На скринах статы отсортированы по урону/килам, поэтому лидер НЕ всегда
  // первая строка — раньше так считали и получали не того лидера. Если подписи на
  // скрине не было (старый тип скрина без неё) или OCR её не распознал —
  // откатываемся на прежнее допущение «первая строка».
  let batchLeaderOf = new Map();
  let pendingClass = new Map(); // ник -> { className, score, margin, needsCheck, top, crop, confirmed, skipped } — профессия по иконке скрина
  let classNotes = [];          // пояснения, почему профессии на скрине не определены
  // копии строк каждого скрина для окна «Проверить распознанное» (js/screenshot-review.js):
  // [{ idx, image, rows: [{ nick, orig, kills, deaths, pvp, pve, cls, leader }] }]
  let reviewScreens = [];
  // исправленные автоматически (по справочнику переписи): текущий ник → как пришёл со скрина
  let pendingFixed = new Map();
  // ники, которые админ осознанно оставил как есть («это новый игрок», «оставить»)
  let acknowledged = new Set();
  // ники, добавленные вручную: ник → { batch } — к какой пати отнесён (индекс скрина этой загрузки, "S:<id>" для уже сохранённой пати
  // этого мероприятия, либо без batch — «Соло»)
  let manualMeta = new Map();
  let savedParties = null;   // пати этого мероприятия, уже сохранённые в базе: [{ id, leader, count }]
  let prevInfo = null;       // прошлая явка этого же мероприятия: { date, nicks } или false, если сравнивать не с чем
  let nickInfoFn = null;     // сверка ника с переписью (js: makeNickInfo), появляется после загрузки справочников
  let nickInfoLoading = false;

  // ключ человека для сравнения ников (через общий справочник, если он загружен)
  const keyOf = (n) => (window.L2Nick && L2Nick.ready()) ? L2Nick.key(n) : String(n || "");

  async function load(){
    const { data, error } = await db
      .from("attendance_entries")
      .select("id, nickname")
      .eq("event_id", eventId)
      .order("nickname");
    // Один ник в мероприятии — одна запись. Дубли появлялись при двойном нажатии «Сохранить»: весь список записывался дважды
    // (в окне ники шли парами, а в отчёте было «39 из 38»). Показываем без повторов, а лишние строки админ при открытии убирает.
    const byNick = new Map(), extraIds = [];
    (error ? [] : (data || [])).forEach(e => {
      const k = keyOf(e.nickname);
      if(!byNick.has(k)) byNick.set(k, { id: e.id, nickname: e.nickname, ids: [e.id] });
      else { byNick.get(k).ids.push(e.id); extraIds.push(e.id); }
    });
    entries = [...byNick.values()];
    if(isAdmin && extraIds.length){
      const { error: delErr } = await db.from("attendance_entries").delete().in("id", extraIds);
      if(delErr) console.error(delErr);
    }
    render();
  }

  function render(){
    const list = q("list");
    list.innerHTML = "";
    q("empty").style.display = entries.length ? "none" : "";
    entries.forEach(entry => {
      const chip = document.createElement("div");
      chip.className = "chip roster-chip";
      const span = document.createElement("span");
      span.textContent = entry.nickname;
      chip.appendChild(span);
      if(isAdmin){
        const x = document.createElement("button");
        x.textContent = "×";
        x.title = L2I18n.t("eventRoster.removeFromAttendanceTitle", "Убрать из явки");
        x.addEventListener("click", async () => {
          // явку убираем, а статистику не стираем — только помечаем removed=true,
          // чтобы килы/смерти не терялись из истории; в «Отчётах» такая строка
          // помечается и уходит в самый низ, а не пропадает молча
          await db.from("event_stats").update({ removed: true, updated_at: new Date().toISOString() })
            .eq("event_id", eventId).eq("nickname", entry.nickname);
          const { error } = await db.from("attendance_entries").delete().in("id", entry.ids || [entry.id]);
          if(!error) await load();
        });
        chip.appendChild(x);
      }
      list.appendChild(chip);
    });
  }

  if(isAdmin){
    // ---------- окно загрузки: шаги, сводка, ники по пати со статусами ----------
    const T = (k, f) => L2I18n.t(k, f);
    const el = (tag, cls, text) => { const e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; };
    const zeroStats = () => ({ kills: 0, deaths: 0, pvp_damage: 0, pve_damage: 0, manual: true });

    // справочники переписи грузятся один раз на страницу; пока их нет, ники показываются без статусов, потом список перерисуется
    function ensureNickInfo(){
      if(nickInfoFn || nickInfoLoading) return;
      nickInfoLoading = true;
      loadNickCtx(db).then(ctx => { nickInfoFn = makeNickInfo(ctx); }).catch(e => console.error(e))
        .finally(() => { nickInfoLoading = false; if(nickInfoFn) renderChips(); });
    }

    // статус ника: ok — есть в переписи; fix — исправлен автоматически; chk — проверьте; new — нового игрока в переписи нет
    function statusOf(n){
      const c = pendingClass.get(n);
      const inf = nickInfoFn ? nickInfoFn(n, c && c.className) : null;
      const sug = inf ? inf.sug : [];
      let st;
      if(isAmbiguousNick(n)) st = { k: "chk", why: T("eventRoster.ambiguousNick", "Ник из похожих символов (0 O 1 l I i) — сверьте со скрином") };
      else if(pendingCollided.has(n)) st = { k: "chk", why: T("eventRoster.collidedNick", "Похож на ник из переписи, но тот уже занят другой строкой скрина — оставлен как распознан, проверьте") };
      else if(inf && inf.status === "unknown") st = sug.length
        ? { k: "chk", why: T("eventRoster.notInCensusAsk", "Нет в переписи. Это он?") }
        : { k: "new", why: T("eventRoster.newPlayerWhy", "Нет в переписи — новый игрок") };
      else if(inf && inf.status === "old" && sug.length) st = { k: "chk", why: T("review.oldButNear", "Есть только в старых переписях; в свежей — похожий:") };
      else if(pendingFixed.has(n)) st = { k: "fix", why: T("eventRoster.fixedWhy", "Исправлен по переписи: на скрине было «{from}»").replace("{from}", pendingFixed.get(n)) };
      else st = { k: "ok", why: "" };
      st.sug = st.k === "chk" ? sug : [];
      if(st.k === "chk" && acknowledged.has(n)) st = { k: "new", why: T("eventRoster.keptWhy", "Оставлен как есть"), sug: [] };
      return st;
    }

    // ключ пати ника: "n<idx>" — скрин этой загрузки, "S:<id>" — уже сохранённая пати мероприятия, "solo" — без пати
    function partyKey(n){ const b = pendingBatchOf.get(n); return b == null ? "solo" : (typeof b === "string" ? b : "n" + b); }
    const partyRank = (k) => k === "solo" ? 2000 : (k[0] === "n" ? +k.slice(1) : 1000);
    const savedParty = (key) => (savedParties || []).find(p => "S:" + p.id === key);
    function partyLeader(key){ return key[0] === "n" ? batchLeaderOf.get(+key.slice(1)) : (savedParty(key) || {}).leader; }

    function removeNick(n){
      const i = pending.indexOf(n); if(i >= 0) pending.splice(i, 1);
      [pendingStats, pendingBatchOf, pendingClass, pendingFixed, manualMeta].forEach(m => m.delete(n));
      pendingCollided.delete(n); acknowledged.delete(n);
      reviewScreens.forEach(sc => { sc.rows = sc.rows.filter(r => r.nick !== n); });
      renderChips(); updateReviewBtn();
    }

    // «это он?» — заменяем ник везде (в списке, статистике, пати, профессии, окне проверки) и запоминаем привязку на будущее
    function replaceNick(old, nw){
      const i = pending.indexOf(old); if(i < 0) return;
      const dup = pending.indexOf(nw);
      const mv = (m) => { if(m.has(old)){ if(!m.has(nw)) m.set(nw, m.get(old)); m.delete(old); } };
      [pendingStats, pendingBatchOf, pendingClass, manualMeta].forEach(mv);
      pendingFixed.set(nw, pendingFixed.has(old) ? pendingFixed.get(old) : old); pendingFixed.delete(old);
      pendingCollided.delete(old); acknowledged.delete(old);
      if(dup >= 0 && dup !== i) pending.splice(i, 1); else pending[i] = nw;
      batchLeaderOf.forEach((v, k) => { if(v === old) batchLeaderOf.set(k, nw); });
      reviewScreens.forEach(sc => sc.rows.forEach(r => { if(r.nick === old){ r.nick = nw; r.orig = nw; } }));
      saveAliases([{ alias: old, canonical: nw }]);
      renderChips(); updateReviewBtn();
    }

    function mkChip(n, s, leader){
      const chip = el("div", "chip er-chip er-" + s.k);
      chip.title = s.why || "";
      chip.appendChild(el("span", "", (leader ? "★ " : "") + ({ fix: "↺ ", chk: "⚠ ", new: "+ " }[s.k] || "") + n));
      const x = el("button", "", "×"); x.type = "button";
      x.title = T("eventRoster.removeFromListTitle", "Убрать из списка");
      x.addEventListener("click", () => removeNick(n));
      chip.appendChild(x);
      return chip;
    }

    function updateSteps(){
      const cur = pending.length ? 1 : 0;
      [...q("steps").children].forEach((d, i) => { d.classList.toggle("on", i === cur); d.classList.toggle("done", i < cur); });
    }

    // выбор пати для ручного добавления: Соло / новая пати / пати этой загрузки / уже сохранённая пати
    function renderPartySelect(){
      const sel = q("manual-party"); if(!sel) return;
      const prev = sel.value || "solo";
      const opts = [["solo", T("eventRoster.partyOptSolo", "Соло (без пати)")], ["new", T("eventRoster.partyOptNew", "Новая пати — этот ник лидер")]];
      [...batchLeaderOf.entries()].sort((a, b) => a[0] - b[0]).forEach(([idx, lead]) => {
        if(pending.some(n => pendingBatchOf.get(n) === idx)) opts.push(["n" + idx, T("eventRoster.partyOptOf", "Пати: {l}").replace("{l}", lead)]);
      });
      (savedParties || []).forEach(p => opts.push(["S:" + p.id, T("eventRoster.partyOptSaved", "Пати: {l} (уже сохранена)").replace("{l}", p.leader)]));
      const sig = JSON.stringify(opts);
      if(sel.dataset.sig === sig) return;
      sel.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
      sel.dataset.sig = sig;
      sel.value = opts.some(o => o[0] === prev) ? prev : "solo";
    }

    function addManual(raw, partyVal){
      const val = String(raw || "").trim();
      const hint = q("manual-hint");
      if(!val) return false;
      const dup = pending.find(n => keyOf(n) === keyOf(val));
      if(dup){ hint.textContent = T("eventRoster.manualDup", "«{n}» уже в списке — повторно не добавлен.").replace("{n}", dup); return false; }
      pending.push(val);
      const meta = {};
      let where = T("eventRoster.partySolo", "Соло / без пати");
      if(partyVal === "new"){
        const idx = batchCount++; batchLeaderOf.set(idx, val); meta.batch = idx;
        where = T("eventRoster.partyNewLeader", "новая пати, он лидер");
      } else if(/^n\d+$/.test(partyVal || "")){
        meta.batch = +partyVal.slice(1);
        where = T("eventRoster.partyOptOf", "Пати: {l}").replace("{l}", batchLeaderOf.get(meta.batch) || "?");
      } else if(String(partyVal || "").startsWith("S:")){
        meta.batch = partyVal;
        where = T("eventRoster.partyOptOf", "Пати: {l}").replace("{l}", (savedParty(meta.batch) || {}).leader || "?");
      }
      manualMeta.set(val, meta);
      if(meta.batch != null){ pendingBatchOf.set(val, meta.batch); pendingStats.set(val, zeroStats()); }
      hint.textContent = T("eventRoster.manualAdded", "Добавлен: {n} → {w}").replace("{n}", val).replace("{w}", where);
      return true;
    }

    function renderChips(){
      const box = q("chips");
      box.innerHTML = "";
      updateSteps();
      renderPartySelect();
      ensureNickInfo();
      const sts = new Map();
      if(pending.length || reviewScreens.length){
        pending.forEach(n => sts.set(n, statusOf(n)));

        // миниатюры скринов
        if(reviewScreens.length){
          const th = el("div", "er-thumbs");
          reviewScreens.forEach(sc => {
            const d = el("div", "er-th");
            const im = document.createElement("img"); im.src = sc.image; im.alt = "";
            const lead = batchLeaderOf.get(sc.idx);
            d.append(im, el("div", "er-th-t", T("eventRoster.screenN", "Скрин {n}").replace("{n}", sc.idx + 1)),
              el("div", "er-th-s", T("eventRoster.screenRows", "ников: {n}").replace("{n}", sc.rows.filter(r => r.nick).length) + (lead ? " · ★ " + lead : "")));
            th.appendChild(d);
          });
          box.appendChild(th);
        }

        // сводка
        const cnt = { fix: 0, chk: 0, new: 0 };
        sts.forEach(s => { if(cnt[s.k] != null) cnt[s.k]++; });
        const mt = el("div", "er-metrics");
        [[pending.length, T("eventRoster.mTotal", "в списке"), ""], [cnt.fix, T("eventRoster.mFixed", "исправлено само"), ""],
         [cnt.chk, T("eventRoster.mCheck", "проверить"), cnt.chk ? "warn" : ""], [cnt.new, T("eventRoster.mNew", "новых игроков"), ""]].forEach(([v, l, c]) => {
          const d = el("div", "er-mc" + (c ? " " + c : "")); d.append(el("b", "", v), el("span", "", l)); mt.appendChild(d);
        });
        box.appendChild(mt);

        // предупреждения
        const warns = [];
        reviewScreens.forEach(sc => {
          const k = sc.rows.filter(r => r.nick).length;
          if(k < 3) warns.push(T("eventRoster.warnFew", "Скрин {n}: распознано только {k} — возможно, скрин обрезан или таблица не поместилась.").replace("{n}", sc.idx + 1).replace("{k}", k));
        });
        const entryKeys = new Set(entries.map(e => keyOf(e.nickname)));
        const already = pending.filter(n => entryKeys.has(keyOf(n))).length;
        if(already) warns.push(T("eventRoster.warnDup", "Уже в явке этого мероприятия: {n} — повторно не добавятся (статистика обновится).").replace("{n}", already));
        let missing = [];
        if(prevInfo){
          const have = new Set([...pending, ...entries.map(e => e.nickname)].map(keyOf));
          missing = prevInfo.nicks.filter(n => !have.has(keyOf(n)));
          if(prevInfo.nicks.length >= 8 && have.size < prevInfo.nicks.length * 0.5)
            warns.push(T("eventRoster.warnLess", "В прошлый раз ({d}) было ников: {a}, сейчас: {b} — возможно, загружены не все скрины.").replace("{d}", prevInfo.date).replace("{a}", prevInfo.nicks.length).replace("{b}", have.size));
        }
        warns.forEach(w => box.appendChild(el("p", "er-warn", "⚠ " + w)));

        // нужно проверить
        const chk = pending.filter(n => sts.get(n).k === "chk");
        if(chk.length){
          const sec = el("div", "er-sec er-sec-chk");
          sec.appendChild(el("p", "er-h", T("eventRoster.secCheck", "Нужно проверить") + " (" + chk.length + ")"));
          chk.forEach(n => {
            const s = sts.get(n), row = el("div", "er-chk-row");
            row.appendChild(mkChip(n, s, false));
            row.appendChild(el("span", "er-why", s.why));
            s.sug.forEach(sg => {
              const b = el("button", "er-sug" + (sg.classMatch ? " cls" : ""), "→ " + sg.nick + (sg.classMatch ? " ✓" : "")); b.type = "button";
              b.title = sg.classMatch ? T("eventRoster.sugClassTitle", "Профессия совпадает") : "";
              b.addEventListener("click", () => replaceNick(n, sg.nick));
              row.appendChild(b);
            });
            const keep = el("button", "er-keep", T("eventRoster.keepAsIs", "Оставить как есть")); keep.type = "button";
            keep.addEventListener("click", () => { acknowledged.add(n); renderChips(); });
            row.appendChild(keep);
            sec.appendChild(row);
          });
          box.appendChild(sec);
        }

        // ники по пати
        const groups = new Map();
        pending.forEach(n => { const k = partyKey(n); if(!groups.has(k)) groups.set(k, []); groups.get(k).push(n); });
        [...groups.keys()].sort((a, b) => partyRank(a) - partyRank(b)).forEach(k => {
          const members = groups.get(k), lead = partyLeader(k);
          members.sort((a, b) => (b === lead) - (a === lead));
          const sec = el("div", "er-sec");
          const title = k === "solo" ? T("eventRoster.partySolo", "Соло / без пати")
            : T("eventRoster.partyOf", "Пати — лидер {l}").replace("{l}", lead || "?") + (k[0] === "S" ? " · " + T("eventRoster.partySavedTag", "уже сохранена") : "");
          const h = el("p", "er-h"); h.append(el("span", "", title), el("span", "er-h-n", members.length));
          sec.appendChild(h);
          const row = el("div", "chip-row");
          members.forEach(n => row.appendChild(mkChip(n, sts.get(n), n === lead && k !== "solo")));
          sec.appendChild(row);
          box.appendChild(sec);
        });

        // были в прошлый раз, а сейчас нет
        if(missing.length && pending.length){
          const sec = el("div", "er-sec");
          const h = el("p", "er-h"); h.append(el("span", "", T("eventRoster.secMissing", "Были в прошлый раз ({d}), сейчас нет").replace("{d}", prevInfo.date)), el("span", "er-h-n", missing.length));
          sec.appendChild(h);
          sec.appendChild(el("p", "er-note", T("eventRoster.missingNote", "Нажмите на ник, чтобы добавить его в пати, выбранную в блоке «Добавить игрока вручную».")));
          const row = el("div", "chip-row");
          missing.slice(0, 24).forEach(n => {
            const b = el("button", "er-miss", "+ " + n); b.type = "button";
            b.addEventListener("click", () => { addManual(n, q("manual-party").value); renderChips(); });
            row.appendChild(b);
          });
          if(missing.length > 24) row.appendChild(el("span", "er-note", T("eventRoster.andMore", "и ещё {n}").replace("{n}", missing.length - 24)));
          sec.appendChild(row);
          box.appendChild(sec);
        }
      }
      renderClasses();
      renderFoot(sts);
    }

    function renderFoot(sts){
      const info = q("foot-info"), btn = q("save-btn");
      let chkN = 0; sts.forEach(s => { if(s.k === "chk") chkN++; });
      info.textContent = pending.length
        ? T("eventRoster.footInfo", "К сохранению: {n} ников · повторы не добавятся").replace("{n}", pending.length)
        : T("eventRoster.footEmpty", "Загрузите скрины или добавьте ники вручную");
      btn.textContent = chkN ? T("eventRoster.saveAsIs", "Сохранить как есть ({n} ⚠)").replace("{n}", chkN) : T("eventRoster.saveAttendance", "Сохранить явку");
    }

    // пати этого мероприятия, уже сохранённые в базе (чтобы можно было добавить игрока в существующую пати)
    async function loadSavedParties(){
      try{
        const { data } = await db.from("event_stats").select("nickname, batch_id, is_party_leader, removed").eq("event_id", eventId).not("batch_id", "is", null);
        const by = new Map();
        (data || []).filter(r => !r.removed).forEach(r => {
          const p = by.get(r.batch_id) || { id: r.batch_id, leader: "", first: r.nickname, count: 0 };
          p.count++; if(r.is_party_leader) p.leader = r.nickname; by.set(r.batch_id, p);
        });
        savedParties = [...by.values()].map(p => ({ id: p.id, leader: p.leader || p.first, count: p.count }));
      }catch(e){ console.error(e); savedParties = []; }
      renderChips();
    }

    // прошлая явка этого же мероприятия (то же название, раньше по дате) — для сравнения и подсказки «кого нет»
    let prevLoading = false;
    async function loadPrev(){
      if(prevInfo !== null || prevLoading) return;
      prevLoading = true;
      try{
        const { data: ev } = await db.from("attendance_events").select("event_name, event_date").eq("id", eventId).maybeSingle();
        let res = false;
        if(ev){
          const { data: pe } = await db.from("attendance_events").select("id, event_date").eq("event_name", ev.event_name)
            .lt("event_date", ev.event_date).order("event_date", { ascending: false }).limit(1);
          if(pe && pe.length){
            const { data: ents } = await db.from("attendance_entries").select("nickname").eq("event_id", pe[0].id);
            const nicks = [...new Set((ents || []).map(r => r.nickname))];
            if(nicks.length){ const d = String(pe[0].event_date).split("-"); res = { date: d.length === 3 ? d[2] + "." + d[1] : pe[0].event_date, nicks }; }
          }
        }
        prevInfo = res;
      }catch(e){ console.error(e); prevInfo = false; }
      finally{ prevLoading = false; renderChips(); }
    }

    const classIconOf = (name) => { const c = (window.L2_CLASSES || []).find(x => x.name === name); return c ? c.icon : ""; };
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

    // профессии со скрина: уверенные — компактными метками, сомнительные — вопросом «реально X?» (подтвердить / выбрать другую / пропустить)
    function renderClasses(){
      const box = q("classes");
      if(!box) return;
      box.innerHTML = "";
      const items = pending.filter(n => pendingClass.has(n)).map(n => [n, pendingClass.get(n)]);
      if(!items.length && !classNotes.length) return;
      const title = document.createElement("p");
      title.className = "er-classes-title";
      title.textContent = L2I18n.t("eventRoster.classesTitle", "Профессии по иконкам скрина");
      box.appendChild(title);
      classNotes.forEach(msg => {
        const p = document.createElement("p");
        p.className = "er-classes-note"; p.textContent = msg;
        box.appendChild(p);
      });

      items.filter(([, c]) => c.needsCheck && !c.confirmed && !c.skipped).forEach(([nick, c]) => {
        const card = document.createElement("div");
        card.className = "er-class-q";
        const names = [...new Set([...c.top.map(t => t.name), ...(window.L2_CLASSES || []).map(x => x.name)])];
        card.innerHTML =
          `<img class="er-crop" src="${c.crop}" alt="" title="${esc(L2I18n.t("eventRoster.classCropTitle", "Иконка на скрине"))}" />` +
          `<span class="er-arrow">→</span>` +
          `<img class="er-ref" src="${esc(classIconOf(c.className))}" alt="" />` +
          `<span class="er-q-text"><b>${esc(nick)}</b> — ${esc(L2I18n.t("eventRoster.classQuestion", "реально {c}?").replace("{c}", c.className))}` +
          `<small>${esc(L2I18n.t("eventRoster.classSimilar", "похожие: ") + c.top.slice(1, 3).map(t => t.name).join(", "))}</small></span>` +
          `<span class="er-q-btns"><button class="btn btn-primary" data-act="yes">${esc(L2I18n.t("eventRoster.classYes", "Да"))}</button>` +
          `<select data-act="other"><option value="">${esc(L2I18n.t("eventRoster.classOther", "Другая…"))}</option>${names.map(nm => `<option value="${esc(nm)}">${esc(nm)}</option>`).join("")}</select>` +
          `<button class="btn btn-ghost" data-act="skip">${esc(L2I18n.t("eventRoster.classSkip", "Пропустить"))}</button></span>`;
        card.querySelector('[data-act="yes"]').addEventListener("click", () => { c.confirmed = true; renderClasses(); });
        card.querySelector('[data-act="skip"]').addEventListener("click", () => { c.skipped = true; renderClasses(); });
        card.querySelector('[data-act="other"]').addEventListener("change", (e) => {
          if(!e.target.value) return;
          c.className = e.target.value; c.confirmed = true; renderClasses();
        });
        box.appendChild(card);
      });

      const row = document.createElement("div");
      row.className = "chip-row er-class-chips";
      items.filter(([, c]) => !(c.needsCheck && !c.confirmed && !c.skipped)).forEach(([nick, c]) => {
        const chip = document.createElement("span");
        chip.className = "chip er-class-chip" + (c.skipped ? " er-skipped" : "");
        chip.innerHTML = (c.skipped ? "" : `<img src="${esc(classIconOf(c.className))}" alt="" />`) +
          `<span>${esc(nick)} · ${esc(c.skipped ? L2I18n.t("eventRoster.classSkipped", "не определена") : c.className)}${c.confirmed ? " ✓" : ""}</span>`;
        row.appendChild(chip);
      });
      if(row.children.length) box.appendChild(row);
    }

    function resetUpload(){
      pending = [];
      pendingClass = new Map();
      classNotes = [];
      pendingStats = new Map();
      pendingBatchOf = new Map();
      pendingCollided = new Set();
      batchCount = 0;
      batchLeaderOf = new Map();
      reviewScreens = [];
      pendingFixed = new Map();
      acknowledged = new Set();
      manualMeta = new Map();
      savedParties = null;
      q("file-input").value = "";
      q("status").textContent = "";
      q("error").textContent = "";
      q("manual-hint").textContent = "";
      renderChips();
      updateReviewBtn();
    }

    // кнопка «Проверить распознанное» — только если загрузился js/screenshot-review.js и есть скрины;
    // в подписи — число предупреждений. Любая ошибка здесь не мешает обычной загрузке скринов
    async function updateReviewBtn(){
      const btn = q("review-btn");
      if(!btn) return;
      if(!window.L2Review || !reviewScreens.length){ btn.style.display = "none"; return; }
      btn.style.display = "";
      let w = 0;
      try{
        const known = await loadKnownNicks(db);
        const ctx = await loadNickCtx(db);
        w = L2Review.summarize(L2Review.analyze(reviewScreens, known, pendingCollided, makeNickInfo(ctx))).warn;
      }catch(e){ console.error(e); }
      btn.textContent = w
        ? L2I18n.t("review.btnWarn", "🔍 Проверить распознанное ({w} ⚠)").replace("{w}", w)
        : L2I18n.t("review.btn", "🔍 Проверить распознанное");
    }

    // результат окна проверки → обратно в pending/pendingStats/…: пересобираем из строк скринов,
    // ники, добавленные вручную (не со скринов), остаются как были
    // исправления ников из окна проверки → привязки (nick_aliases): в следующий раз такое написание подставится само
    async function saveAliases(pairs){
      if(!pairs || !pairs.length) return;
      try{
        const rows = pairs.map(p => ({ clan_id: profile.clan_id, alias: p.alias, canonical: p.canonical, created_by: profile.id }));
        const { error } = await db.from("nick_aliases").upsert(rows, { onConflict: "clan_id,alias" });
        if(error){ console.error(error); return; }
        if(window.L2Nick){ L2Nick.invalidate(profile.clan_id); try{ await L2Nick.refresh(db, profile.clan_id); }catch(e){ console.error(e); } }
      }catch(e){ console.error(e); }
    }

    function applyReview(edited){
      try{
        const manual = pending.filter(n => manualMeta.has(n) || !pendingBatchOf.has(n));
        const newClass = new Map();
        const keptCollided = new Set();
        pending = []; pendingStats = new Map(); pendingBatchOf = new Map();
        edited.forEach(sc => {
          let leaderNick = "";
          sc.rows.forEach(r => {
            if(!r.nick) return;
            if(!pending.includes(r.nick)) pending.push(r.nick);
            pendingStats.set(r.nick, { kills: r.kills, deaths: r.deaths, pvp_damage: r.pvp, pve_damage: r.pve });
            pendingBatchOf.set(r.nick, sc.idx);
            if(r.cls) newClass.set(r.nick, r.cls);
            if(r.leader && !leaderNick) leaderNick = r.nick;
            if(r.nick === r.orig && pendingCollided.has(r.nick)) keptCollided.add(r.nick);
          });
          const first = sc.rows.find(r => r.nick);
          if(first) batchLeaderOf.set(sc.idx, leaderNick || first.nick); else batchLeaderOf.delete(sc.idx);
        });
        manual.forEach(n => {
          if(pending.includes(n)) return;
          pending.push(n);
          const m = manualMeta.get(n); // вручную добавленный в пати — привязка и пустая статистика сохраняются
          if(m && m.batch != null){ pendingBatchOf.set(n, m.batch); pendingStats.set(n, zeroStats()); }
        });
        [...pendingFixed.keys()].forEach(k => { if(!pending.includes(k)) pendingFixed.delete(k); });
        pendingClass = newClass;
        pendingCollided = keptCollided;
        reviewScreens = edited.map(sc => ({ idx: sc.idx, image: sc.image, rows: sc.rows.map(r => Object.assign({}, r, { orig: r.nick })) }));
        renderChips();
        updateReviewBtn();
      }catch(err){
        console.error(err);
        q("error").textContent = L2I18n.t("review.applyFailed", "Не удалось применить правки: ") + err.message;
      }
    }

    q("add-btn").addEventListener("click", () => {
      const up = q("upload");
      up.style.display = up.style.display === "none" ? "" : "none";
      if(up.style.display !== "none"){ loadSavedParties(); loadPrev(); renderChips(); }
    });

    q("file-btn").addEventListener("click", () => q("file-input").click());

    function fileToDataUrl(file){
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // Апскейлим скрин в 2x (с потолком по стороне, чтобы запрос не разросся
    // безгранично) перед распознаванием — мелкому тексту (ники, цифры)
    // достаётся больше пикселей, читается надёжнее.
    function upscaleForOcr(dataUrl, scale = 2, maxSide = 2600){
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width * scale, h = img.height * scale;
          if(Math.max(w, h) > maxSide){
            const shrink = maxSide / Math.max(w, h);
            w *= shrink; h *= shrink;
          }
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(w); canvas.height = Math.round(h);
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    }

    q("file-input").addEventListener("change", async () => {
      let files = Array.from(q("file-input").files);
      const statusEl = q("status");
      const errEl = q("error");
      errEl.textContent = "";
      if(!files.length) return;
      if(files.length > 9){
        files = files.slice(0, 9);
        statusEl.textContent = L2I18n.t("eventRoster.onlyFirst9Files", "Взяты только первые 9 файлов.");
      }
      for(let i = 0; i < files.length; i++){
        statusEl.textContent = L2I18n.t("eventRoster.recognizingScreen", "Распознаю скрин {i} из {n}…").replace("{i}", i + 1).replace("{n}", files.length);
        try{
          const rawDataUrl = await fileToDataUrl(files[i]);
          const dataUrl = await upscaleForOcr(rawDataUrl);
          const { stats: ocrRows, leader: ocrLeader } = await L2Cabinet.adminOcrEventStats(dataUrl);
          const rows = ocrRows.filter(r => r.nickname);

          // сверяем каждый распознанный ник со списком реальных ников клана —
          // точное/нормализованное совпадение чинит регистр и похожие буквы,
          // нечёткое (Левенштейн) — редкие случаи потерянной/перепутанной буквы
          // целиком («Лунтик» → «Луник»); при неуверенности ник не трогаем —
          // админ всё равно видит все чипы перед сохранением и может поправить
          const knownNicks = await loadKnownNicks(db);
          const rawNames = rows.map(r => r.nickname);
          resolveNicknames(rows, knownNicks).forEach(n => pendingCollided.add(n));
          rows.forEach((r, ri) => { if(r.nickname !== rawNames[ri]) pendingFixed.set(r.nickname, rawNames[ri]); }); // исправлено автоматически

          // индекс скрина заводим лениво, только если он реально дал хоть одного ника —
          // «Отчёт по мероприятиям» использует эти индексы, чтобы группировать строки
          // по скрину (пати) и подписывать блок именем группы клана или «Соло»
          const bIdx = rows.length ? batchCount++ : null;

          // профессии по иконкам этого же скрина (в оригинальном размере, не апскейленном); число иконок
          // должно совпасть с числом распознанных ников — иначе профессии не определяем вовсе
          if(rows.length && window.L2ClassIcons){
            try{
              const cr = await L2ClassIcons.analyze(rawDataUrl, rows.length);
              if(cr.ok){
                rows.forEach((r, ri) => pendingClass.set(r.nickname, Object.assign({ confirmed: false, skipped: false }, cr.rows[ri])));
              } else if(cr.reason === "count_mismatch"){
                classNotes.push(L2I18n.t("eventRoster.classMismatch", "Скрин {i}: иконок {a}, ников {b} — профессии не определены (выберите вручную в «Отчётах»).")
                  .replace("{i}", i + 1).replace("{a}", cr.found).replace("{b}", cr.expected));
              } else {
                classNotes.push(L2I18n.t("eventRoster.classNoTable", "Скрин {i}: таблица с иконками не найдена — профессии не определены.").replace("{i}", i + 1));
              }
            }catch(clsErr){ console.error(clsErr); }
          }

          rows.forEach(r => {
            if(!pending.includes(r.nickname)) pending.push(r.nickname);
            pendingStats.set(r.nickname, {
              kills: r.kills, deaths: r.deaths,
              pvp_damage: r.pvp_damage, pve_damage: r.pve_damage,
            });
            pendingBatchOf.set(r.nickname, bIdx);
          });
          if(bIdx != null && !batchLeaderOf.has(bIdx)){
            const leaderMatch = ocrLeader && (
              rows.find(r => r.nickname === ocrLeader) ||
              rows.find(r => r.nickname.trim().toLowerCase() === ocrLeader.trim().toLowerCase())
            );
            batchLeaderOf.set(bIdx, (leaderMatch || rows[0]).nickname);
          }
          // копия строк скрина для окна проверки
          try{
            if(bIdx != null){
              const leaderNick = batchLeaderOf.get(bIdx);
              let leaderMarked = false;
              reviewScreens.push({
                idx: bIdx, image: rawDataUrl,
                rows: rows.map(r => {
                  const isLeader = !leaderMarked && r.nickname === leaderNick;
                  if(isLeader) leaderMarked = true;
                  return { nick: r.nickname, orig: r.nickname, kills: r.kills, deaths: r.deaths, pvp: r.pvp_damage, pve: r.pve_damage,
                    cls: pendingClass.get(r.nickname) || null, leader: isLeader };
                }),
              });
            }
          }catch(revErr){ console.error(revErr); }
          renderChips();
        }catch(err){
          errEl.textContent = L2I18n.t("eventRoster.screenError", "Скрин {i}: {msg}").replace("{i}", i + 1).replace("{msg}", err.message);
        }
      }
      statusEl.textContent = L2I18n.t("eventRoster.doneRecognized", "Готово, распознано {n} ник(ов) со статистикой — проверьте перед сохранением.").replace("{n}", pending.length);
      updateReviewBtn();
    });

    q("review-btn").addEventListener("click", async () => {
      if(!window.L2Review || !reviewScreens.length) return;
      try{
        let known = [], nickInfo = null;
        try{ known = await loadKnownNicks(db); nickInfo = makeNickInfo(await loadNickCtx(db)); }catch(e){ console.error(e); }
        L2Review.open({ screens: reviewScreens, known, collided: pendingCollided, classIcon: classIconOf, onApply: applyReview, nickInfo, onAliases: saveAliases });
      }catch(err){
        console.error(err);
        q("error").textContent = L2I18n.t("review.openFailed", "Не удалось открыть проверку: ") + err.message;
      }
    });

    q("manual-btn").addEventListener("click", () => {
      const input = q("manual-input");
      if(addManual(input.value, q("manual-party").value)) input.value = "";
      renderChips();
    });
    q("manual-input").addEventListener("keydown", (e) => {
      if(e.key === "Enter"){ e.preventDefault(); q("manual-btn").click(); }
    });

    q("cancel-btn").addEventListener("click", () => {
      resetUpload();
      q("upload").style.display = "none";
    });

    // кнопка на время сохранения выключена: при втором нажатии список записывался заново и все ники задваивались
    let saving = false;
    q("save-btn").addEventListener("click", async () => {
      if(saving) return;
      saving = true;
      const btn = q("save-btn"); btn.disabled = true;
      try { await saveAll(); }
      finally { saving = false; btn.disabled = false; }
    });
    async function saveAll(){
      const errEl = q("error");
      errEl.textContent = "";
      // свежая сверка с базой (а не со списком на экране, который мог устареть) и без повторов внутри самой загрузки
      const { data: curRows, error: curErr } = await db.from("attendance_entries").select("nickname").eq("event_id", eventId);
      if(curErr){ errEl.textContent = L2I18n.t("eventRoster.saveFailed", "Не удалось сохранить: ") + curErr.message; return; }
      const existing = new Set((curRows || []).map(e => keyOf(e.nickname)));
      const toInsert = [];
      pending.forEach(n => { const k = keyOf(n); if(!existing.has(k)){ existing.add(k); toInsert.push(n); } });
      if(toInsert.length){
        const rows = toInsert.map(nickname => ({
          clan_id: profile.clan_id,
          event_id: eventId,
          nickname,
          created_by: profile.id,
        }));
        // если в базе уже есть запрет на дубли (supabase/schema_attendance_dedupe.sql) — повтор просто пропускается;
        // пока файла нет, обычная вставка (дубли отсекает проверка выше)
        let { error } = await db.from("attendance_entries").upsert(rows, { onConflict: "event_id,nickname", ignoreDuplicates: true });
        if(error && /no unique|ON CONFLICT|constraint matching/i.test(error.message)) ({ error } = await db.from("attendance_entries").insert(rows));
        if(error){ errEl.textContent = L2I18n.t("eventRoster.saveFailed", "Не удалось сохранить: ") + error.message; return; }
      }

      // те же ники, для которых скрин дал цифры — сразу в event_stats, без
      // отдельного шага в «Отчётах»; повторная загрузка скрина с поправленными
      // цифрами просто перезапишет старые значения (upsert по event_id+nickname)
      if(pendingStats.size){
        // по одной записи-«скрину» на каждый batchCount — последовательно, не массовым
        // insert, чтобы не полагаться на порядок строк ответа: скринов максимум 9,
        // действие админское и нечастое, разница в цене не имеет значения
        const batchIds = [];
        for(let bi = 0; bi < batchCount; bi++){
          const { data: batchRow, error: batchErr } = await db
            .from("event_screenshot_batches")
            .insert({ clan_id: profile.clan_id, event_id: eventId, created_by: profile.id })
            .select("id").single();
          if(batchErr){ errEl.textContent = L2I18n.t("eventRoster.batchSaveFailed", "Не удалось сохранить метку скрина: ") + batchErr.message; return; }
          batchIds.push(batchRow.id);
        }

        const statRows = pending
          .filter(n => pendingStats.has(n))
          .map(n => {
            const s = pendingStats.get(n);
            const bIdx = pendingBatchOf.get(n);
            return {
              clan_id: profile.clan_id,
              event_id: eventId,
              nickname: n,
              kills: s.kills,
              deaths: s.deaths,
              pvp_damage: s.pvp_damage,
              pve_damage: s.pve_damage,
              // число — скрин этой загрузки; "S:<id>" — вручную добавленный в уже сохранённую пати
              batch_id: bIdx == null ? null : (typeof bIdx === "string" ? bIdx.slice(2) : batchIds[bIdx]),
              is_party_leader: typeof bIdx === "number" && batchLeaderOf.get(bIdx) === n,
              removed: false, // если ник раньше был помечен «удалён» — новое распознавание снимает пометку
              created_by: profile.id,
              updated_at: new Date().toISOString(),
            };
          });

        // вручную добавленному в пати ставим нулевую статистику — но только если у него в этом мероприятии её ещё нет:
        // иначе при повторном добавлении затёрлись бы настоящие килы/смерти, а у такого ника меняется только пати
        const manualSet = new Set(pending.filter(n => (pendingStats.get(n) || {}).manual));
        let haveStat = new Set();
        if(manualSet.size){
          const { data: ex } = await db.from("event_stats").select("nickname").eq("event_id", eventId);
          haveStat = new Set((ex || []).map(r => r.nickname));
        }
        const relink = statRows.filter(r => manualSet.has(r.nickname) && haveStat.has(r.nickname));
        const toUpsert = statRows.filter(r => !(manualSet.has(r.nickname) && haveStat.has(r.nickname)));
        if(toUpsert.length){
          const { error: statsErr } = await db.from("event_stats").upsert(toUpsert, { onConflict: "event_id,nickname" });
          if(statsErr){ errEl.textContent = L2I18n.t("eventRoster.statsSaveFailed", "Явка сохранена, но статистика — нет: ") + statsErr.message; return; }
        }
        for(const r of relink){
          const { error: relErr } = await db.from("event_stats").update({ batch_id: r.batch_id, is_party_leader: r.is_party_leader, removed: false, updated_at: r.updated_at })
            .eq("event_id", eventId).eq("nickname", r.nickname);
          if(relErr){ errEl.textContent = L2I18n.t("eventRoster.statsSaveFailed", "Явка сохранена, но статистика — нет: ") + relErr.message; return; }
        }
      }

      // профессии по иконкам → правки «на это мероприятие» (ручные правки из «Отчётов» не трогаем)
      const clsErr = await saveClassOverrides();
      if(clsErr){ errEl.textContent = L2I18n.t("eventRoster.classSaveFailed", "Явка сохранена, но профессии — нет: ") + clsErr; await load(); return; }

      resetUpload();
      q("upload").style.display = "none";
      await load();
      // появились новые ники — значок «!» у «Админ-панели» пересчитает проверку
      try { if(window.L2Nick) L2Nick.invalidate(profile.clan_id); window.top.L2Nav && window.top.L2Nav.refreshNickBadge && setTimeout(() => window.top.L2Nav.refreshNickBadge(true), 1500); } catch(e){}
    }

    // нормализованный ник — тот же ключ, что в «Отчётах» (report_class_overrides.nickname_norm)
    const classKey = (n) => (window.L2Nick ? (L2Nick.ready() ? L2Nick.key(n) : L2Nick.norm(n)) : String(n).toLowerCase());
    async function saveClassOverrides(){
      const items = pending.filter(n => pendingClass.has(n)).map(n => [n, pendingClass.get(n)])
        .filter(([, c]) => !c.skipped && (!c.needsCheck || c.confirmed));
      if(!items.length) return "";
      const period = "event:" + eventId;
      // что уже стоит на этом мероприятии: ручные правки (source != auto) главнее распознанных
      let hasSource = true;
      let res = await db.from("report_class_overrides").select("nickname_norm, source").eq("clan_id", profile.clan_id).eq("period_key", period);
      if(res.error){
        hasSource = false; // колонки source ещё нет (supabase/schema_report_class_source.sql) — любые существующие считаем ручными
        res = await db.from("report_class_overrides").select("nickname_norm").eq("clan_id", profile.clan_id).eq("period_key", period);
      }
      const existing = new Map((res.data || []).map(r => [r.nickname_norm, hasSource ? r.source : "manual"]));
      const byKey = new Map();
      const accepted = []; // кого реально записали — им же запоминаем профессию в «Участниках клана»
      items.forEach(([n, cls]) => {
        const k = classKey(n);
        const e = existing.get(k);
        if(e && e !== "auto") return;
        accepted.push([n, cls]);
        const row = { clan_id: profile.clan_id, nickname_norm: k, period_key: period, class_name: cls.className, updated_at: new Date().toISOString() };
        if(hasSource) row.source = "auto";
        byKey.set(k, row);
      });
      if(!byKey.size) return "";
      const { error } = await db.from("report_class_overrides").upsert([...byKey.values()], { onConflict: "clan_id,nickname_norm,period_key" });
      if(error) return error.message;
      return await rememberMemberClasses(accepted);
    }

    // человеку, у которого в «Участниках клана» (member_classes) профессий ещё нет вообще,
    // распознанная записывается как основная — чтобы не добавлять вручную «+ профессию».
    // У кого профессии уже есть — не трогаем (там может быть вторая профессия/ручной выбор)
    async function rememberMemberClasses(accepted){
      if(!accepted.length) return "";
      const { data, error } = await db.from("member_classes")
        .select("nickname, class_name, class_name_2, class_name_3, class_name_4").eq("clan_id", profile.clan_id);
      if(error) return error.message;
      const rowsData = data || [];
      const hasClass = new Set(rowsData.filter(r => r.class_name || r.class_name_2 || r.class_name_3 || r.class_name_4).map(r => classKey(r.nickname)));
      const emptyRowNick = new Map(rowsData.filter(r => !(r.class_name || r.class_name_2 || r.class_name_3 || r.class_name_4)).map(r => [classKey(r.nickname), r.nickname]));
      const rows = new Map();
      accepted.forEach(([n, cls]) => {
        const k = classKey(n);
        if(hasClass.has(k) || rows.has(k)) return;
        rows.set(k, { clan_id: profile.clan_id, nickname: emptyRowNick.get(k) || n, class_name: cls.className });
      });
      if(!rows.size) return "";
      const { error: upErr } = await db.from("member_classes").upsert([...rows.values()], { onConflict: "clan_id,nickname" });
      return upErr ? upErr.message : "";
    }
  }

  load();
}

window.initEventRoster = initEventRoster;
