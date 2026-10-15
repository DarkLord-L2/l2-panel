// Раскладка набора карточек: «плитки» (как раньше) / «полосы» / своя (двигать и менять размер каждой карточки).
//
// Три кнопки (такого же размера и цвета, как «?»): 1 — полосы, 2 — плитки, 3 — режим редактирования.
// Кнопки 1 и 2 сбрасывают раскладку в полосы/плитки — в том числе посреди редактирования (несохранённое теряется).
// Кнопка 3: первый клик — вход в редактирование (карточки можно двигать и тянуть за края и углы), второй — сохранить
// и выйти. Сохранённая «своя» раскладка живёт в localStorage у каждого пользователя отдельно, строго по ключу.
//
// Использование:
//   const board = L2LayoutBoard.create({ container, key, buttons, itemSel: "[data-lbid]", ... });
//   board.apply();   // после каждой перерисовки карточек (они пересоздаются — стили слетают)
//   board.endEdit(true) / board.cancelEdit()   // если ушли с экрана посреди редактирования
//
// Положение по горизонтали хранится ДОЛЯМИ ширины контейнера (окно потом можно растянуть/сжать), по вертикали — в пикселях.
//
// Как устроено перетаскивание (чтобы не лагало и ловилось мышью):
//  • указатель «захватывается» (pointer capture) — движение отслеживается, даже когда мышь вылетела за карточку, окно или iframe;
//  • обработка движения — не чаще одного раза за кадр (requestAnimationFrame), а не на каждое событие мыши (их сотни в секунду);
//  • во время движения меняется только сама карточка; высота контейнера лишь растёт, а точно пересчитывается при отпускании;
//  • у края окна страница сама прокручивается — карточку можно дотащить в самый низ;
//  • ручки изменения размера — полосы ВНУТРИ карточки по всем краям и крупные уголки (раньше торчали наружу и обрезались).
(function(global){
  "use strict";
  const SNAP = 8; // шаг сетки при перетаскивании — чтобы всё выглядело ровно

  const ICONS = {
    rows: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.8" y="2.6" width="12.4" height="3" rx="1"/><rect x="1.8" y="6.5" width="12.4" height="3" rx="1"/><rect x="1.8" y="10.4" width="12.4" height="3" rx="1"/></svg>',
    tiles: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>',
    edit: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 13.5l.6-3L11 2.6a1.4 1.4 0 012 2L5.1 12.9l-2.6.6z"/><path d="M9.6 4l2.4 2.4"/></svg>',
    save: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3.2L13 4.6"/></svg>',
  };

  function ensureStyle(){
    if(document.getElementById("lb-style")) return;
    const st = document.createElement("style");
    st.id = "lb-style";
    st.textContent = `
      .lb-btns{ position:fixed; bottom:16px; right:56px; display:flex; gap:4px; z-index:56; }
      .lb-btn{ width:32px; height:32px; padding:0; border-radius:6px; border:1px solid var(--border); background: var(--panel);
        color: var(--text-dim); cursor:pointer; display:flex; align-items:center; justify-content:center; font-family:inherit; }
      .lb-btn:hover{ color: var(--text); border-color: var(--border-lit); }
      .lb-btn.active{ color: var(--gold); border-color: var(--gold-dim); }
      .lb-presets{ display:none; align-items:center; gap:4px; padding-right:8px; margin-right:4px; border-right:1px solid var(--border); }
      .lb-btns.lb-editing-on .lb-presets{ display:flex; animation: lb-pop .18s ease-out; }
      @keyframes lb-pop{ from{ opacity:0; transform:translateX(10px); } to{ opacity:1; transform:none; } }
      .lb-presets-label{ font-size:11px; color: var(--text-dim); margin-right:4px; white-space:nowrap; }
      .lb-custom{ position:relative !important; display:block !important; }
      .lb-custom > [data-lbid]{ position:absolute; box-sizing:border-box; margin:0 !important; }
      .lb-custom.lb-clip:not(.lb-editing) > [data-lbid]{ overflow:hidden; }
      /* в режиме редактирования: рамка вокруг области, пунктир вокруг карточек, никаких анимаций */
      .lb-editing{ outline:1px dashed var(--border-lit); outline-offset:6px; border-radius:4px;
        background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
        background-size: ${SNAP * 4}px ${SNAP * 4}px; background-position:-1px -1px; }
      .lb-editing > [data-lbid]{ outline:1px dashed var(--gold-dim); cursor:move; user-select:none; -webkit-user-select:none;
        touch-action:none; transition:none !important; overflow:hidden; }
      .lb-editing > [data-lbid]:hover{ outline-color: var(--gold); }
      .lb-editing > [data-lbid].lb-active{ outline:2px solid var(--gold); z-index:5; }
      .lb-editing > [data-lbid] *{ pointer-events:none; }
      /* ручки: полосы внутри карточки по краям и крупные уголки — ловятся мышью без прицеливания */
      .lb-editing > [data-lbid] > .lb-h{ pointer-events:auto; }
      .lb-h{ position:absolute; z-index:6; }
      .lb-h::after{ content:""; position:absolute; background: var(--gold); border-radius:3px; opacity:0; transition:opacity .1s; }
      .lb-h:hover::after, .lb-active > .lb-h.on::after{ opacity:.85; }
      .lb-h[data-h="n"], .lb-h[data-h="s"]{ left:20px; right:20px; height:10px; cursor:ns-resize; }
      .lb-h[data-h="e"], .lb-h[data-h="w"]{ top:20px; bottom:20px; width:10px; cursor:ew-resize; }
      .lb-h[data-h="n"]{ top:0; } .lb-h[data-h="s"]{ bottom:0; } .lb-h[data-h="e"]{ right:0; } .lb-h[data-h="w"]{ left:0; }
      .lb-h[data-h="n"]::after, .lb-h[data-h="s"]::after{ left:25%; right:25%; height:4px; top:3px; }
      .lb-h[data-h="s"]::after{ top:auto; bottom:3px; }
      .lb-h[data-h="e"]::after, .lb-h[data-h="w"]::after{ top:25%; bottom:25%; width:4px; left:3px; }
      .lb-h[data-h="e"]::after{ left:auto; right:3px; }
      .lb-h[data-h="ne"], .lb-h[data-h="nw"], .lb-h[data-h="se"], .lb-h[data-h="sw"]{ width:20px; height:20px; }
      .lb-h[data-h="ne"]{ top:0; right:0; cursor:nesw-resize; } .lb-h[data-h="nw"]{ top:0; left:0; cursor:nwse-resize; }
      .lb-h[data-h="se"]{ bottom:0; right:0; cursor:nwse-resize; } .lb-h[data-h="sw"]{ bottom:0; left:0; cursor:nesw-resize; }
      .lb-h[data-h="ne"]::after, .lb-h[data-h="nw"]::after, .lb-h[data-h="se"]::after, .lb-h[data-h="sw"]::after{ width:9px; height:9px; opacity:.6; }
      .lb-h[data-h="ne"]::after{ top:3px; right:3px; } .lb-h[data-h="nw"]::after{ top:3px; left:3px; }
      .lb-h[data-h="se"]::after{ bottom:3px; right:3px; } .lb-h[data-h="sw"]::after{ bottom:3px; left:3px; }
      .lb-h[data-h="ne"]:hover::after, .lb-h[data-h="nw"]:hover::after, .lb-h[data-h="se"]:hover::after, .lb-h[data-h="sw"]:hover::after{ opacity:1; }
      /* во время изменения размера — плашка «ширина × высота» */
      .lb-editing > [data-lbid].lb-resizing::before{ content: attr(data-lbsize); position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
        background:rgba(0,0,0,.72); color:#fff; font-size:12px; font-weight:600; padding:3px 9px; border-radius:6px; z-index:7; pointer-events:none; white-space:nowrap; }
    `;
    document.head.appendChild(st);
  }

  function loadState(key){
    try {
      const o = JSON.parse(localStorage.getItem(key) || "null");
      if(o && (o.mode === "tiles" || o.mode === "rows" || o.mode === "custom")) return { mode: o.mode, items: o.items || {}, preset: o.preset || null };
    } catch(e){}
    return { mode: "tiles", items: {}, preset: null };
  }
  function saveState(key, st){
    try { localStorage.setItem(key, JSON.stringify(st)); } catch(e){}
  }

  function create(opts){
    ensureStyle();
    const container = opts.container;
    const itemSel = opts.itemSel || "[data-lbid]";
    const minW = opts.minW || 110, minH = opts.minH || 56;
    const defW = opts.defW || 240, defH = opts.defH || 120;
    const gap = opts.gap == null ? 14 : opts.gap;
    // «широкая» карточка (полоса): внутри содержимое раскладывается в строку, а не столбиком — иначе в низкой широкой
    // карточке оно не помещается и обрезается. Определяется по размеру, поэтому работает и при ручном изменении размера
    const isWide = opts.wide || ((w, h) => w >= 520 && w / h >= 3.2);
    const T = opts.t || ((k, f) => f);
    let state = loadState(opts.key);   // { mode: "tiles"|"rows"|"custom", items: { id: {x,y,w,h} } } — x, w — доли ширины
    let editing = false;
    let work = null;                   // рабочая копия на время редактирования
    let lastW = 0;
    let dragging = false;              // идёт перетаскивание — пересчёт по изменению ширины не нужен
    container.classList.toggle("lb-clip", !!opts.clip);

    const items = () => [...container.children].filter(el => el.matches(itemSel));
    const cw = () => container.clientWidth || 0;
    const snap = (v) => Math.round(v / SNAP) * SNAP;

    // ---------- шаблоны (пресеты) ----------
    // Шаблон — не набор готовых координат, а правило расстановки: размер клетки, число колонок, зазоры. Поэтому он
    // подходит к любому числу карточек и к любой ширине окна, а новый участник сам встаёт в ту же сетку.
    const presets = opts.presets || [];
    let presetActive = state.mode === "custom" ? (state.preset || null) : null;
    function generate(presetId, els, W){
      const pr = presets.find(x => x.id === presetId);
      if(!pr) return null;
      const sp = pr.spec;
      const gx = sp.gapX != null ? sp.gapX : (sp.gap != null ? sp.gap : 8), gy = sp.gapY != null ? sp.gapY : (sp.gap != null ? sp.gap : 8);
      const cols = sp.cols || Math.max(1, Math.floor((W + gx) / (sp.cellW + gx)));
      const w = sp.stretch ? (W - gx * (cols - 1)) / cols : Math.min(sp.cellW, W);
      const map = {};
      els.forEach((el, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        map[el.dataset.lbid] = { x: (c * (w + gx)) / W, y: r * (sp.cellH + gy), w: w / W, h: sp.cellH };
      });
      return map;
    }
    function applyPreset(id){
      if(!presets.length) return;
      if(!editing) beginEdit();
      if(!editing) return;
      const W = cw(); if(W <= 0) return;
      const map = generate(id, items(), W);
      if(!map) return;
      work = map; presetActive = id;
      apply();
    }
    let presetBox = null;
    if(presets.length && opts.buttons){
      presetBox = document.createElement("div");
      presetBox.className = "lb-presets";
      const lab = document.createElement("span");
      lab.className = "lb-presets-label"; lab.textContent = T("layout.presets", "Шаблоны");
      presetBox.appendChild(lab);
      presets.forEach(pr => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "lb-btn"; b.dataset.preset = pr.id;
        b.innerHTML = pr.icon || ""; b.title = T("layout.preset." + pr.id, pr.title);
        b.addEventListener("click", () => applyPreset(pr.id));
        presetBox.appendChild(b);
      });
      opts.buttons.insertBefore(presetBox, opts.buttons.firstChild);
    }

    // ---------- кнопки ----------
    const btns = opts.buttons ? {
      rows: opts.buttons.querySelector('[data-lb="rows"]'),
      tiles: opts.buttons.querySelector('[data-lb="tiles"]'),
      edit: opts.buttons.querySelector('[data-lb="edit"]'),
    } : null;
    if(btns){
      btns.rows.innerHTML = ICONS.rows;  btns.rows.title = T("layout.rows", "Полосами");
      btns.tiles.innerHTML = ICONS.tiles; btns.tiles.title = T("layout.tiles", "Плитками");
      btns.rows.addEventListener("click", () => setMode("rows"));
      btns.tiles.addEventListener("click", () => setMode("tiles"));
      btns.edit.addEventListener("click", () => { if(editing) endEdit(true); else beginEdit(); });
    }
    function paintButtons(){
      if(!btns) return;
      btns.rows.classList.toggle("active", !editing && state.mode === "rows");
      btns.tiles.classList.toggle("active", !editing && state.mode === "tiles");
      btns.edit.classList.toggle("active", editing || state.mode === "custom");
      btns.edit.innerHTML = editing ? ICONS.save : ICONS.edit;
      btns.edit.title = editing ? T("layout.save", "Сохранить расположение") : T("layout.edit", "Изменить расположение и размеры");
      // шаблоны видны только пока идёт редактирование; выбранный подсвечен, пока карточки не двигали вручную
      opts.buttons.classList.toggle("lb-editing-on", editing);
      if(presetBox) presetBox.querySelectorAll("[data-preset]").forEach(b => b.classList.toggle("active", b.dataset.preset === presetActive));
    }

    // ---------- применение раскладки к карточкам ----------
    function clearInline(el){
      ["position", "left", "top", "width", "height"].forEach(p => { el.style[p] = ""; });
      el.removeAttribute("data-lbsize");
      el.classList.remove("lb-wide", "lb-short", "lb-tiny");
      el.querySelectorAll(":scope > .lb-h").forEach(h => h.remove());
    }
    function place(el, r, W){
      el.classList.toggle("lb-wide", isWide(r.w * W, r.h));
      el.classList.toggle("lb-short", r.h < 72);
      el.classList.toggle("lb-tiny", r.h < 56); // низкая карточка — отступы внутри теснее, иначе содержимое не помещается
      el.style.position = "absolute";
      el.style.left = Math.round(r.x * W) + "px";
      el.style.top = Math.round(r.y) + "px";
      el.style.width = Math.max(1, Math.round(r.w * W)) + "px";
      el.style.height = Math.max(1, Math.round(r.h)) + "px";
    }
    function addHandles(el){
      if(el.querySelector(":scope > .lb-h")) return;
      // сначала края, потом уголки — уголки поверх краёв
      ["n", "s", "e", "w", "ne", "nw", "se", "sw"].forEach(h => {
        const i = document.createElement("i");
        i.className = "lb-h"; i.dataset.h = h;
        el.appendChild(i);
      });
    }
    const bottomOf = (map) => { let b = 0; for(const k in map){ b = Math.max(b, map[k].y + map[k].h); } return b; };
    function apply(){
      const els = items();
      container.classList.toggle("lb-rows", state.mode === "rows" && !editing);
      const custom = editing || state.mode === "custom";
      container.classList.toggle("lb-custom", custom);
      container.classList.toggle("lb-editing", editing);
      if(!custom){
        els.forEach(clearInline);
        container.style.height = "";
        paintButtons();
        return;
      }
      const W = cw();
      if(W <= 0) return; // раздел ещё скрыт — ResizeObserver применит, когда появится ширина
      lastW = W;
      // сохранённый шаблон пересобирается под ТЕКУЩИХ карточек и ширину — новый участник сам встаёт в ту же сетку,
      // ушедший не оставляет дыру. Если раскладку правили вручную (шаблона нет), новый встаёт в свободное место снизу
      let map = editing ? work : state.items;
      if(!editing && state.preset){
        const g = generate(state.preset, els, W);
        if(g) map = g;
      }
      // карточки без сохранённого места (новые группы/участники) — по порядку в свободные места снизу
      const bottom = els.reduce((b, el) => { const r = map[el.dataset.lbid]; return r ? Math.max(b, r.y + r.h) : b; }, 0);
      // размер новой карточки — самый частый среди уже стоящих (чтобы новый участник выглядел как остальные)
      const sizeCount = new Map();
      els.forEach(el => { const r = map[el.dataset.lbid]; if(r){ const k = Math.round(r.w * W) + "x" + Math.round(r.h); sizeCount.set(k, (sizeCount.get(k) || 0) + 1); } });
      let newW = defW, newH = defH;
      if(sizeCount.size){ const best = [...sizeCount.entries()].sort((x, y) => y[1] - x[1])[0][0].split("x"); newW = Number(best[0]); newH = Number(best[1]); }
      let cx = 0, cy = bottom ? bottom + gap : 0, rowH = 0, added = false;
      els.forEach(el => {
        const id = el.dataset.lbid;
        if(map[id]) return;
        const w = Math.min(newW, W), h = newH;
        if(cx + w > W + 1){ cx = 0; cy += rowH + gap; rowH = 0; }
        map[id] = { x: cx / W, y: cy, w: w / W, h };
        cx += w + gap; rowH = Math.max(rowH, h); added = true;
      });
      if(added && !editing) saveState(opts.key, state);
      let maxBottom = 0;
      els.forEach(el => {
        const r = map[el.dataset.lbid];
        place(el, r, W);
        maxBottom = Math.max(maxBottom, r.y + r.h);
        if(editing){
          addHandles(el);
          if(el.draggable){ el.dataset.lbDrag = "1"; el.draggable = false; } // обычное перетаскивание «поменять местами» на время редактирования отключаем
        } else {
          el.querySelectorAll(":scope > .lb-h").forEach(h => h.remove());
        }
      });
      container.style.height = (maxBottom + 24) + "px";
      paintButtons();
    }

    // ---------- режимы ----------
    function restoreDraggable(){
      items().forEach(el => { if(el.dataset.lbDrag){ el.draggable = true; delete el.dataset.lbDrag; } });
    }
    function setMode(mode){
      // «полосы»/«плитки» возвращают стандартную раскладку, своя пропадает; несохранённое редактирование — тоже
      editing = false; work = null; presetActive = null;
      restoreDraggable();
      state = { mode, items: {}, preset: null };
      saveState(opts.key, state);
      apply();
    }
    function beginEdit(){
      if(editing) return;
      const els = items();
      const W = cw();
      if(W <= 0) return;
      work = {};
      presetActive = null;
      if(state.mode === "custom" && state.preset && generate(state.preset, els, W)){
        work = generate(state.preset, els, W);
        presetActive = state.preset;
      } else if(state.mode === "custom"){
        work = JSON.parse(JSON.stringify(state.items));
      } else {
        // стартуем ровно с того, как карточки лежат сейчас (плитки/полосы): ни сдвига на сетку, ни округления размеров —
        // при входе в редактирование ничего не «прыгает» и не перекрывается; на сетку встанет то, что начнут двигать
        const cr = container.getBoundingClientRect();
        els.forEach(el => {
          const r = el.getBoundingClientRect();
          work[el.dataset.lbid] = { x: Math.round(r.left - cr.left) / W, y: Math.round(r.top - cr.top),
            w: Math.round(r.width) / W, h: Math.round(r.height) };
        });
      }
      editing = true;
      apply();
    }
    function endEdit(commit){
      if(!editing) return;
      if(commit){
        state = { mode: "custom", items: Object.assign({}, state.mode === "custom" && !presetActive ? state.items : {}, work), preset: presetActive };
        saveState(opts.key, state);
      }
      presetActive = state.mode === "custom" ? (state.preset || null) : null;
      editing = false; work = null;
      restoreDraggable();
      apply();
    }

    // ---------- перетаскивание и изменение размера ----------
    container.addEventListener("pointerdown", (e) => {
      if(!editing || (e.pointerType === "mouse" && e.button !== 0)) return;
      const el = e.target.closest(itemSel);
      if(!el || el.parentElement !== container) return;
      const id = el.dataset.lbid;
      const r0 = work[id]; if(!r0) return;
      e.preventDefault(); e.stopPropagation();
      const handle = e.target.closest(".lb-h");
      const dir = handle ? handle.dataset.h : "move";
      const W = cw();
      const p0 = { x: r0.x * W, y: r0.y, w: r0.w * W, h: r0.h };
      const mw = Math.min(minW, p0.w), mh = Math.min(minH, p0.h); // карточка уже меньше общего минимума (низкая полоса) — не заставляем её вырасти
      // координаты указателя считаем ОТНОСИТЕЛЬНО контейнера — тогда прокрутка страницы во время перетаскивания не сбивает положение
      const cr0 = container.getBoundingClientRect();
      const sx = e.clientX - cr0.left, sy = e.clientY - cr0.top;
      let last = { x: e.clientX, y: e.clientY };
      let raf = 0, curHeight = parseFloat(container.style.height) || 0;
      dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch(_){} // движение отслеживается, даже когда мышь уехала за пределы окна/iframe
      el.classList.add("lb-active");
      if(dir !== "move") el.classList.add("lb-resizing");
      handle && handle.classList.add("on");

      const compute = () => {
        const cr = container.getBoundingClientRect();
        // шаг сетки считаем от НАЧАЛЬНОГО положения (двигаем на кратное 8): простое касание карточки ничего не сдвигает
        const dx = snap((last.x - cr.left) - sx), dy = snap((last.y - cr.top) - sy);
        let { x, y, w, h } = p0;
        if(dir === "move"){ x += dx; y += dy; }
        else {
          if(dir.indexOf("e") >= 0) w += dx;
          if(dir.indexOf("s") >= 0) h += dy;
          if(dir.indexOf("w") >= 0){ x += dx; w -= dx; }
          if(dir.indexOf("n") >= 0){ y += dy; h -= dy; }
        }
        x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
        // минимальный размер: край, за который не тянули, остаётся на месте
        if(w < mw){ if(dir.indexOf("w") >= 0) x = Math.round(p0.x + p0.w) - mw; w = mw; }
        if(h < mh){ if(dir.indexOf("n") >= 0) y = Math.round(p0.y + p0.h) - mh; h = mh; }
        // не выходить за контейнер слева/справа/сверху
        if(x < 0){ if(dir !== "move") w += x; x = 0; }
        if(x + w > W){ if(dir === "move") x = Math.max(0, W - w); else w = W - x; }
        if(y < 0){ if(dir !== "move") h += y; y = 0; }
        w = Math.max(mw, w); h = Math.max(mh, h);
        return { x, y, w, h };
      };
      const frame = () => {
        raf = 0;
        if(!dragging) return;
        // у верхнего/нижнего края окна страница прокручивается сама — можно дотащить в самый низ
        const vh = global.innerHeight, edge = 60;
        let scroll = 0;
        if(last.y > vh - edge) scroll = Math.min(16, (last.y - (vh - edge)) / 3 + 2);
        else if(last.y < edge) scroll = -Math.min(16, (edge - last.y) / 3 + 2);
        if(scroll) global.scrollBy(0, scroll);
        const p = compute();
        if(presetActive && (Math.round(p.x) !== Math.round(p0.x) || Math.round(p.y) !== Math.round(p0.y) || Math.round(p.w) !== Math.round(p0.w) || Math.round(p.h) !== Math.round(p0.h))){
          presetActive = null; // правим вручную — это уже своя раскладка, а не шаблон
          if(presetBox) presetBox.querySelectorAll("[data-preset]").forEach(b => b.classList.remove("active"));
        }
        work[id] = { x: p.x / W, y: p.y, w: p.w / W, h: p.h };
        place(el, work[id], W);
        if(dir !== "move") el.dataset.lbsize = Math.round(p.w) + " × " + Math.round(p.h);
        // высота области лишь растёт, пока тащим (точный пересчёт — при отпускании): меньше перерисовок
        const need = p.y + p.h + 24;
        if(need > curHeight){ curHeight = need; container.style.height = need + "px"; }
        if(scroll) raf = requestAnimationFrame(frame); // указатель у края — продолжаем прокрутку, даже если мышь стоит
      };
      const onMove = (ev) => { last = { x: ev.clientX, y: ev.clientY }; if(!raf) raf = requestAnimationFrame(frame); };
      const finish = (ev) => {
        if(ev && ev.clientX != null) last = { x: ev.clientX, y: ev.clientY };
        if(raf){ cancelAnimationFrame(raf); raf = 0; }
        if(dragging){ // последнее положение — точно там, где отпустили
          const p = compute();
          work[id] = { x: p.x / W, y: p.y, w: p.w / W, h: p.h };
          place(el, work[id], W);
        }
        dragging = false;
        el.classList.remove("lb-active", "lb-resizing");
        el.removeAttribute("data-lbsize");
        handle && handle.classList.remove("on");
        try { el.releasePointerCapture(e.pointerId); } catch(_){}
        global.removeEventListener("pointermove", onMove);
        global.removeEventListener("pointerup", finish);
        global.removeEventListener("pointercancel", finish);
        container.style.height = (bottomOf(work) + 24) + "px";
      };
      global.addEventListener("pointermove", onMove);
      global.addEventListener("pointerup", finish);
      global.addEventListener("pointercancel", finish);
    });
    // в режиме редактирования клики по карточкам (открыть группу, меню «⋮») не должны срабатывать
    container.addEventListener("click", (e) => { if(editing){ e.stopPropagation(); e.preventDefault(); } }, true);
    // и контекстное меню/выделение не мешают
    container.addEventListener("dragstart", (e) => { if(editing) e.preventDefault(); }, true);

    // ширина контейнера изменилась (окно растянули, раздел показали) — пересчитываем положения из долей
    if(global.ResizeObserver){
      new ResizeObserver(() => {
        if(dragging) return; // во время перетаскивания может появиться полоса прокрутки — не дёргаем раскладку
        const W = cw();
        if(W !== lastW && W > 0 && (editing || state.mode === "custom")) apply();
      }).observe(container);
    }

    paintButtons();
    return { apply, beginEdit, endEdit, cancelEdit: () => endEdit(false), isEditing: () => editing, mode: () => state.mode };
  }

  global.L2LayoutBoard = { create };
})(window);
