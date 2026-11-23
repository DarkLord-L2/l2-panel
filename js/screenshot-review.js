// Окно «Проверка распознанного» для загрузки скринов посещаемости (js/event-roster.js).
// Слева — сам скрин, справа — таблица того, что распознала нейросеть (ник, килы, смерти,
// PvP, PvE), с подсветкой подозрительного: ник из похожих символов, один ник на двух
// строках/скринах, нет в переписи, странные цифры (колонки могли сдвинуться), и т.д.
// Любую ячейку можно поправить, строку убрать или добавить, отметить лидера пати.
//
// Модуль ничего не пишет в базу и не знает про Supabase: работает на копии строк, а
// результат отдаёт колбэком onApply только по кнопке «Применить». «Отмена» — всё как было.
// Если модуль не загрузился, event-roster.js просто не показывает кнопку «Проверить».
//
// L2Review.analyze(screens, known, collided) — чистая функция (для тестов): считает
// предупреждения. L2Review.open({...}) — рисует окно.
(function(){
  const t = (k, d) => (window.L2I18n ? L2I18n.t(k, d) : d);
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const AMBIGUOUS = /^[0Oo1lIi|!]{3,}$/; // ник целиком из неотличимых на скрине символов
  const trimNick = (s) => String(s == null ? "" : s).trim();

  function isBadNumber(v){
    if(v === null || v === undefined || v === "") return true;
    const n = Number(v);
    return !Number.isFinite(n) || n < 0 || !Number.isInteger(n);
  }

  // screens: [{ idx, rows: [{ nick, orig, kills, deaths, pvp, pve }] }]
  // known: массив ников из переписи (может быть пустым); collided: Set ников, не сопоставленных из-за конфликта
  // Возвращает Map(idx скрина -> { rows: [[{level, code, text}]], notes: [{level, text}] })
  function analyze(screens, known, collided, nickInfo){
    const knownSet = new Set(known || []);
    const posOf = new Map(screens.map((sc, i) => [sc.idx, i + 1])); // человеческий номер скрина
    const nickScreens = new Map(); // ник -> номера скринов (по порядку)
    screens.forEach(sc => sc.rows.forEach(r => {
      const n = trimNick(r.nick);
      if(!n) return;
      if(!nickScreens.has(n)) nickScreens.set(n, []);
      nickScreens.get(n).push(sc.idx);
    }));

    const out = new Map();
    screens.forEach(sc => {
      const counts = new Map();
      sc.rows.forEach(r => { const n = trimNick(r.nick); if(n) counts.set(n, (counts.get(n) || 0) + 1); });
      let pveDominant = 0, sumKills = 0, sumPvp = 0;

      const rowFlags = sc.rows.map(r => {
        const f = [];
        const n = trimNick(r.nick);
        if(!n){
          f.push({ level: "warn", code: "empty", text: t("review.flagEmpty", "Пустой ник — строка будет пропущена") });
        } else {
          if(AMBIGUOUS.test(n)) f.push({ level: "warn", code: "ambiguous", text: t("review.flagAmbiguous", "Ник из похожих символов (0 O 1 l I i) — программа не отличит их по картинке, сверьте со скрином") });
          if(collided && collided.has(n) && n === r.orig) f.push({ level: "warn", code: "collided", text: t("review.flagCollided", "Похож на ник из переписи, но тот уже занят другой строкой скрина — оставлен как распознан") });
          if(counts.get(n) > 1) f.push({ level: "warn", code: "dupScreen", text: t("review.flagDupScreen", "Этот ник есть в двух строках скрина — при сохранении останется одна") });
          const others = (nickScreens.get(n) || []).filter(i => i !== sc.idx).map(i => posOf.get(i));
          if(others.length) f.push({ level: "warn", code: "dupOther", text: t("review.flagDupOther", "Этот ник есть и на скрине {n} — при сохранении останется одна запись").replace("{n}", [...new Set(others)].join(", ")) });
          if(knownSet.size && !knownSet.has(n)){
            // nickInfo (из event-roster.js): есть ли похожий ник в переписи — тогда это скорее ошибка распознавания, а не новичок
            const inf = nickInfo ? nickInfo(n, r.cls && r.cls.className) : null;
            const best = inf && inf.sug && inf.sug[0];
            if(best) f.push({ level: "warn", code: "unknown", text: t("review.flagUnknownSug", "Нет в переписи, но очень похож на «{nick}»{cls} — это он? Нажмите на предложение под ником, чтобы заменить.").replace("{nick}", best.nick).replace("{cls}", best.classMatch ? t("review.sameClass", " (та же профессия)") : "") });
            else f.push({ level: "info", code: "unknown", text: t("review.flagUnknown", "Нет в переписи — новый участник или ник распознан с ошибкой") });
          }
        }
        const nums = [r.kills, r.deaths, r.pvp, r.pve];
        if(nums.some(isBadNumber)){
          f.push({ level: "warn", code: "badNumber", text: t("review.flagBadNumber", "Число не распознано или не целое — исправьте") });
        } else {
          sumKills += Number(r.kills); sumPvp += Number(r.pvp);
          if(Number(r.pve) > 10000 && Number(r.pve) > 20 * Number(r.pvp)){
            pveDominant++;
            f.push({ level: "warn", code: "pveDominant", text: t("review.flagPve", "PvE урон в 20+ раз больше PvP — колонки могли сдвинуться, сверьте со скрином") });
          }
        }
        return f;
      });

      const notes = [];
      const n = sc.rows.length;
      if(n > 9) notes.push({ level: "warn", text: t("review.noteTooMany", "Строк {n} — в пати обычно не больше 9, возможно, лишние или склеенные строки").replace("{n}", n) });
      if(n >= 3 && (pveDominant >= Math.ceil(n / 2) || (sumKills === 0 && sumPvp > 1000))){
        notes.push({ level: "warn", text: t("review.noteShifted", "Похоже, колонки этого скрина прочитаны со сдвигом (килы/смерти/урон не в тех столбцах) — сверьте цифры со скрином") });
      }
      out.set(sc.idx, { rows: rowFlags, notes });
    });
    return out;
  }

  function summarize(analysis){
    let warn = 0, info = 0;
    analysis.forEach(a => {
      a.rows.forEach(f => f.forEach(x => { if(x.level === "warn") warn++; else info++; }));
      a.notes.forEach(x => { if(x.level === "warn") warn++; else info++; });
    });
    return { warn, info };
  }

  let styleInjected = false;
  function injectStyle(){
    if(styleInjected) return;
    styleInjected = true;
    const st = document.createElement("style");
    st.textContent = `
      .rv-modal{ width:min(1240px,100%); max-width:1240px; max-height:92vh; padding:14px 16px 16px; display:flex; flex-direction:column; }
      .rv-modal h2{ font-size:16px; margin:0 0 10px; }
      .rv-modal{ background: linear-gradient(180deg, var(--accent-soft, transparent), transparent 110px), var(--panel); }
      .rv-tabs{ display:flex; flex-wrap:wrap; gap:6px; margin:0 0 12px; }
      .rv-tab{ font:inherit; font-size:12.5px; font-weight:600; padding:6px 14px; border-radius:20px; cursor:pointer; border:1px solid var(--border-lit); background:var(--panel-2); color:var(--text-dim); transition: all .15s; }
      .rv-tab:hover{ color:var(--text); }
      .rv-tab.active{ border-color:var(--accent-line, var(--gold-dim)); color:var(--gold); background:var(--accent-soft, var(--panel)); }
      .rv-tab .rv-badge{ margin-left:6px; color:#111; background:#e8b44a; font-weight:700; font-size:10.5px; padding:0 6px; border-radius:10px; }
      .rv-body{ display:grid; grid-template-columns: minmax(260px, 40%) 1fr; gap:14px; min-height:0; flex:1; overflow:hidden; }
      .rv-shot{ overflow:auto; border:1px solid var(--border-lit); border-radius:10px; background:#0b0c0e; box-shadow: inset 0 0 0 1px rgba(255,255,255,.02); }
      .rv-shot img{ display:block; width:100%; max-width:none; cursor:zoom-in; margin:0 !important; border:0 !important; border-radius:0 !important; }
      .rv-shot.zoom img{ width:auto; cursor:zoom-out; }
      .rv-right{ overflow:auto; min-width:0; }
      .rv-notes p{ margin:0 0 6px; padding:7px 11px; border-radius:8px; font-size:12.5px; background:rgba(232,180,74,.10); border:1px solid rgba(232,180,74,.35); box-shadow: inset 3px 0 0 #e8b44a; color:var(--text); }
      table.rv-table{ width:100%; border-collapse:separate; border-spacing:0; font-size:13px; font-variant-numeric: tabular-nums; }
      table.rv-table th{ color:var(--text-dim); font-weight:600; font-size:11.5px; text-align:center; padding:5px 4px; position:sticky; top:0; background:var(--panel); z-index:1; border-bottom:1px solid var(--border-lit); }
      table.rv-table td{ padding:3px 3px; border-bottom:1px solid var(--border); text-align:center; vertical-align:middle; }
      table.rv-table tbody tr:hover td{ background:rgba(255,255,255,.025); }
      table.rv-table td.rv-n{ color:var(--text-dim); font-size:11px; width:22px; }
      table.rv-table tr.rv-has-warn td{ background:rgba(232,180,74,.07); }
      table.rv-table tr.rv-has-warn td:first-child{ box-shadow: inset 3px 0 0 #e8b44a; }
      table.rv-table input{ font:inherit; font-size:13px; padding:4px 6px; background:#111215; color:var(--text); border:1px solid var(--border-lit); border-radius:6px; min-width:0; transition: border-color .15s, box-shadow .15s; }
      table.rv-table input.rv-nick{ width:100%; min-width:110px; text-align:left; font-weight:500; }
      table.rv-table input.rv-num{ width:72px; text-align:right; }
      table.rv-table input:focus{ outline:none; border-color:var(--accent-line, var(--gold-dim)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus, #5b8def) 20%, transparent); }
      table.rv-table input.rv-bad{ border-color:#e57d7d; }
      .rv-ico{ width:22px; height:22px; min-width:22px; max-width:none !important; border-radius:5px; object-fit:cover; border:1px solid var(--border-lit); vertical-align:middle; margin:0 !important; display:inline-block !important; }
      .rv-ico.rv-q{ outline:2px solid #e8b44a; }
      .rv-star{ background:none; border:none; cursor:pointer; font-size:15px; color:var(--text-dim); padding:0 3px; }
      .rv-star.on{ color:#e8b44a; }
      .rv-del{ background:none; border:none; cursor:pointer; color:var(--danger-lit); font-size:15px; padding:0 4px; }
      .rv-sug{ display:flex; flex-wrap:wrap; align-items:center; gap:4px; margin-top:3px; text-align:left; min-height:0; }
      .rv-sug:empty{ display:none; }
      .rv-sug-btn{ font:inherit; font-size:11.5px; font-weight:600; padding:2px 8px; border-radius:10px; cursor:pointer; color:#111; background:#e8b44a; border:1px solid #e8b44a; }
      .rv-sug-btn:hover{ filter:brightness(1.1); }
      .rv-sug-btn.cls{ background:#6fcf8a; border-color:#6fcf8a; }
      .rv-sug-note{ font-size:11px; color:var(--text-dim); }
      .rv-sug-note.ok{ color:#6fcf8a; opacity:.85; }
      .rv-sug-note.new{ color:#6aaeea; }
      .rv-flags{ white-space:nowrap; text-align:left; min-width:46px; }
      .rv-flag{ cursor:help; margin-right:3px; }
      .rv-flag.warn{ color:#e8b44a; }
      .rv-flag.info{ color:#6aaeea; }
      .rv-foot{ display:flex; align-items:center; gap:10px; margin-top:12px; padding-top:12px; border-top:1px solid var(--border); flex-wrap:wrap; }
      .rv-foot .rv-sum{ color:var(--text-dim); font-size:12.5px; margin-right:auto; }
      @media (max-width: 820px){ .rv-body{ grid-template-columns: 1fr; overflow:auto; } .rv-shot{ max-height:240px; } }
    `;
    document.head.appendChild(st);
  }

  // opts: { screens, known, collided, classIcon(name), onApply(editedScreens), onCancel() }
  // screens: [{ idx, image, rows: [{ nick, orig, kills, deaths, pvp, pve, cls, leader }] }]
  function open(opts){
    injectStyle();
    // работаем на копии — «Отмена» ничего не меняет в исходных данных
    const work = opts.screens.map(sc => ({
      idx: sc.idx, image: sc.image,
      rows: sc.rows.map(r => ({ nick: r.nick, orig: r.orig, kills: r.kills, deaths: r.deaths, pvp: r.pvp, pve: r.pve, cls: r.cls || null, leader: !!r.leader })),
    }));
    let cur = 0;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay show";
    overlay.innerHTML =
      `<div class="modal rv-modal">` +
        `<h2>${esc(t("review.title", "Проверка распознанного"))}</h2>` +
        `<div class="rv-tabs"></div>` +
        `<div class="rv-body"><div class="rv-shot" title="${esc(t("review.zoomHint", "Клик по скрину — увеличить"))}"><img alt="" /></div>` +
        `<div class="rv-right"><div class="rv-notes"></div>` +
        `<table class="rv-table"><thead><tr><th>#</th><th></th><th>${esc(t("review.colNick", "Ник"))}</th><th title="${esc(t("review.leaderTitle", "Лидер пати"))}">★</th>` +
        `<th>${esc(t("review.colKills", "Килы"))}</th><th>${esc(t("review.colDeaths", "Смерти"))}</th><th>PvP</th><th>PvE</th><th></th><th></th></tr></thead><tbody></tbody></table>` +
        `<button type="button" class="btn rv-add" style="margin-top:8px;">${esc(t("review.addRow", "+ Добавить строку"))}</button></div></div>` +
        `<div class="rv-foot"><span class="rv-sum"></span>` +
        `<button type="button" class="btn btn-primary rv-apply">${esc(t("review.apply", "Применить"))}</button>` +
        `<button type="button" class="btn btn-ghost rv-cancel">${esc(t("review.cancel", "Отмена"))}</button></div>` +
      `</div>`;
    document.body.appendChild(overlay);

    const $ = (sel) => overlay.querySelector(sel);
    const tabsEl = $(".rv-tabs"), tbody = $("tbody"), notesEl = $(".rv-notes"), sumEl = $(".rv-sum"), shotEl = $(".rv-shot"), imgEl = $(".rv-shot img");
    let analysis = new Map();
    const recompute = () => { analysis = analyze(work, opts.known, opts.collided, opts.nickInfo); };

    function setFlagsCells(){
      const a = analysis.get(work[cur].idx);
      [...tbody.querySelectorAll("tr")].forEach((tr, i) => {
        const flags = (a && a.rows[i]) || [];
        tr.classList.toggle("rv-has-warn", flags.some(x => x.level === "warn"));
        tr.querySelector(".rv-flags").innerHTML = flags.map(x =>
          `<span class="rv-flag ${x.level}" title="${esc(x.text)}">${x.level === "warn" ? "⚠" : "ℹ"}</span>`).join("");
        // проверка ника по переписи: «✓ в переписи» / «нет в переписи — это он?» с кнопками-предложениями
        const row = work[cur].rows[i], nk = row ? trimNick(row.nick) : "";
        const inf = (opts.nickInfo && nk) ? opts.nickInfo(nk, row.cls && row.cls.className) : null;
        let html = "";
        if(inf){
          if(inf.status === "latest") html = `<span class="rv-sug-note ok">✓ ${esc(t("review.inCensus", "в переписи"))}</span>`;
          else if(inf.status === "old" && inf.sug && inf.sug.length) html = `<span class="rv-sug-note">${esc(t("review.oldButNear", "Есть только в старых переписях; в свежей — похожий:"))}</span>` +
            inf.sug.map(sg => `<button type="button" class="rv-sug-btn${sg.classMatch ? " cls" : ""}" data-nick="${esc(sg.nick)}">→ ${esc(sg.nick)}${sg.classMatch ? " ✓" : ""}</button>`).join("");
          else if(inf.status === "old") html = `<span class="rv-sug-note ok">✓ ${esc(t("review.inOldCensus", "есть в старых переписях"))}</span>`;
          else if(inf.sug && inf.sug.length) html = `<span class="rv-sug-note">${esc(t("review.itsHim", "Нет в переписи. Это он?"))}</span>` +
            inf.sug.map(sg => `<button type="button" class="rv-sug-btn${sg.classMatch ? " cls" : ""}" data-nick="${esc(sg.nick)}" title="${esc(sg.classMatch ? t("review.sameClassTitle", "Совпадает и профессия") : "")}">→ ${esc(sg.nick)}${sg.classMatch ? " ✓" : ""}</button>`).join("");
          else html = `<span class="rv-sug-note new">${esc(t("review.newPlayer", "Нет в переписи, похожих нет — новый игрок?"))}</span>`;
        }
        tr.querySelector(".rv-sug").innerHTML = html;
      });
      notesEl.innerHTML = ((a && a.notes) || []).map(x => `<p>⚠ ${esc(x.text)}</p>`).join("");
      // бейджи на вкладках и общая сводка
      [...tabsEl.children].forEach((tab, i) => {
        const aa = analysis.get(work[i].idx);
        const w = aa ? aa.rows.reduce((s, f) => s + f.filter(x => x.level === "warn").length, 0) + aa.notes.filter(x => x.level === "warn").length : 0;
        tab.querySelector(".rv-badge").textContent = w ? "⚠" + w : "";
      });
      const sm = summarize(analysis);
      const rowsTotal = work.reduce((s, sc) => s + sc.rows.length, 0);
      sumEl.textContent = t("review.summary", "Строк: {n} · предупреждений: {w}").replace("{n}", rowsTotal).replace("{w}", sm.warn);
    }

    function renderTable(){
      const sc = work[cur];
      tbody.innerHTML = "";
      sc.rows.forEach((r, i) => {
        const tr = document.createElement("tr");
        const cls = r.cls;
        const iconSrc = cls && !cls.skipped && opts.classIcon ? opts.classIcon(cls.className) : "";
        const uncertain = !!(cls && cls.needsCheck && !cls.confirmed && !cls.skipped);
        tr.innerHTML =
          `<td class="rv-n">${i + 1}</td>` +
          `<td>${iconSrc ? `<img class="rv-ico${uncertain ? " rv-q" : ""}" src="${esc(iconSrc)}" alt="" title="${esc(cls.className)}${uncertain ? " (?)" : ""}" />` : ""}</td>` +
          `<td class="rv-nickcell"><input class="rv-nick" data-f="nick" value="${esc(r.nick)}" spellcheck="false" /><div class="rv-sug"></div></td>` +
          `<td><button type="button" class="rv-star${r.leader ? " on" : ""}" title="${esc(t("review.leaderTitle", "Лидер пати"))}">★</button></td>` +
          ["kills", "deaths", "pvp", "pve"].map(f => `<td><input class="rv-num" type="number" min="0" step="1" data-f="${f}" value="${esc(r[f] == null ? "" : r[f])}" /></td>`).join("") +
          `<td class="rv-flags"></td>` +
          `<td><button type="button" class="rv-del" title="${esc(t("review.delRow", "Убрать строку"))}">×</button></td>`;
        tr.querySelectorAll("input[data-f]").forEach(inp => {
          inp.addEventListener("input", () => {
            const f = inp.dataset.f;
            r[f] = f === "nick" ? inp.value : (inp.value === "" ? "" : Number(inp.value));
            if(f !== "nick") inp.classList.toggle("rv-bad", isBadNumber(r[f]));
            recompute(); setFlagsCells();
          });
        });
        tr.querySelector(".rv-sug").addEventListener("click", (e) => {
          const b = e.target.closest(".rv-sug-btn"); if(!b) return;
          r.nick = b.dataset.nick;
          recompute(); renderTable();
        });
        tr.querySelector(".rv-star").addEventListener("click", () => {
          const was = r.leader;
          sc.rows.forEach(x => { x.leader = false; });
          r.leader = !was;
          renderTable();
        });
        tr.querySelector(".rv-del").addEventListener("click", () => {
          sc.rows.splice(i, 1);
          recompute(); renderTable();
        });
        tbody.appendChild(tr);
        tr.querySelectorAll("input.rv-num").forEach(inp => inp.classList.toggle("rv-bad", isBadNumber(r[inp.dataset.f])));
      });
      recompute(); setFlagsCells();
    }

    function renderTabs(){
      tabsEl.innerHTML = "";
      work.forEach((sc, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "rv-tab" + (i === cur ? " active" : "");
        b.innerHTML = esc(t("review.tab", "Скрин {n}").replace("{n}", i + 1)) + `<span class="rv-badge"></span>`;
        b.addEventListener("click", () => { cur = i; showScreen(); });
        tabsEl.appendChild(b);
      });
    }
    function showScreen(){
      [...tabsEl.children].forEach((b, i) => b.classList.toggle("active", i === cur));
      imgEl.src = work[cur].image || "";
      shotEl.classList.remove("zoom");
      renderTable();
    }

    shotEl.addEventListener("click", () => shotEl.classList.toggle("zoom"));
    $(".rv-add").addEventListener("click", () => {
      work[cur].rows.push({ nick: "", orig: "", kills: 0, deaths: 0, pvp: 0, pve: 0, cls: null, leader: false });
      renderTable();
      const inputs = tbody.querySelectorAll("input.rv-nick");
      if(inputs.length) inputs[inputs.length - 1].focus();
    });

    function close(){
      document.removeEventListener("keydown", onKey);
      overlay.remove();
    }
    function onKey(e){ if(e.key === "Escape"){ close(); if(opts.onCancel) opts.onCancel(); } }
    document.addEventListener("keydown", onKey);

    $(".rv-cancel").addEventListener("click", () => { close(); if(opts.onCancel) opts.onCancel(); });
    $(".rv-apply").addEventListener("click", () => {
      recompute();
      const w = summarize(analysis).warn;
      if(w && !confirm(t("review.confirmWarn", "Остались предупреждения ({w}). Применить как есть?").replace("{w}", w))) return;
      const edited = work.map(sc => ({
        idx: sc.idx, image: sc.image,
        rows: sc.rows.map(r => ({
          nick: trimNick(r.nick), orig: r.orig, cls: r.cls, leader: r.leader,
          kills: Math.max(0, Math.round(Number(r.kills) || 0)), deaths: Math.max(0, Math.round(Number(r.deaths) || 0)),
          pvp: Math.max(0, Math.round(Number(r.pvp) || 0)), pve: Math.max(0, Math.round(Number(r.pve) || 0)),
        })),
      }));
      // исправленный вручную или по подсказке ник, который есть в переписи, запоминается как привязка:
      // в следующий раз такое написание со скрина подставится само
      const aliases = [];
      if(opts.nickInfo && opts.onAliases){
        const seen = new Set();
        edited.forEach(sc => sc.rows.forEach(r => {
          const from = trimNick(r.orig), to = trimNick(r.nick);
          if(!from || !to || from === to || AMBIGUOUS.test(from) || seen.has(from)) return;
          const a = opts.nickInfo(from, r.cls && r.cls.className), b = opts.nickInfo(to, r.cls && r.cls.className);
          if(a && a.status === "unknown" && b && b.status !== "unknown"){ seen.add(from); aliases.push({ alias: from, canonical: to }); }
        }));
      }
      close();
      opts.onApply(edited);
      if(aliases.length) opts.onAliases(aliases);
    });

    renderTabs();
    showScreen();
  }

  window.L2Review = { analyze, summarize, open, isAmbiguous: (s) => AMBIGUOUS.test(String(s || "")) };
})();
