// Мини-ростер явки на одно мероприятие (используется «Журналом посещаемости»).
// В отличие от js/week-roster.js — не синглтон на страницу: работает в границах
// переданного root-элемента, поэтому на одной странице можно создать сколько
// угодно копий (по одной на мероприятие). Строит свою разметку сам — вызывающему
// коду достаточно передать пустой контейнер.
//
// Те же скрины, что отмечают явку, заодно читаются на боевую статистику (килы/
// смерти/PvP/PvE урон — L2Cabinet.adminOcrEventStats) и при сохранении явки
// автоматически попадают в event_stats. Отдельного шага «добавить статистику»
// в «Отчётах по мероприятиям» больше нет — эта страница лишь показывает то,
// что уже посчиталось здесь.
//
// Распознавание профессии по иконке пробовали (два прохода через Gemini, потом
// локальное пиксельное сравнение с эталонами) и в итоге убрали целиком — ник и
// цифры модель читает надёжно, а иконку (маленькая, 36 похожих вариантов) не
// удалось распознавать стабильно ни одним из способов. Профессия участника
// по-прежнему видна в «Группах»/«Проверке буста» (member_classes) — просто не
// автоматизирована по скрину явки.

// ---- сверка распознанного OCR-ника со списком реальных ников клана (перепись) ----
// точное/нормализованное совпадение уже спасает от похожих букв (0/O, кириллица/
// латиница — CYR_LOOKALIKES) и регистра; но иногда Gemini теряет/путает целую
// букву («Лунтик» → «Луник») — такое нормализация не ловит, нужно нечёткое
// сравнение (расстояние Левенштейна) с самым близким известным ником
const CYR_LOOKALIKES = { "а":"a","в":"b","е":"e","к":"k","м":"m","н":"h","о":"o","р":"p","с":"c","т":"t","у":"y","х":"x","ё":"e","0":"o","l":"i" };
function normalizeNick(s){
  return String(s || "")
    .toLowerCase()
    .split("").map(ch => CYR_LOOKALIKES[ch] || ch).join("")
    .replace(/[^a-zа-яё0-9]/gi, "");
}
function levenshtein(a, b){
  const m = a.length, n = b.length;
  if(!m) return n;
  if(!n) return m;
  const row = new Array(n + 1);
  for(let j = 0; j <= n; j++) row[j] = j;
  for(let i = 1; i <= m; i++){
    let prev = row[0];
    row[0] = i;
    for(let j = 1; j <= n; j++){
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}
// чем короче ник, тем рискованнее угадывать буквами — совсем коротким (≤4)
// доверяем только точному/нормализованному совпадению, длинным разрешаем
// побольше «слабины»
function maxAllowedDistance(len){
  if(len <= 4) return 0;
  if(len <= 7) return 1;
  return 2;
}

// список ников из переписи — за всё время (не только последняя неделя), чтобы не
// упустить того, кто просто выпал из самой свежей переписи, но реально на скрине.
// Один запрос на всю страницу, а не на каждый день/мероприятие — кэшируется тут же
let knownNicksPromise = null;
function loadKnownNicks(db){
  if(!knownNicksPromise){
    knownNicksPromise = db.from("census_entries").select("nickname")
      .then(({ data }) => [...new Set((data || []).map(r => r.nickname))]);
  }
  return knownNicksPromise;
}

// возвращает исправленный ник, если нашлось уверенное совпадение с переписью,
// иначе — исходный OCR-текст без изменений (админ увидит и поправит вручную)
function resolveNickname(raw, knownNicks){
  if(!raw || !knownNicks || !knownNicks.length) return raw;
  if(knownNicks.includes(raw)) return raw; // уже точь-в-точь как в переписи
  const rawNorm = normalizeNick(raw);
  const exact = knownNicks.find(k => normalizeNick(k) === rawNorm);
  if(exact) return exact;

  const limit = maxAllowedDistance(rawNorm.length);
  if(limit === 0) return raw;
  let best = null, bestDist = Infinity, tie = false;
  knownNicks.forEach(k => {
    const d = levenshtein(rawNorm, normalizeNick(k));
    if(d < bestDist){ bestDist = d; best = k; tie = false; }
    else if(d === bestDist) tie = true; // два одинаково близких ника — не угадываем
  });
  return (best && !tie && bestDist <= limit) ? best : raw;
}

function initEventRoster({ root, eventId, profile, isAdmin, db }){
  root.innerHTML = `
    <div class="chip-row" data-role="list"></div>
    <p class="empty-hint" data-role="empty" style="display:none;">${L2I18n.t("eventRoster.notMarkedHint", "Явка ещё не отмечена.")}</p>
    ${isAdmin ? `<button class="btn" data-role="add-btn" style="margin-top:8px;">${L2I18n.t("eventRoster.addAttendanceBtn", "+ Добавить явку")}</button>` : ""}
    ${isAdmin ? `
    <div data-role="upload" style="display:none; margin-top:10px;">
      <input type="file" data-role="file-input" accept="image/*" multiple style="display:none;" />
      <button class="btn" data-role="file-btn">${L2I18n.t("eventRoster.pickFilesBtn", "Выбрать файлы…")}</button>
      <p class="upload-status" data-role="status"></p>
      <div class="chip-row" data-role="chips"></div>
      <div class="manual-add">
        <input type="text" data-role="manual-input" placeholder="${L2I18n.t("eventRoster.manualPlaceholder", "Добавить ник вручную")}" />
        <button class="btn" data-role="manual-btn">${L2I18n.t("common.add", "Добавить")}</button>
      </div>
      <p class="error-msg" data-role="error"></p>
      <div style="display:flex; gap:10px; margin-top:8px;">
        <button class="btn btn-primary" data-role="save-btn">${L2I18n.t("common.save", "Сохранить")}</button>
        <button class="btn btn-ghost" data-role="cancel-btn">${L2I18n.t("common.cancel", "Отмена")}</button>
      </div>
    </div>` : ""}
  `;

  const q = (role) => root.querySelector(`[data-role="${role}"]`);

  // язык может смениться, пока этот блок явки уже отрисован (переключатель живёт
  // в родительском окне) — точечно обновляем статичные подписи, не перестраивая
  // разметку целиком (иначе слетели бы уже навешанные обработчики)
  function applyLangRefresh(){
    q("empty").textContent = L2I18n.t("eventRoster.notMarkedHint", "Явка ещё не отмечена.");
    if(isAdmin){
      q("add-btn").textContent = L2I18n.t("eventRoster.addAttendanceBtn", "+ Добавить явку");
      q("file-btn").textContent = L2I18n.t("eventRoster.pickFilesBtn", "Выбрать файлы…");
      q("manual-input").placeholder = L2I18n.t("eventRoster.manualPlaceholder", "Добавить ник вручную");
      q("manual-btn").textContent = L2I18n.t("common.add", "Добавить");
      q("save-btn").textContent = L2I18n.t("common.save", "Сохранить");
      q("cancel-btn").textContent = L2I18n.t("common.cancel", "Отмена");
    }
    render();
    if(isAdmin) renderChips();
  }
  // root живёт только пока открыто окно этого дня — после закрытия дальше не
  // трогаем (иначе за сессию накопились бы «зомби»-обработчики на старых блоках)
  window.addEventListener("storage", (e) => {
    if(e.key !== "l2Lang") return;
    if(!document.body.contains(root)) return;
    applyLangRefresh();
  });

  let entries = [];
  let pending = [];
  let pendingStats = new Map(); // nickname -> {kills, deaths, pvp_damage, pve_damage}, из тех же скринов
  let pendingBatchOf = new Map(); // nickname -> индекс скрина (в этой сессии загрузки), с которого он распознан
  let batchCount = 0; // сколько скринов в этой сессии дали хотя бы одного распознанного ника
  // индекс скрина -> ник его пати-лидера (для «Раздачи») — распознаётся OCR из
  // подписи «Лидер: …» над таблицей (ocr-event-stats возвращает её отдельно от
  // строк). На скринах статы отсортированы по урону/килам, поэтому лидер НЕ всегда
  // первая строка — раньше так считали и получали не того лидера. Если подписи на
  // скрине не было (старый тип скрина без неё) или OCR её не распознал —
  // откатываемся на прежнее допущение «первая строка».
  let batchLeaderOf = new Map();

  async function load(){
    const { data, error } = await db
      .from("attendance_entries")
      .select("id, nickname")
      .eq("event_id", eventId)
      .order("nickname");
    entries = error ? [] : (data || []);
    render();
  }

  function render(){
    const list = q("list");
    list.innerHTML = "";
    q("empty").style.display = entries.length ? "none" : "";
    entries.forEach(entry => {
      const chip = document.createElement("div");
      chip.className = "chip roster-chip";
      const span = document.createElement("span");
      span.textContent = entry.nickname;
      chip.appendChild(span);
      if(isAdmin){
        const x = document.createElement("button");
        x.textContent = "×";
        x.title = L2I18n.t("eventRoster.removeFromAttendanceTitle", "Убрать из явки");
        x.addEventListener("click", async () => {
          // явку убираем, а статистику не стираем — только помечаем removed=true,
          // чтобы килы/смерти не терялись из истории; в «Отчётах» такая строка
          // помечается и уходит в самый низ, а не пропадает молча
          await db.from("event_stats").update({ removed: true, updated_at: new Date().toISOString() })
            .eq("event_id", eventId).eq("nickname", entry.nickname);
          const { error } = await db.from("attendance_entries").delete().eq("id", entry.id);
          if(!error) await load();
        });
        chip.appendChild(x);
      }
      list.appendChild(chip);
    });
  }

  if(isAdmin){
    function renderChips(){
      const row = q("chips");
      row.innerHTML = "";
      pending.forEach((nick, i) => {
        const chip = document.createElement("div");
        chip.className = "chip";
        const span = document.createElement("span");
        span.textContent = nick;
        const btn = document.createElement("button");
        btn.textContent = "×";
        btn.addEventListener("click", () => { pending.splice(i, 1); renderChips(); });
        chip.append(span, btn);
        row.appendChild(chip);
      });
    }

    function resetUpload(){
      pending = [];
      pendingStats = new Map();
      pendingBatchOf = new Map();
      batchCount = 0;
      batchLeaderOf = new Map();
      q("file-input").value = "";
      q("status").textContent = "";
      q("error").textContent = "";
      renderChips();
    }

    q("add-btn").addEventListener("click", () => {
      const up = q("upload");
      up.style.display = up.style.display === "none" ? "" : "none";
    });

    q("file-btn").addEventListener("click", () => q("file-input").click());

    function fileToDataUrl(file){
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // Апскейлим скрин в 2x (с потолком по стороне, чтобы запрос не разросся
    // безгранично) перед распознаванием — мелкому тексту (ники, цифры)
    // достаётся больше пикселей, читается надёжнее.
    function upscaleForOcr(dataUrl, scale = 2, maxSide = 2600){
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width * scale, h = img.height * scale;
          if(Math.max(w, h) > maxSide){
            const shrink = maxSide / Math.max(w, h);
            w *= shrink; h *= shrink;
          }
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(w); canvas.height = Math.round(h);
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    }

    q("file-input").addEventListener("change", async () => {
      let files = Array.from(q("file-input").files);
      const statusEl = q("status");
      const errEl = q("error");
      errEl.textContent = "";
      if(!files.length) return;
      if(files.length > 9){
        files = files.slice(0, 9);
        statusEl.textContent = L2I18n.t("eventRoster.onlyFirst9Files", "Взяты только первые 9 файлов.");
      }
      for(let i = 0; i < files.length; i++){
        statusEl.textContent = L2I18n.t("eventRoster.recognizingScreen", "Распознаю скрин {i} из {n}…").replace("{i}", i + 1).replace("{n}", files.length);
        try{
          const rawDataUrl = await fileToDataUrl(files[i]);
          const dataUrl = await upscaleForOcr(rawDataUrl);
          const { stats: ocrRows, leader: ocrLeader } = await L2Cabinet.adminOcrEventStats(dataUrl);
          const rows = ocrRows.filter(r => r.nickname);

          // сверяем каждый распознанный ник со списком реальных ников клана —
          // точное/нормализованное совпадение чинит регистр и похожие буквы,
          // нечёткое (Левенштейн) — редкие случаи потерянной/перепутанной буквы
          // целиком («Лунтик» → «Луник»); при неуверенности ник не трогаем —
          // админ всё равно видит все чипы перед сохранением и может поправить
          const knownNicks = await loadKnownNicks(db);
          rows.forEach(r => { r.nickname = resolveNickname(r.nickname, knownNicks); });

          // индекс скрина заводим лениво, только если он реально дал хоть одного ника —
          // «Отчёт по мероприятиям» использует эти индексы, чтобы группировать строки
          // по скрину (пати) и подписывать блок именем группы клана или «Соло»
          const bIdx = rows.length ? batchCount++ : null;

          rows.forEach(r => {
            if(!pending.includes(r.nickname)) pending.push(r.nickname);
            pendingStats.set(r.nickname, {
              kills: r.kills, deaths: r.deaths,
              pvp_damage: r.pvp_damage, pve_damage: r.pve_damage,
            });
            pendingBatchOf.set(r.nickname, bIdx);
          });
          if(bIdx != null && !batchLeaderOf.has(bIdx)){
            const leaderMatch = ocrLeader && rows.find(r =>
              r.nickname === ocrLeader || r.nickname.trim().toLowerCase() === ocrLeader.trim().toLowerCase()
            );
            batchLeaderOf.set(bIdx, (leaderMatch || rows[0]).nickname);
          }
          renderChips();
        }catch(err){
          errEl.textContent = L2I18n.t("eventRoster.screenError", "Скрин {i}: {msg}").replace("{i}", i + 1).replace("{msg}", err.message);
        }
      }
      statusEl.textContent = L2I18n.t("eventRoster.doneRecognized", "Готово, распознано {n} ник(ов) со статистикой — проверьте перед сохранением.").replace("{n}", pending.length);
    });

    q("manual-btn").addEventListener("click", () => {
      const input = q("manual-input");
      const val = input.value.trim();
      if(val && !pending.includes(val)) pending.push(val);
      input.value = "";
      renderChips();
    });
    q("manual-input").addEventListener("keydown", (e) => {
      if(e.key === "Enter"){ e.preventDefault(); q("manual-btn").click(); }
    });

    q("cancel-btn").addEventListener("click", () => {
      resetUpload();
      q("upload").style.display = "none";
    });

    q("save-btn").addEventListener("click", async () => {
      const errEl = q("error");
      errEl.textContent = "";
      const existing = new Set(entries.map(e => e.nickname));
      const toInsert = pending.filter(n => !existing.has(n));
      if(toInsert.length){
        const rows = toInsert.map(nickname => ({
          clan_id: profile.clan_id,
          event_id: eventId,
          nickname,
          created_by: profile.id,
        }));
        const { error } = await db.from("attendance_entries").insert(rows);
        if(error){ errEl.textContent = L2I18n.t("eventRoster.saveFailed", "Не удалось сохранить: ") + error.message; return; }
      }

      // те же ники, для которых скрин дал цифры — сразу в event_stats, без
      // отдельного шага в «Отчётах»; повторная загрузка скрина с поправленными
      // цифрами просто перезапишет старые значения (upsert по event_id+nickname)
      if(pendingStats.size){
        // по одной записи-«скрину» на каждый batchCount — последовательно, не массовым
        // insert, чтобы не полагаться на порядок строк ответа: скринов максимум 9,
        // действие админское и нечастое, разница в цене не имеет значения
        const batchIds = [];
        for(let bi = 0; bi < batchCount; bi++){
          const { data: batchRow, error: batchErr } = await db
            .from("event_screenshot_batches")
            .insert({ clan_id: profile.clan_id, event_id: eventId, created_by: profile.id })
            .select("id").single();
          if(batchErr){ errEl.textContent = L2I18n.t("eventRoster.batchSaveFailed", "Не удалось сохранить метку скрина: ") + batchErr.message; return; }
          batchIds.push(batchRow.id);
        }

        const statRows = pending
          .filter(n => pendingStats.has(n))
          .map(n => {
            const s = pendingStats.get(n);
            const bIdx = pendingBatchOf.get(n);
            return {
              clan_id: profile.clan_id,
              event_id: eventId,
              nickname: n,
              kills: s.kills,
              deaths: s.deaths,
              pvp_damage: s.pvp_damage,
              pve_damage: s.pve_damage,
              batch_id: (bIdx != null) ? batchIds[bIdx] : null,
              is_party_leader: bIdx != null && batchLeaderOf.get(bIdx) === n,
              removed: false, // если ник раньше был помечен «удалён» — новое распознавание снимает пометку
              created_by: profile.id,
              updated_at: new Date().toISOString(),
            };
          });

        const { error: statsErr } = await db.from("event_stats").upsert(statRows, { onConflict: "event_id,nickname" });
        if(statsErr){ errEl.textContent = L2I18n.t("eventRoster.statsSaveFailed", "Явка сохранена, но статистика — нет: ") + statsErr.message; return; }
      }

      resetUpload();
      q("upload").style.display = "none";
      await load();
    });
  }

  load();
}

window.initEventRoster = initEventRoster;
