// Поля ввода денег с пробелами между тысячами: 100000000000 → «100 000 000 000» прямо во время набора.
//
// <input type="number"> показывать пробелы не умеет, поэтому поле превращается в текстовое с цифровой клавиатурой,
// а свойство `value` у него подменено: чтение отдаёт обычное число без пробелов («100000000000») — весь остальной
// код страницы (Number(input.value), сохранение в базу, расчёты) работает как раньше; запись `input.value = 5000`
// сама показывает «5 000». Отметить поле: <input data-money> (целые) или <input data-money="decimal"> (с копейками).
(function(global){
  "use strict";
  const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

  // оставляем только цифры (и одну точку, если разрешены дробные); запятую принимаем как точку
  function clean(s, decimal){
    s = String(s == null ? "" : s).replace(/[\s  ]/g, "").replace(",", ".");
    let out = "", dot = false;
    for(const ch of s){
      if(ch >= "0" && ch <= "9") out += ch;
      else if(ch === "." && decimal && !dot){ out += "."; dot = true; }
    }
    return out;
  }
  function group(int){ return int.replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function format(raw){
    if(raw.indexOf(".") >= 0){
      const parts = raw.split(".");
      return group(parts[0]) + "." + (parts[1] || "");
    }
    return group(raw);
  }

  function attach(input){
    if(input.__l2num) return;
    input.__l2num = true;
    const decimal = input.getAttribute("data-money") === "decimal";
    // начальное значение из атрибута (value="0") — тоже через форматирование
    const initial = clean(desc.get.call(input), decimal);
    input.type = "text";
    input.setAttribute("inputmode", decimal ? "decimal" : "numeric");
    input.setAttribute("autocomplete", "off");
    Object.defineProperty(input, "value", {
      configurable: true,
      get(){ return clean(desc.get.call(this), decimal); },
      set(v){ desc.set.call(this, format(clean(v, decimal))); },
    });
    desc.set.call(input, format(initial));

    input.addEventListener("input", () => {
      const shown = desc.get.call(input);
      const caret = input.selectionStart == null ? shown.length : input.selectionStart;
      const meaningfulBefore = clean(shown.slice(0, caret), decimal).length; // цифры слева от курсора
      const formatted = format(clean(shown, decimal));
      if(formatted === shown) return;
      desc.set.call(input, formatted);
      // курсор остаётся после того же количества цифр, а не прыгает в конец
      let pos = 0, seen = 0;
      while(pos < formatted.length && seen < meaningfulBefore){ if(formatted[pos] !== " ") seen++; pos++; }
      try { input.setSelectionRange(pos, pos); } catch(e){}
    });
  }

  function attachAll(root){
    (root || document).querySelectorAll("input[data-money]").forEach(attach);
  }
  global.L2Num = { attach, attachAll, clean, format };
  attachAll();
  document.addEventListener("DOMContentLoaded", () => attachAll());
})(window);
