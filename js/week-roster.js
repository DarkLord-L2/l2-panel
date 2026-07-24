// Общая логика понедельного списка ников — используется и «Переписью клана», и «Налогами».
// Навигация по неделям, загрузка скринов → OCR → ревью чипами → сохранение,
// удаление по одному и через мультивыбор, разворот на весь экран.
//
// Ожидает на странице элементы с фиксированными id (см. census.html / taxes.html):
// wrap, prevWeekBtn, nextWeekBtn, todayBtn, weekLabel, weekCount, addEntryBtn,
// expandBtn, trashModeBtn, bulkTools, selectAllBtn, deleteSelectedBtn, weekBody,
// emptyHint, uploadCard, fileInput, filePickBtn, uploadStatus, chipRow,
// manualNick, manualAddBtn, uploadError, saveWeekBtn, cancelUploadBtn.
// Разметку и подписи (заголовки, hint-тексты) каждая страница задаёт сама в HTML —
// этот модуль знает только то, что реально отличается (см. config ниже).

function initWeekRoster(config){
  const {
    tableName,
    profile,
    isAdmin,
    db,
    addBtnIdleLabel = "+ Добавить",
    addBtnOpenLabel = "Скрыть загрузку",
    // если задан — ник в списке становится кликабельным (крестик удаления не рисуется,
    // удаление остаётся через «Удалить списком»). Используется налогами.
    onNickClick = null,
  } = config;

  const addEntryBtn = document.getElementById("addEntryBtn");
  addEntryBtn.style.display = isAdmin ? "" : "none";
  addEntryBtn.textContent = addBtnIdleLabel;
  document.getElementById("trashModeBtn").style.display = isAdmin ? "" : "none";

  addEntryBtn.addEventListener("click", () => {
    const card = document.getElementById("uploadCard");
    const show = card.style.display === "none";
    card.style.display = show ? "" : "none";
    addEntryBtn.textContent = show ? addBtnOpenLabel : addBtnIdleLabel;
  });

  function mondayOf(d){
    const x = new Date(d);
    const day = x.getDay(); // 0=вс..6=сб
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0,0,0,0);
    return x;
  }
  function pad2(n){ return String(n).padStart(2, "0"); }
  function isoDate(d){ return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate()); }
  function weekLabel(monday){
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
    return `${pad2(monday.getDate())}.${pad2(monday.getMonth()+1)} – ${pad2(sunday.getDate())}.${pad2(sunday.getMonth()+1)}.${sunday.getFullYear()}`;
  }

  let currentWeek = mondayOf(new Date());
  let weekEntries = []; // {id, nickname}
  let pendingChips = []; // строки, ещё не сохранённые
  let selectMode = false;
  let selectedIds = new Set();

  function renderWeekLabel(){
    document.getElementById("weekLabel").textContent = weekLabel(currentWeek);
  }

  function resetUploadPreview(){
    pendingChips = [];
    document.getElementById("fileInput").value = "";
    document.getElementById("uploadStatus").textContent = "";
    document.getElementById("uploadError").textContent = "";
    renderChips();
  }

  function closeUploadCard(){
    document.getElementById("uploadCard").style.display = "none";
    addEntryBtn.textContent = addBtnIdleLabel;
  }

  function renderChips(){
    const row = document.getElementById("chipRow");
    row.innerHTML = "";
    pendingChips.forEach((nick, i) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      const span = document.createElement("span");
      span.textContent = nick;
      const btn = document.createElement("button");
      btn.textContent = "×";
      btn.addEventListener("click", () => { pendingChips.splice(i, 1); renderChips(); });
      chip.append(span, btn);
      row.appendChild(chip);
    });
  }

  async function loadWeek(){
    const { data, error } = await db
      .from(tableName)
      .select("id, nickname")
      .eq("week_start", isoDate(currentWeek))
      .order("nickname");
    if(error){ console.error(error); weekEntries = []; }
    else weekEntries = data || [];
    selectedIds = new Set();
    renderList();
  }

  const PER_COLUMN = 15; // ников в столбике, дальше начинается новый

  function renderList(){
    const body = document.getElementById("weekBody");
    body.innerHTML = "";
    document.getElementById("weekCount").textContent = weekEntries.length;
    document.getElementById("emptyHint").style.display = weekEntries.length ? "none" : "";

    let col = null; // weekEntries уже отсортированы по алфавиту самим запросом (.order("nickname"))

    weekEntries.forEach((entry, i) => {
      if(i % PER_COLUMN === 0){
        col = document.createElement("div");
        col.className = "roster-col";
        body.appendChild(col);
      }

      const chip = document.createElement("div");
      chip.className = "chip roster-chip";

      if(selectMode){
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = selectedIds.has(entry.id);
        cb.addEventListener("change", () => {
          if(cb.checked) selectedIds.add(entry.id); else selectedIds.delete(entry.id);
          updateDeleteSelectedLabel();
        });
        chip.appendChild(cb);
      }

      const span = document.createElement("span");
      span.textContent = entry.nickname;
      chip.appendChild(span);

      if(onNickClick){
        if(!selectMode){
          chip.style.cursor = "pointer";
          chip.addEventListener("click", () => onNickClick(entry.nickname));
        }
      } else if(isAdmin && !selectMode){
        const x = document.createElement("button");
        x.textContent = "×";
        x.title = "Удалить";
        x.addEventListener("click", async () => {
          const { error } = await db.from(tableName).delete().eq("id", entry.id);
          if(!error) await loadWeek();
        });
        chip.appendChild(x);
      }

      col.appendChild(chip);
    });
  }

  function updateDeleteSelectedLabel(){
    document.getElementById("deleteSelectedBtn").textContent = `Удалить выбранных (${selectedIds.size})`;
  }

  async function goToWeek(monday){
    currentWeek = monday;
    renderWeekLabel();
    resetUploadPreview();
    closeUploadCard();
    await loadWeek();
  }

  document.getElementById("prevWeekBtn").addEventListener("click", () => {
    const d = new Date(currentWeek); d.setDate(d.getDate() - 7); goToWeek(d);
  });
  document.getElementById("nextWeekBtn").addEventListener("click", () => {
    const d = new Date(currentWeek); d.setDate(d.getDate() + 7); goToWeek(d);
  });
  document.getElementById("todayBtn").addEventListener("click", () => goToWeek(mondayOf(new Date())));

  document.getElementById("expandBtn").addEventListener("click", () => {
    document.getElementById("wrap").classList.toggle("expanded");
  });

  document.getElementById("trashModeBtn").addEventListener("click", () => {
    selectMode = !selectMode;
    selectedIds = new Set();
    document.getElementById("bulkTools").style.display = selectMode ? "" : "none";
    updateDeleteSelectedLabel();
    renderList();
  });

  document.getElementById("selectAllBtn").addEventListener("click", () => {
    selectedIds = new Set(weekEntries.map(e => e.id));
    updateDeleteSelectedLabel();
    renderList();
  });

  document.getElementById("deleteSelectedBtn").addEventListener("click", async () => {
    if(!selectedIds.size) return;
    if(!confirm(`Удалить выбранных: ${selectedIds.size}?`)) return;
    const { error } = await db.from(tableName).delete().in("id", Array.from(selectedIds));
    if(!error){
      selectMode = false;
      document.getElementById("bulkTools").style.display = "none";
      await loadWeek();
    }
  });

  // ---- загрузка и OCR ----
  function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  document.getElementById("filePickBtn").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  document.getElementById("fileInput").addEventListener("change", async () => {
    let files = Array.from(document.getElementById("fileInput").files);
    const statusEl = document.getElementById("uploadStatus");
    const errEl = document.getElementById("uploadError");
    errEl.textContent = "";
    if(!files.length) return;
    if(files.length > 9){
      files = files.slice(0, 9);
      statusEl.textContent = "Взяты только первые 9 файлов.";
    }

    for(let i = 0; i < files.length; i++){
      statusEl.textContent = `Распознаю скрин ${i + 1} из ${files.length}…`;
      try{
        const dataUrl = await fileToDataUrl(files[i]);
        const nicknames = await L2Cabinet.adminOcrNicknames(dataUrl);
        nicknames.forEach(n => {
          if(n && !pendingChips.includes(n)) pendingChips.push(n);
        });
        renderChips();
      }catch(err){
        errEl.textContent = `Скрин ${i + 1}: ${err.message}`;
      }
    }
    statusEl.textContent = `Готово, распознано ${pendingChips.length} ник(ов) — проверьте перед сохранением.`;
  });

  document.getElementById("manualAddBtn").addEventListener("click", () => {
    const input = document.getElementById("manualNick");
    const val = input.value.trim();
    if(val && !pendingChips.includes(val)) pendingChips.push(val);
    input.value = "";
    renderChips();
  });
  document.getElementById("manualNick").addEventListener("keydown", (e) => {
    if(e.key === "Enter"){ e.preventDefault(); document.getElementById("manualAddBtn").click(); }
  });

  document.getElementById("cancelUploadBtn").addEventListener("click", () => {
    resetUploadPreview();
    closeUploadCard();
  });

  document.getElementById("saveWeekBtn").addEventListener("click", async () => {
    const errEl = document.getElementById("uploadError");
    errEl.textContent = "";
    const existing = new Set(weekEntries.map(e => e.nickname));
    const toInsert = pendingChips.filter(n => !existing.has(n));
    if(!toInsert.length){
      resetUploadPreview();
      closeUploadCard();
      return;
    }
    const rows = toInsert.map(nickname => ({
      clan_id: profile.clan_id,
      week_start: isoDate(currentWeek),
      nickname,
      created_by: profile.id,
    }));
    const { error } = await db.from(tableName).insert(rows);
    if(error){ errEl.textContent = "Не удалось сохранить: " + error.message; return; }
    resetUploadPreview();
    closeUploadCard();
    await loadWeek();
  });

  renderWeekLabel();
  loadWeek();

  return {
    getCurrentWeek: () => currentWeek,
    reloadWeek: loadWeek,
  };
}

window.initWeekRoster = initWeekRoster;
