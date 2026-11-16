// Вставка скрина из буфера (Win+Shift+S → Ctrl+V) и перетаскивание файлов мышью
// в любую загрузку скринов сайта. Ничего не знает о самих страницах: кладёт
// картинки в уже существующий <input type="file"> и шлёт ему обычное событие
// "change" — дальше срабатывает тот же код распознавания, что и при «Выбрать файлы…».
//
//   L2PasteDrop.attach(fileInput, zoneEl, { hintAfter: buttonEl })
//
// zoneEl — блок загрузки: Ctrl+V срабатывает, только пока он виден на экране
// (если видно несколько — берётся последний подключённый, обычно открытое окно),
// на него же можно бросить файлы. hintAfter — необязательно: рядом с этой кнопкой
// появится подсказка «или Ctrl+V / перетащите скрин».
(function(global){
  const targets = [];
  let styleDone = false;

  function addStyle(){
    if(styleDone) return; styleDone = true;
    const st = document.createElement("style");
    st.textContent =
      ".l2-drop-zone{ transition: box-shadow .15s, background .15s; }" +
      ".l2-drop-zone.l2-drop-over{ box-shadow: inset 0 0 0 2px var(--gold, #e0a52a); background: color-mix(in srgb, var(--gold, #e0a52a) 7%, transparent); border-radius:10px; }" +
      ".l2-paste-hint{ display:inline-flex; align-items:center; gap:6px; margin-left:10px; font-size:12px; color: var(--text-dim, #8b8d96); vertical-align:middle; }" +
      ".l2-paste-hint kbd{ font-family:inherit; font-size:11px; font-weight:600; padding:1px 6px; border-radius:5px; border:1px solid var(--border-lit, #373a42); background: var(--panel-2, #1c1d22); color: var(--text, #e3e4e8); }" +
      ".l2-paste-flash{ animation: l2PasteFlash .7s ease; }" +
      "@keyframes l2PasteFlash{ 0%{ box-shadow: inset 0 0 0 2px var(--ok, #46a066); } 100%{ box-shadow: inset 0 0 0 2px transparent; } }";
    document.head.appendChild(st);
  }

  function t(k, f){ return (global.L2I18n && L2I18n.t) ? L2I18n.t(k, f) : f; }
  function visible(el){ return !!el && el.isConnected && el.getClientRects().length > 0; }

  function feed(target, files){
    const imgs = files.filter(f => f && /^image\//.test(f.type));
    if(!imgs.length) return false;
    try{
      const dt = new DataTransfer();
      // у картинки из буфера имя всегда «image.png» — даём своё, чтобы несколько вставок не выглядели одним файлом
      imgs.forEach((f, i) => dt.items.add(f.name && f.name !== "image.png" ? f : new File([f], "screenshot-" + Date.now() + "-" + i + ".png", { type: f.type })));
      target.input.files = dt.files;
    }catch(e){ console.error("L2PasteDrop:", e); return false; }
    target.input.dispatchEvent(new Event("change", { bubbles: true }));
    target.zone.classList.remove("l2-paste-flash"); void target.zone.offsetWidth; target.zone.classList.add("l2-paste-flash");
    return true;
  }

  document.addEventListener("paste", (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items.filter(it => it.kind === "file" && /^image\//.test(it.type)).map(it => it.getAsFile()).filter(Boolean);
    if(!files.length) return; // обычный текст — не мешаем вставке в поля
    const target = targets.filter(x => visible(x.zone) && !x.input.disabled).pop();
    if(!target) return;
    e.preventDefault();
    feed(target, files);
  });

  function attach(input, zone, opts){
    if(!input || !zone) return;
    opts = opts || {};
    addStyle();
    const target = { input, zone };
    targets.push(target);
    zone.classList.add("l2-drop-zone");
    let depth = 0;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");
    zone.addEventListener("dragenter", (e) => { if(!hasFiles(e)) return; e.preventDefault(); depth++; zone.classList.add("l2-drop-over"); });
    zone.addEventListener("dragover", (e) => { if(!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    zone.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if(!depth) zone.classList.remove("l2-drop-over"); });
    zone.addEventListener("drop", (e) => {
      if(!hasFiles(e)) return;
      e.preventDefault(); depth = 0; zone.classList.remove("l2-drop-over");
      feed(target, Array.from(e.dataTransfer.files || []));
    });
    if(opts.hintAfter && !opts.hintAfter.nextElementSibling?.classList?.contains("l2-paste-hint")){
      const hint = document.createElement("span");
      hint.className = "l2-paste-hint";
      hint.innerHTML = t("paste.hintOr", "или") + " <kbd>Ctrl</kbd>+<kbd>V</kbd> " + t("paste.hintDrop", "/ перетащите скрин сюда");
      opts.hintAfter.insertAdjacentElement("afterend", hint);
    }
  }

  global.L2PasteDrop = { attach };
})(window);
