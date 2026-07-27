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

function initEventRoster({ root, eventId, profile, isAdmin, db }){
  root.innerHTML = `
    <div class="chip-row" data-role="list"></div>
    <p class="empty-hint" data-role="empty" style="display:none;">Явка ещё не отмечена.</p>
    ${isAdmin ? '<button class="btn" data-role="add-btn" style="margin-top:8px;">+ Добавить явку</button>' : ""}
    ${isAdmin ? `
    <div data-role="upload" style="display:none; margin-top:10px;">
      <input type="file" data-role="file-input" accept="image/*" multiple style="display:none;" />
      <button class="btn" data-role="file-btn">Выбрать файлы…</button>
      <p class="upload-status" data-role="status"></p>
      <div class="chip-row" data-role="chips"></div>
      <div class="manual-add">
        <input type="text" data-role="manual-input" placeholder="Добавить ник вручную" />
        <button class="btn" data-role="manual-btn">Добавить</button>
      </div>
      <p class="error-msg" data-role="error"></p>
      <div style="display:flex; gap:10px; margin-top:8px;">
        <button class="btn btn-primary" data-role="save-btn">Сохранить</button>
        <button class="btn btn-ghost" data-role="cancel-btn">Отмена</button>
      </div>
    </div>` : ""}
  `;

  const q = (role) => root.querySelector(`[data-role="${role}"]`);

  let entries = [];
  let pending = [];
  let pendingStats = new Map(); // nickname -> {kills, deaths, pvp_damage, pve_damage}, из тех же скринов

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
        x.title = "Убрать из явки";
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

    q("file-input").addEventListener("change", async () => {
      let files = Array.from(q("file-input").files);
      const statusEl = q("status");
      const errEl = q("error");
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
          const rows = await L2Cabinet.adminOcrEventStats(dataUrl);
          rows.forEach(r => {
            if(!r.nickname) return;
            if(!pending.includes(r.nickname)) pending.push(r.nickname);
            pendingStats.set(r.nickname, {
              kills: r.kills, deaths: r.deaths,
              pvp_damage: r.pvp_damage, pve_damage: r.pve_damage,
            });
          });
          renderChips();
        }catch(err){
          errEl.textContent = `Скрин ${i + 1}: ${err.message}`;
        }
      }
      statusEl.textContent = `Готово, распознано ${pending.length} ник(ов) со статистикой — проверьте перед сохранением.`;
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
        if(error){ errEl.textContent = "Не удалось сохранить: " + error.message; return; }
      }

      // те же ники, для которых скрин дал цифры — сразу в event_stats, без
      // отдельного шага в «Отчётах»; повторная загрузка скрина с поправленными
      // цифрами просто перезапишет старые значения (upsert по event_id+nickname)
      if(pendingStats.size){
        const statRows = pending
          .filter(n => pendingStats.has(n))
          .map(n => {
            const s = pendingStats.get(n);
            return {
              clan_id: profile.clan_id,
              event_id: eventId,
              nickname: n,
              kills: s.kills,
              deaths: s.deaths,
              pvp_damage: s.pvp_damage,
              pve_damage: s.pve_damage,
              removed: false, // если ник раньше был помечен «удалён» — новое распознавание снимает пометку
              created_by: profile.id,
              updated_at: new Date().toISOString(),
            };
          });
        const { error: statsErr } = await db.from("event_stats").upsert(statRows, { onConflict: "event_id,nickname" });
        if(statsErr){ errEl.textContent = "Явка сохранена, но статистика — нет: " + statsErr.message; return; }
      }

      resetUpload();
      q("upload").style.display = "none";
      await load();
    });
  }

  load();
}

window.initEventRoster = initEventRoster;
