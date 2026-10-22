// Резервная копия данных клана (Админ-панель → «Безопасность»). Работает в браузере главного админа, без установки
// программ: все таблицы клана выкачиваются через обычный API (с постраничной догрузкой L2Cabinet.selectAll — без обрезки
// на 1000 строк) и сохраняются одним файлом на компьютер.
//
// Что входит: данные ТОЛЬКО этого клана (перепись, явка, статистика, налоги, группы и блоки, буст, ДКП, привязки ников,
// настройки, профили людей без паролей). Каждая таблица берётся с фильтром по clan_id, а таблицы без своего clan_id — по
// принадлежности группе или профилю этого клана; ещё раз проверяется на месте, чужих строк в файле быть не может.
// Чего нет: логины и пароли (хранятся в закрытой части Supabase), схема базы и правила доступа (они лежат в папке
// supabase/ репозитория), временные публичные ссылки «Поделиться».
//
//   const r = await L2Backup.create(db, { clanName, compress: true, onProgress(t, i, n){} });
//   L2Backup.download(r.blob, r.filename);
//   const v = await L2Backup.verify(file);   // проверка, что файл читается и что в нём лежит
(function(global){
  "use strict";
  const FORMAT = 1;
  const CONCURRENCY = 4; // сколько таблиц выгружается одновременно (быстрее при медленной сети, нагрузка на базу всё равно небольшая)
  // [таблица, колонки для сортировки, область]:
  //  "clan"  — у строк есть clan_id: берём только строки этого клана (фильтр в запросе + повторная проверка здесь);
  //  "id"    — таблица clans: только строка своего клана;
  //  {parent, col} — нет своего clan_id, принадлежность по родителю (группа → клан, профиль → клан).
  // Общие для всей платформы справочники (roles, sections, role_sections) в копию не входят — это не данные клана.
  const GRP = { parent: "clan_groups", col: "group_id" };
  const TABLES = [
    ["clans", ["id"], "id"], ["profiles", ["id"], "clan"],
    ["clan_role_labels", ["clan_id", "role_id"], "clan"], ["clan_section_order", ["clan_id", "section_key"], "clan"], ["clan_section_toggles", ["clan_id", "section_key"], "clan"],
    ["census_entries", ["id"], "clan"],
    ["attendance_events", ["id"], "clan"], ["attendance_entries", ["id"], "clan"], ["attendance_day_visibility", ["clan_id", "day_offset"], "clan"],
    ["attendance_report_filters", ["clan_id", "filter_key"], "clan"], ["attendance_report_style", ["clan_id"], "clan"],
    ["event_stats", ["id"], "clan"], ["event_screenshot_batches", ["id"], "clan"], ["report_class_overrides", ["clan_id", "nickname_norm", "period_key"], "clan"],
    ["member_classes", ["clan_id", "nickname"], "clan"], ["nick_aliases", ["clan_id", "alias"], "clan"],
    ["clan_groups", ["id"], "clan"], ["clan_group_members", ["group_id", "nickname"], GRP], ["clan_group_sections", ["id"], GRP], ["clan_group_notes", ["group_id"], "clan"],
    ["group_label_settings", ["clan_id"], "clan"], ["roster_tag_settings", ["clan_id"], "clan"], ["roster_tagged_members", ["clan_id", "nickname"], "clan"],
    ["boost_sections", ["id"], "clan"], ["boost_items", ["id"], "clan"], ["boost_member_values", ["nickname", "item_id"], "clan"],
    ["boost_class_values", ["item_id", "class_name"], "clan"], ["boost_section_class_images", ["section_id", "class_name"], "clan"],
    ["tax_payments", ["id"], "clan"], ["tax_donations", ["id"], "clan"], ["tax_settings", ["clan_id"], "clan"], ["tax_archived_weeks", ["clan_id", "week_start"], "clan"],
    ["loot_split_settings", ["clan_id"], "clan"], ["loot_class_coefficients", ["clan_id", "class_name"], "clan"], ["loot_party_coefficients", ["clan_id", "group_id"], "clan"],
    ["loot_leader_coefficients", ["clan_id", "nickname"], "clan"], ["payout_batches", ["clan_id"], "clan"], ["payout_archive", ["id"], "clan"],
    ["cd_skills", ["id"], "clan"], ["cd_marks", ["group_id", "skill_id", "slot"], "clan"], ["cd_settings", ["clan_id"], "clan"], ["cd_skill_off", ["group_id", "skill_id"], "clan"], ["cd_skill_copies", ["group_id", "skill_id"], "clan"],
    ["skill_panels", ["profile_id"], { parent: "profiles", col: "profile_id" }], ["admin_audit_log", ["id"], "clan"],
  ];

  // Выгрузка одной таблицы только по своему клану. Если нужной колонки нет — таблица пропускается (а не берётся целиком),
  // чтобы чужие данные не попали в копию ни при каких обстоятельствах.
  async function dumpTable(db, name, order, scope, clanId, parents){
    const base = () => {
      let q = db.from(name).select("*");
      if(scope === "clan") q = q.eq("clan_id", clanId);
      else if(scope === "id") q = q.eq("id", clanId);
      else q = q.in(scope.col, parents[scope.parent] || []);
      return q;
    };
    if(typeof scope === "object" && !(parents[scope.parent] || []).length) return { data: [], error: null };
    const ordered = () => { let q = base(); order.forEach(k => { q = q.order(k); }); return q; };
    let res = await L2Cabinet.selectAll(ordered);
    // колонки сортировки может не быть — тогда без сортировки (область «только свой клан» остаётся)
    if(res.error && /column [^ ]+ does not exist/i.test(res.error.message || "") && !/clan_id|group_id|profile_id/.test(res.error.message || "")) res = await L2Cabinet.selectAll(base);
    if(res.error) return res;
    // повторная проверка: строки с чужим clan_id в копию не попадают
    let foreign = 0;
    const mine = typeof scope === "object" ? new Set(parents[scope.parent] || []) : null;
    const data = (res.data || []).filter(r => {
      if(r.clan_id != null && r.clan_id !== clanId){ foreign++; return false; }
      if(name === "clans" && r.id !== clanId){ foreign++; return false; }
      if(mine && !mine.has(r[scope.col])){ foreign++; return false; } // принадлежность через группу/профиль своего клана
      return true;
    });
    return { data, error: null, foreign };
  }

  const slug = (s) => String(s || "clan").toLowerCase().replace(/[^a-z0-9а-яёіїє]+/gi, "-").replace(/^-+|-+$/g, "") || "clan";
  const pad = (n) => String(n).padStart(2, "0");

  // выгрузка всех таблиц клана в память: { tables, skipped, rows, foreign } — общая часть копии и сравнения перед восстановлением
  async function collect(db, opts){
    if(!opts.clanId) throw new Error("no_clan");
    const tables = {}, skipped = {}, parents = {};
    let rows = 0, foreign = 0, done = 0;
    const total = TABLES.length;
    const one = async ([name, order, scope]) => {
      try{
        const res = await dumpTable(db, name, order, scope, opts.clanId, parents);
        if(res.error){ skipped[name] = res.error.message || String(res.error); }  // таблицы нет (миграция не выполнена) или нет доступа
        else {
          tables[name] = res.data || [];
          foreign += res.foreign || 0;
          rows += tables[name].length;
          if(name === "clan_groups" || name === "profiles") parents[name] = tables[name].map(r => r.id); // для таблиц без своего clan_id
        }
      }catch(e){ skipped[name] = e.message || String(e); }
      done++;
      if(opts.onProgress) opts.onProgress(name, done, total);
    };
    // сначала «родители» (профили, группы) — по ним определяется принадлежность таблиц без своего clan_id; остальные — по нескольку таблиц сразу
    const first = TABLES.filter(t => t[0] === "profiles" || t[0] === "clan_groups");
    for(const t of first) await one(t);
    const rest = TABLES.filter(t => !first.includes(t));
    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while(next < rest.length) await one(rest[next++]); }));
    // порядок таблиц — как в списке, а не в порядке завершения
    const ordered = {};
    TABLES.forEach(([name]) => { if(name in tables) ordered[name] = tables[name]; });
    return { tables: ordered, skipped, rows, foreign };
  }

  async function create(db, opts){
    opts = opts || {};
    const { tables, skipped, rows, foreign } = await collect(db, opts);
    const now = new Date();
    const meta = { app: "l2-panel", format: FORMAT, created_at: now.toISOString(), clan_name: opts.clanName || "", clan_id: opts.clanId || null,
      tables: Object.keys(tables).length, rows, scope: "clan", excluded_foreign_rows: foreign };
    const json = JSON.stringify({ meta, tables, skipped });
    let blob = new Blob([json], { type: "application/json" });
    let ext = ".json";
    if(opts.compress && global.CompressionStream){
      blob = await new Response(blob.stream().pipeThrough(new CompressionStream("gzip"))).blob();
      ext = ".json.gz";
    }
    const stamp = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + "-" + pad(now.getHours()) + pad(now.getMinutes());
    return { blob, filename: "l2-backup" + (opts.tag ? "-" + opts.tag : "") + "-" + slug(opts.clanName) + "-" + stamp + ext, meta, skipped, size: blob.size, tables: meta.tables, rows };
  }

  function download(blob, filename){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  // чтение файла копии (обычный или .gz) и проверка, что это наша копия
  async function parse(file){
    const buf = await file.arrayBuffer();
    const u8 = new Uint8Array(buf);
    let text;
    if(u8[0] === 0x1f && u8[1] === 0x8b){ // gzip
      if(!global.DecompressionStream) throw new Error("no_gzip");
      text = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    } else text = new TextDecoder().decode(u8);
    let data;
    try { data = JSON.parse(text); } catch(e){ throw new Error("bad_json"); }
    if(!data || !data.meta || data.meta.app !== "l2-panel" || typeof data.tables !== "object") throw new Error("not_backup");
    return data;
  }

  // проверка файла копии: читается ли он и сколько строк в каждой таблице
  async function verify(file){
    const data = await parse(file);
    const counts = Object.entries(data.tables).map(([name, list]) => ({ name, rows: Array.isArray(list) ? list.length : 0 }));
    return { meta: data.meta, counts, skipped: data.skipped || {} };
  }

  // ================= восстановление из копии =================
  // Ничего не удаляет. Два режима: "add" — вернуть только пропавшие строки (существующие не трогает), "overwrite" — ещё и привести
  // изменившиеся строки к виду из копии. Строки, которых в копии нет (появились позже), остаются как есть.
  // В восстановление не входят: clans и profiles (связаны с учётными записями), skill_panels (личные настройки окошка), admin_audit_log.
  const NO_RESTORE = new Set(["clans", "profiles", "skill_panels", "admin_audit_log"]);
  // родители раньше детей, иначе внешние ключи не пустят строки
  const RESTORE_ORDER = [
    "clan_section_order", "clan_section_toggles", "clan_role_labels",
    "clan_groups", "clan_group_sections", "clan_group_members", "clan_group_notes", "group_label_settings",
    "member_classes", "nick_aliases", "roster_tag_settings", "roster_tagged_members",
    "census_entries",
    "attendance_events", "event_screenshot_batches", "attendance_entries", "event_stats", "report_class_overrides",
    "attendance_day_visibility", "attendance_report_filters", "attendance_report_style",
    "boost_sections", "boost_items", "boost_member_values", "boost_class_values", "boost_section_class_images",
    "tax_payments", "tax_donations", "tax_settings", "tax_archived_weeks",
    "loot_split_settings", "loot_class_coefficients", "loot_party_coefficients", "loot_leader_coefficients", "payout_batches", "payout_archive",
    "cd_skills", "cd_skill_off", "cd_skill_copies", "cd_marks", "cd_settings",
  ];
  const USER_COLS = ["created_by", "updated_by", "archived_by", "actor_id"]; // ссылки на учётные записи: человека могли удалить

  const keyColsOf = (name, sample) => {
    const t = TABLES.find(x => x[0] === name);
    const order = t ? t[1] : ["id"];
    const cols = sample ? order.filter(k => k in sample) : order;
    return cols.length ? cols : order;
  };
  const keyOf = (cols, row) => cols.map(k => String(row[k])).join("\u0001");
  const stable = (row) => JSON.stringify(Object.keys(row).sort().map(k => [k, row[k]]));

  // сравнение копии с тем, что в базе сейчас: по каждой таблице — сколько пропало, сколько изменилось, сколько лишнего
  async function plan(db, data, opts){
    if(!data.meta.clan_id || data.meta.clan_id !== opts.clanId) throw new Error("other_clan");
    const cur = await collect(db, { clanId: opts.clanId, onProgress: opts.onProgress });
    const items = [];
    RESTORE_ORDER.forEach(name => {
      const fileRows = data.tables[name];
      if(!Array.isArray(fileRows)) return;
      const nowRows = cur.tables[name];
      const unavailable = !nowRows; // таблицы в базе нет — восстановить в неё нельзя
      const cols = keyColsOf(name, fileRows[0] || (nowRows && nowRows[0]));
      const curMap = new Map((nowRows || []).map(r => [keyOf(cols, r), stable(r)]));
      const fileKeys = new Set();
      const missing = [], differ = [];
      let same = 0;
      fileRows.forEach(r => {
        const k = keyOf(cols, r); fileKeys.add(k);
        if(!curMap.has(k)) missing.push(r);
        else if(curMap.get(k) !== stable(r)) differ.push(r);
        else same++;
      });
      let extra = 0; curMap.forEach((v, k) => { if(!fileKeys.has(k)) extra++; });
      items.push({ name, cols, file: fileRows.length, current: (nowRows || []).length, missing, differ, same, extra, unavailable });
    });
    return { items, skipped: cur.skipped };
  }

  // кусками примерно по 1.5 МБ (в части таблиц лежат картинки) и не больше 200 строк
  function chunks(rows){
    const out = []; let cur = [], size = 0;
    rows.forEach(r => {
      const n = JSON.stringify(r).length;
      if(cur.length && (size + n > 1500000 || cur.length >= 200)){ out.push(cur); cur = []; size = 0; }
      cur.push(r); size += n;
    });
    if(cur.length) out.push(cur);
    return out;
  }

  async function writeChunk(db, item, rows, mode){
    const q = () => mode === "overwrite" ? db.from(item.name).upsert(rows, { onConflict: item.cols.join(",") }) : db.from(item.name).insert(rows);
    const res = await q();
    return res.error ? res.error : null;
  }
  async function writeOne(db, item, row, mode){
    const attempt = async (r) => {
      const res = await (mode === "overwrite" ? db.from(item.name).upsert([r], { onConflict: item.cols.join(",") }) : db.from(item.name).insert([r]));
      return res.error ? res.error : null;
    };
    let err = await attempt(row);
    if(err && USER_COLS.some(k => row[k])){
      // автора строки (учётной записи) уже нет — строку возвращаем без привязки к автору, чем потерять её
      const copy = Object.assign({}, row); USER_COLS.forEach(k => { if(k in copy) copy[k] = null; });
      const err2 = await attempt(copy);
      if(!err2) return null;
    }
    return err;
  }

  // selection — Set имён таблиц; mode: "add" | "overwrite"
  async function restore(db, pl, selection, mode, onProgress){
    const results = [];
    const todo = pl.items.filter(it => selection.has(it.name) && !it.unavailable);
    for(let i = 0; i < todo.length; i++){
      const item = todo[i];
      const rows = mode === "overwrite" ? item.missing.concat(item.differ) : item.missing.slice();
      const res = { name: item.name, added: 0, updated: 0, failed: 0, errors: [] };
      if(onProgress) onProgress(item.name, i + 1, todo.length);
      const isNew = new Set(item.missing);
      for(const part of chunks(rows)){
        const err = await writeChunk(db, item, part, mode);
        if(!err){ part.forEach(r => { if(isNew.has(r)) res.added++; else res.updated++; }); continue; }
        // кусок не прошёл — пробуем по одной строке, чтобы одна плохая не тянула за собой остальные
        for(const row of part){
          const e = await writeOne(db, item, row, mode);
          if(!e){ if(isNew.has(row)) res.added++; else res.updated++; }
          else { res.failed++; if(res.errors.length < 3) res.errors.push(e.message || String(e)); }
        }
      }
      results.push(res);
    }
    return results;
  }

  global.L2Backup = { create, collect, download, parse, verify, plan, restore, TABLES, RESTORE_ORDER, NO_RESTORE };
})(window);
