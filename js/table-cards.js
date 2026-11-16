// Таблица → карточки на телефоне (≤640px). На компьютере таблица остаётся таблицей.
//   L2TableCards.watch(tableEl)
// Каждой ячейке тела подписывается data-label = текст заголовка её колонки (из последней
// строки <thead>) — CSS в theme.css (table.l2-cards) на узком экране показывает строку
// карточкой: первая ячейка (ник) — шапкой, остальные — «подпись: значение».
// Таблицу страница перестраивает сама (сортировка, пересчёт) — подписи обновляются
// по MutationObserver. Колонки без текста в заголовке (иконка-день) берут title/alt.
(function(global){
  function headLabels(table){
    const row = table.tHead && table.tHead.rows[table.tHead.rows.length - 1];
    if(!row) return [];
    const out = [];
    [...row.cells].forEach(th => {
      let txt = th.getAttribute("data-card-label") || th.textContent.replace(/[▲▼⇅↑↓]/g, "").replace(/\s+/g, " ").trim();
      if(!txt){ const img = th.querySelector("img[alt], [title]"); txt = (img && (img.getAttribute("alt") || img.getAttribute("title"))) || th.getAttribute("title") || ""; }
      // мелкие колонки (дни ивентов в ДКП) — в карточке компактной сеткой, а не по две в ряд
      const compact = th.hasAttribute("data-card-compact") || th.classList.contains("ls-col-day");
      for(let k = 0; k < (th.colSpan || 1); k++) out.push({ txt, compact });
    });
    return out;
  }
  function label(table){
    const labels = headLabels(table);
    [...table.tBodies].forEach(tb => [...tb.rows].forEach(tr => {
      let i = 0;
      [...tr.cells].forEach(td => {
        const l = labels[i] || { txt: "", compact: false };
        if(td.getAttribute("data-label") !== l.txt) td.setAttribute("data-label", l.txt);
        td.classList.toggle("l2-card-compact", l.compact);
        i += td.colSpan || 1;
      });
    }));
  }
  function watch(table){
    if(!table || table.dataset.l2cards) return;
    table.dataset.l2cards = "1";
    table.classList.add("l2-cards");
    label(table);
    let pending = false;
    new MutationObserver(() => {
      if(pending) return; pending = true;
      requestAnimationFrame(() => { pending = false; label(table); });
    }).observe(table, { childList: true, subtree: true });
  }
  global.L2TableCards = { watch };
  // таблицы с атрибутом data-cards в разметке подключаются сами
  document.querySelectorAll("table[data-cards]").forEach(watch);
})(window);
