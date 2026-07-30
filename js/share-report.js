// Снимок HTML-таблицы (как она сейчас отрисована, с учётом текущих фильтров) →
// строка в public.report_shares → публичная ссылка на share.html без логина.
// Колонки с кнопками действий помечены классом no-export (тот же, что и в
// старом экспорте в CSV) — исключаются и здесь по той же причине.

// Разворачивает шапку таблицы в плоский список подписей — по одной на каждую
// РЕАЛЬНУЮ колонку данных. Нужно там, где шапка не одна строка, а две (как в
// матрице «Посещаемости»: группа-неделя с colspan сверху, дни недели с
// rowspan/каждый в своей колонке снизу) — без этого колонки съезжали и Итого/%
// попадали под чужие подписи. title у ячейки (например, ISO-дата у дня недели)
// в приоритете над текстом — так подпись получается конкретнее «Пн».
function flattenHeaderColumns(table){
  const rows = Array.from(table.querySelectorAll("thead tr"));
  const grid = [];

  rows.forEach((tr, r) => {
    if(!grid[r]) grid[r] = [];
    let c = 0;
    Array.from(tr.children).forEach(th => {
      if(th.classList.contains("no-export")) return;
      while(grid[r][c] !== undefined) c++;
      const colspan = parseInt(th.getAttribute("colspan") || "1", 10);
      const rowspan = parseInt(th.getAttribute("rowspan") || "1", 10);
      const label = (th.getAttribute("title") || th.textContent || "").trim().replace(/\s+/g, " ");
      for(let dr = 0; dr < rowspan; dr++){
        if(!grid[r + dr]) grid[r + dr] = [];
        for(let dc = 0; dc < colspan; dc++) grid[r + dr][c + dc] = label;
      }
      c += colspan;
    });
  });

  const totalCols = Math.max(0, ...grid.map(row => row.length));
  const lastRow = grid.length - 1;
  const labels = [];
  for(let col = 0; col < totalCols; col++){
    let label = grid[lastRow] ? grid[lastRow][col] : undefined;
    if(label === undefined){
      for(let r = lastRow - 1; r >= 0; r--){
        if(grid[r] && grid[r][col] !== undefined){ label = grid[r][col]; break; }
      }
    }
    labels.push(label || "");
  }
  return labels;
}

async function createShareLink(db, { table, title, clanId, createdBy, nickSelector, days = 5 }){
  const labels = flattenHeaderColumns(table);
  const columns = labels.map((label, i) => ({ key: "c" + i, label }));

  // индекс ника ищем по фактическому положению ячейки .att-nick/.tax-nick в
  // ПЕРВОЙ строке шапки (она же единственная, где эта ячейка вообще есть)
  let searchColumn = null;
  if(nickSelector){
    const firstRow = table.querySelector("thead tr");
    let c = 0;
    Array.from(firstRow ? firstRow.children : []).forEach(th => {
      if(th.classList.contains("no-export")) return;
      if(th.matches(nickSelector)) searchColumn = "c" + c;
      c += parseInt(th.getAttribute("colspan") || "1", 10);
    });
  }
  if(!searchColumn && columns.length > 1) searchColumn = columns[1].key;

  const rows = [];
  table.querySelectorAll("tbody tr").forEach(tr => {
    const cells = Array.from(tr.children).filter(c => !c.classList.contains("no-export"));
    const row = {};
    cells.forEach((c, i) => { if(columns[i]) row[columns[i].key] = c.textContent.trim().replace(/\s+/g, " "); });
    rows.push(row);
  });

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("report_shares")
    .insert({ clan_id: clanId, title, columns, search_column: searchColumn, rows, created_by: createdBy, expires_at: expiresAt })
    .select("id")
    .single();
  if(error) throw error;

  const base = location.href.replace(/[^/]*$/, "");
  return base + "share.html?id=" + data.id;
}

window.L2Share = { createShareLink };
