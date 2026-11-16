// Свой календарь вместо системного <input type="date"> — системный рисуется в языке
// браузера («tt.mm.jjjj» в немецком Chrome и т.п.) и по-разному в каждом браузере.
// Подключение: просто <script src="js/datepicker.js"> ПОСЛЕ разметки страницы — все
// input[type=date] заменяются сами (и добавленные позже тоже).
// Совместимость со старым кодом страниц: исходное поле остаётся (становится hidden),
// его .value — как раньше «ГГГГ-ММ-ДД», события change/input приходят на него же,
// а запись .value = "…" из кода сразу обновляет видимую кнопку.
(function(){
  "use strict";
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const t = (k, f) => (window.L2I18n && L2I18n.t) ? L2I18n.t(k, f) : f;
  const loc = () => (window.L2I18n && L2I18n.locale) ? L2I18n.locale() : "ru-RU";
  const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>';

  const style = document.createElement("style");
  style.textContent = `
    .l2dp-btn{ display:inline-flex; align-items:center; gap:8px; min-width:150px; padding:9px 11px; border-radius:var(--radius-sm,7px);
      border:1px solid var(--border-lit,#373a42); background:#111215; color:var(--text,#e3e4e8); font:inherit; font-size:13.5px; cursor:pointer; text-align:left;
      font-variant-numeric: tabular-nums; transition: border-color .15s, box-shadow .15s; }
    .l2dp-btn:hover{ border-color:#454952; }
    .l2dp-btn.open, .l2dp-btn:focus-visible{ outline:none; border-color: var(--accent-line, #6b5a2a); box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus,#5b8def) 22%, transparent); }
    .l2dp-btn svg{ width:16px; height:16px; color:var(--text-dim,#8b8d96); flex:none; }
    .l2dp-btn.empty span{ color:#5d6068; }
    .l2dp-btn:disabled{ opacity:.5; cursor:default; }
    .l2dp-pop{ position:fixed; z-index:200; width:272px; padding:12px; border-radius:12px; background:var(--panel,#15161a);
      border:1px solid var(--border-lit,#373a42); box-shadow: 0 18px 50px rgba(0,0,0,.55); font-size:13px; color:var(--text,#e3e4e8);
      animation: l2dpIn .14s ease both; user-select:none; }
    @keyframes l2dpIn{ from{ opacity:0; transform: translateY(-4px); } to{ opacity:1; transform:none; } }
    .l2dp-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
    .l2dp-head b{ font-weight:700; text-transform:capitalize; }
    .l2dp-nav{ width:30px; height:30px; border-radius:8px; border:none; background:none; color:var(--text-dim,#8b8d96); font-size:18px; cursor:pointer; }
    .l2dp-nav:hover{ background:rgba(255,255,255,.06); color:var(--text,#e3e4e8); }
    .l2dp-grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
    .l2dp-wd{ text-align:center; font-size:10.5px; font-weight:600; color:var(--text-dim,#8b8d96); padding:4px 0; text-transform:capitalize; }
    .l2dp-d{ height:32px; border:none; border-radius:8px; background:none; color:var(--text,#e3e4e8); font:inherit; font-size:12.5px; cursor:pointer; font-variant-numeric: tabular-nums; }
    .l2dp-d:hover{ background:rgba(255,255,255,.07); }
    .l2dp-d.out{ color:#4c4f57; }
    .l2dp-d.we{ color:#c9a6a6; } .l2dp-d.out.we{ color:#4c4f57; }
    .l2dp-d.today{ box-shadow: inset 0 0 0 1px var(--accent-line, #6b5a2a); }
    .l2dp-d.sel{ background:var(--gold,#e0a52a); color:#15130c; font-weight:700; }
    .l2dp-foot{ display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid var(--border,#26282e); }
    .l2dp-foot button{ border:none; background:none; color:var(--gold,#e0a52a); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; padding:4px 6px; border-radius:6px; }
    .l2dp-foot button:hover{ background:rgba(255,255,255,.05); }
    .l2dp-foot button.clear{ color:var(--text-dim,#8b8d96); }
  `;
  document.head.appendChild(style);

  let pop = null, active = null, view = null;

  function close(){
    if(pop){ pop.remove(); pop = null; }
    if(active){ active.btn.classList.remove("open"); active = null; }
  }
  function commit(rec, value){
    rec.input.value = value;
    rec.input.dispatchEvent(new Event("input", { bubbles: true }));
    rec.input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function draw(){
    const rec = active; if(!rec || !pop) return;
    const sel = parse(rec.input.value), today = iso(new Date());
    const y = view.getFullYear(), m = view.getMonth();
    // «ноябрь 2026» — без «г.», который Intl добавляет в русском
    const title = new Intl.DateTimeFormat(loc(), { month: "long" }).format(view) + " " + y;
    const wdFmt = new Intl.DateTimeFormat(loc(), { weekday: "short" });
    const wd = [...Array(7)].map((_, i) => wdFmt.format(new Date(2024, 0, 1 + i))); // 01.01.2024 — понедельник
    const first = new Date(y, m, 1);
    const shift = (first.getDay() + 6) % 7; // неделя с понедельника
    const start = new Date(y, m, 1 - shift);
    let cells = "";
    for(let i = 0; i < 42; i++){
      const d = new Date(start); d.setDate(start.getDate() + i);
      const v = iso(d), dow = (d.getDay() + 6) % 7;
      const cls = ["l2dp-d", d.getMonth() !== m ? "out" : "", dow >= 5 ? "we" : "", v === today ? "today" : "", sel && v === iso(sel) ? "sel" : ""].filter(Boolean).join(" ");
      cells += `<button type="button" class="${cls}" data-v="${v}">${d.getDate()}</button>`;
    }
    pop.innerHTML =
      `<div class="l2dp-head"><button type="button" class="l2dp-nav" data-nav="-1">‹</button><b>${title}</b><button type="button" class="l2dp-nav" data-nav="1">›</button></div>` +
      `<div class="l2dp-grid">${wd.map(w => `<span class="l2dp-wd">${w}</span>`).join("")}${cells}</div>` +
      `<div class="l2dp-foot"><button type="button" data-today="1">${t("datepicker.today", "Сегодня")}</button><button type="button" class="clear" data-clear="1">${t("datepicker.clear", "Очистить")}</button></div>`;
  }
  function place(){
    if(!pop || !active) return;
    const r = active.btn.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.min(r.left, window.innerWidth - w - 8); left = Math.max(8, left);
    let top = r.bottom + 6; if(top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  function open(rec){
    if(active === rec){ close(); return; }
    close();
    active = rec; rec.btn.classList.add("open");
    const sel = parse(rec.input.value) || new Date();
    view = new Date(sel.getFullYear(), sel.getMonth(), 1);
    pop = document.createElement("div"); pop.className = "l2dp-pop";
    document.body.appendChild(pop);
    draw(); place();
    pop.addEventListener("click", (e) => {
      e.stopPropagation();
      const nav = e.target.closest("[data-nav]");
      if(nav){ view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1); draw(); place(); return; }
      const day = e.target.closest("[data-v]");
      if(day){ const r = active; close(); commit(r, day.dataset.v); r.btn.focus(); return; }
      if(e.target.closest("[data-today]")){ const r = active; close(); commit(r, iso(new Date())); return; }
      if(e.target.closest("[data-clear]")){ const r = active; close(); commit(r, ""); }
    });
  }
  document.addEventListener("click", (e) => { if(pop && !pop.contains(e.target) && !(active && active.btn.contains(e.target))) close(); });
  document.addEventListener("keydown", (e) => { if(e.key === "Escape" && pop){ e.stopPropagation(); close(); } }, true);
  window.addEventListener("resize", close);
  document.addEventListener("scroll", (e) => { if(pop && !pop.contains(e.target)) place(); }, true);

  function enhance(input){
    if(input.dataset.l2dp) return;
    input.dataset.l2dp = "1";
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "l2dp-btn";
    if(input.id) btn.dataset.for = input.id;
    const rec = { input, btn };
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    function refresh(){
      const v = desc.get.call(input), d = parse(v);
      btn.innerHTML = ICON + `<span>${d ? pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() : t("datepicker.placeholder", "дд.мм.гггг")}</span>`;
      btn.classList.toggle("empty", !d);
      btn.disabled = input.disabled;
    }
    input.type = "hidden";
    Object.defineProperty(input, "value", { configurable: true, get(){ return desc.get.call(input); }, set(v){ desc.set.call(input, v); refresh(); } });
    input.insertAdjacentElement("afterend", btn);
    btn.addEventListener("click", (e) => { e.stopPropagation(); if(!btn.disabled) open(rec); });
    // подпись <label for="id"> теперь открывает календарь, а не скрытое поле
    if(input.id){ document.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`).forEach(l => l.addEventListener("click", (e) => { e.preventDefault(); btn.click(); })); }
    refresh();
  }
  function scan(root){ (root.querySelectorAll ? root : document).querySelectorAll('input[type="date"]').forEach(enhance); }
  scan(document);
  new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => {
    if(n.nodeType !== 1) return;
    if(n.matches && n.matches('input[type="date"]')) enhance(n); else scan(n);
  }))).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", (e) => { if(e.key === "l2Lang") document.querySelectorAll('input[data-l2dp]').forEach(i => { i.value = i.value; }); });
})();
