// Распознавание профессий по иконкам на скрине «Состав группы» (Журнал посещаемости). Всё считается в браузере,
// без нейросети: иконку вырезаем из скрина и сравниваем с эталонами из assets/classes (window.L2_CLASSES).
//
// Как это работает (проверено на 5 реальных скринах, 44 иконки — все верно):
//  1. колонку иконок и строки находим сами: иконки — самые «цветные» пятна таблицы, строки идут с шагом ≈ 18 px;
//  2. иконка на скрине 16×16 px, эталон приводим к 16×16 (срезав рамку по краям);
//  3. сходство — корреляция «без яркости и контраста» (вычитаем общее среднее, но НЕ по каналам — цвет иконки важен),
//     с поиском сдвига ±1 px; побеждает эталон с наибольшим сходством;
//  4. «уверенность»: сходство ≥ 0.45 и отрыв от второго места ≥ 0.15. Иначе иконку надо подтвердить глазами —
//     так сделано для похожих Shillien Saint / Eva's Saint.
// Защита от сдвига строк: число найденных иконок должно совпасть с числом ников, распознанных на том же скрине,
// иначе профессии для этого скрина не определяются вовсе (лучше пусто, чем чужая профессия у человека).
//
//   const r = await L2ClassIcons.analyze(dataUrl, nicknameCount);
//   r.ok / r.reason / r.rows[i] = { className, score, margin, needsCheck, top: [{name, score}], crop: dataUrl }
(function(global){
  "use strict";
  const S = 16;              // размер иконки на скрине
  const MIN_SCORE = 0.45, MIN_MARGIN = 0.15;

  function loadImage(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image_load_failed"));
      img.src = src;
    });
  }
  function canvasOf(w, h){
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  // вектор без общей яркости (скалярное среднее по всем каналам сразу) и единичной длины
  function normVec(rgba){
    const n = S * S, v = new Float32Array(n * 3);
    let sum = 0;
    for(let i = 0; i < n; i++){ v[i * 3] = rgba[i * 4]; v[i * 3 + 1] = rgba[i * 4 + 1]; v[i * 3 + 2] = rgba[i * 4 + 2]; sum += v[i * 3] + v[i * 3 + 1] + v[i * 3 + 2]; }
    const mean = sum / (n * 3);
    let len = 0;
    for(let i = 0; i < v.length; i++){ v[i] -= mean; len += v[i] * v[i]; }
    len = Math.sqrt(len) || 1;
    for(let i = 0; i < v.length; i++) v[i] /= len;
    return v;
  }
  const dot = (a, b) => { let s = 0; for(let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

  let refsPromise = null;
  function loadRefs(){
    if(refsPromise) return refsPromise;
    refsPromise = Promise.all((global.L2_CLASSES || []).map(async (c) => {
      const img = await loadImage(c.icon);
      const w = img.width, h = img.height, cut = 3; // рамка по краям эталона
      const cv = canvasOf(S, S), ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, cut, cut, w - 2 * cut, h - 2 * cut, 0, 0, S, S);
      return { name: c.name, icon: c.icon, vec: normVec(ctx.getImageData(0, 0, S, S).data) };
    })).catch(e => { refsPromise = null; throw e; });
    return refsPromise;
  }

  // «цветная» маска: насыщенные яркие пиксели (иконки; текст в таблице белый/серый)
  function colorMask(data, W, H){
    const m = new Uint8Array(W * H);
    for(let i = 0; i < W * H; i++){
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      m[i] = (mx > 70 && (mx - mn) / mx > 0.35) ? 1 : 0;
    }
    return m;
  }

  // колонка иконок (x) и сетка строк (top, pitch) по цветной маске
  function findGrid(mask, W, H, rows){
    const y0 = Math.floor(H * 0.30), xMax = Math.floor(W * 0.7);
    const colproj = new Float32Array(xMax);
    for(let y = y0; y < H; y++) for(let x = 0; x < xMax; x++) colproj[x] += mask[y * W + x];
    let bestX = 0, bestSum = -1;
    for(let x = 0; x + S <= xMax; x++){
      let s = 0; for(let k = 0; k < S; k++) s += colproj[x + k];
      if(s > bestSum){ bestSum = s; bestX = x; }
    }
    const rowproj = new Float32Array(H);
    for(let y = 0; y < H; y++){ let s = 0; for(let k = 0; k < S; k++) s += mask[y * W + bestX + k]; rowproj[y] = s; }
    const sm = new Float32Array(H); // скользящая сумма по окну S (центр в y)
    for(let y = 0; y < H; y++){ let s = 0; for(let k = -S / 2; k < S / 2; k++){ const yy = y + k; if(yy >= 0 && yy < H) s += rowproj[yy]; } sm[y] = s; }
    const n = Math.max(1, Math.min(9, rows || 9));
    let best = { total: -1, top: 0, pitch: 18 };
    for(let pitch = 17.5; pitch <= 19.0001; pitch += 0.05){
      for(let top = Math.floor(H * 0.28); top < Math.floor(H * 0.5); top++){
        let tot = 0;
        for(let i = 0; i < n; i++){
          const yc = Math.round(top + i * pitch + S / 2);
          if(yc >= H) break;
          tot += sm[yc];
        }
        if(tot > best.total) best = { total: tot, top, pitch };
      }
    }
    return { x: bestX, top: best.top, pitch: best.pitch, total: best.total, colSum: bestSum };
  }

  // «фактурность» окна: у иконки яркость заметно меняется, у пустого тёмного фона — нет
  function textured(data, W, x, y){
    let s = 0, s2 = 0;
    for(let j = 0; j < S; j++) for(let i = 0; i < S; i++){
      const p = ((y + j) * W + (x + i)) * 4;
      const l = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      s += l; s2 += l * l;
    }
    const n = S * S, mean = s / n;
    return Math.sqrt(Math.max(0, s2 / n - mean * mean));
  }

  function windowRGBA(data, W, x, y){
    const out = new Uint8ClampedArray(S * S * 4);
    for(let j = 0; j < S; j++) for(let i = 0; i < S; i++){
      const p = ((y + j) * W + (x + i)) * 4, o = (j * S + i) * 4;
      out[o] = data[p]; out[o + 1] = data[p + 1]; out[o + 2] = data[p + 2]; out[o + 3] = 255;
    }
    return out;
  }

  function cropDataUrl(rgba, scale){
    const cv = canvasOf(S, S), ctx = cv.getContext("2d");
    ctx.putImageData(new ImageData(rgba, S, S), 0, 0);
    const big = canvasOf(S * scale, S * scale), bctx = big.getContext("2d");
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(cv, 0, 0, S * scale, S * scale);
    return big.toDataURL("image/png");
  }

  async function analyze(dataUrl, expectedRows){
    const refs = await loadRefs();
    const img = await loadImage(dataUrl);
    const W = img.width, H = img.height;
    if(W < 150 || H < 100) return { ok: false, reason: "small", rows: [] };
    const cv = canvasOf(W, H), ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    const mask = colorMask(data, W, H);
    const grid = findGrid(mask, W, H, expectedRows);
    // колонка не нашлась (на скрине нет таблицы с иконками)
    if(grid.colSum < 40) return { ok: false, reason: "no_table", rows: [] };

    // сколько строк с иконками подряд сверху — должно совпасть с числом ников
    let found = 0;
    for(let i = 0; i < 9; i++){
      const y = Math.round(grid.top + i * grid.pitch);
      if(y + S > H) break;
      if(textured(data, W, grid.x, y) >= 14) found++; else break;
    }
    if(expectedRows != null && found !== expectedRows) return { ok: false, reason: "count_mismatch", found, expected: expectedRows, rows: [] };

    const rows = [];
    for(let i = 0; i < found; i++){
      const y0 = Math.round(grid.top + i * grid.pitch);
      let best = null;
      for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
        const x = grid.x + dx, y = y0 + dy;
        if(x < 0 || y < 0 || x + S > W || y + S > H) continue;
        const rgba = windowRGBA(data, W, x, y), v = normVec(rgba);
        const scores = refs.map(r => ({ name: r.name, score: dot(v, r.vec) })).sort((a, b) => b.score - a.score);
        if(!best || scores[0].score > best.scores[0].score) best = { scores, rgba };
      }
      const top = best.scores.slice(0, 4);
      const margin = top[0].score - top[1].score;
      rows.push({
        className: top[0].name, score: top[0].score, margin,
        needsCheck: top[0].score < MIN_SCORE || margin < MIN_MARGIN,
        top, crop: cropDataUrl(best.rgba, 4),
      });
    }
    return { ok: true, rows, grid: { x: grid.x, top: grid.top, pitch: grid.pitch } };
  }

  global.L2ClassIcons = { analyze, loadRefs, MIN_SCORE, MIN_MARGIN };
})(window);
