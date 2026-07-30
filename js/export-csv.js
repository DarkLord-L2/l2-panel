// Экспорт любой HTML-таблицы (как она сейчас отрисована на экране, со всеми
// текущими фильтрами/сортировкой) в CSV, который Excel открывает как обычную
// таблицу. Разделитель — ";", а не "," — Excel с русской локалью по умолчанию
// делит CSV именно по нему, а не по запятой (та зарезервирована под десятичные
// дроби). BOM в начале — чтобы кириллица не превращалась в кракозябры при
// открытии двойным кликом, без ручного выбора кодировки при импорте.
function exportTableToCsv(table, filename){
  if(!table) return;
  const lines = [];
  table.querySelectorAll("tr").forEach(tr => {
    // колонки-кнопки (⋮, «Удалить» и т.п.) помечены в вёрстке классом no-export —
    // иначе в файл попал бы текст самой кнопки вместо реальных данных
    const cells = Array.from(tr.children)
      .filter(cell => !cell.classList.contains("no-export"))
      .map(cell => {
        let text = cell.textContent.trim().replace(/\s+/g, " ");
        if(/[";\n]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
        return text;
      });
    lines.push(cells.join(";"));
  });

  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : filename + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

window.L2Export = { exportTableToCsv };
