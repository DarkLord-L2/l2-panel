// Горячие клавиши внутри разделов (страница открыта в iframe оболочки index.html):
//   Ctrl+K (⌘K)  — быстрый поиск игрока/раздела (окно живёт в оболочке, L2Nav.openSearch);
//   ← / →        — листание (недели, даты): страница объявляет window.L2PageKeys(key),
//                  которая возвращает true, если клавишу обработала.
// Пока курсор в поле ввода или открыто окно (.modal-overlay.show) — стрелки не трогаем.
// Плюс «страница догрузилась»: window.L2PageReady = true, когда первые запросы к базе
// закончились (нет запросов в полёте 250 мс) — оболочка до этого держит заглушки
// загрузки, а не показывает пустые таблицы. Подключать ДО js/supabase-client.js:
// клиент базы запоминает window.fetch при создании.
(function(){
  var inflight = 0, last = Date.now(), started = Date.now(), done = false;
  window.L2PageReady = false;
  var origFetch = window.fetch;
  if(origFetch){
    window.fetch = function(){
      inflight++; last = Date.now();
      return origFetch.apply(this, arguments).finally(function(){ inflight--; last = Date.now(); });
    };
  }
  (function tick(){
    if(done) return;
    var now = Date.now();
    if((inflight === 0 && now - last > 250 && now - started > 400) || now - started > 5000){ done = true; window.L2PageReady = true; return; }
    setTimeout(tick, 80);
  })();
})();

(function(){
  function typing(t){ return !!(t && t.closest && t.closest('input, select, textarea, [contenteditable="true"]')); }
  document.addEventListener("keydown", function(e){
    if((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === "KeyK"){
      var nav = window.top && window.top.L2Nav;
      if(nav && nav.openSearch){ e.preventDefault(); nav.openSearch(); }
      return;
    }
    if(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || typing(e.target)) return;
    if((e.key === "ArrowLeft" || e.key === "ArrowRight") && typeof window.L2PageKeys === "function"){
      if(document.querySelector(".modal-overlay.show")) return;
      if(window.L2PageKeys(e.key)) e.preventDefault();
    }
  });
})();
