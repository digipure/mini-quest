// ============================================================
// Mini-Quest - Lógica principal y UI
// ============================================================
"use strict";

const Game = (() => {
  const T = DATA.TILE;
  const COLS = DATA.GRID_COLS, ROWS = DATA.GRID_ROWS;
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const key = (x, y) => x + "," + y;
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  let G = null; // estado de la partida

  // =========================================================
  // Utilidades de estado
  // =========================================================
  function cell(x, y) { return G.dungeon.grid[y][x]; }
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
  function walkableCell(x, y) {
    if (!inBounds(x, y)) return false;
    const t = cell(x, y).t;
    return t === "corridor" || t === "room" || t === "exit";
  }
  function chestAt(x, y) {
    return G.dungeon.chests.find(c => !c.opened && c.x === x && c.y === y) || null;
  }
  function monsterAt(x, y) {
    return G.dungeon.monsters.find(m => m.hp > 0 && m.x === x && m.y === y) || null;
  }
  function playerAt(x, y) {
    return G.players.find(p => p.x === x && p.y === y) || null;
  }
  function passable(x, y) { // se puede atravesar al mover
    return walkableCell(x, y) && !chestAt(x, y) && !monsterAt(x, y);
  }
  function adjMonsters(p) {
    return DIRS4.map(([dx, dy]) => monsterAt(p.x + dx, p.y + dy))
      .filter(m => m && m.active);
  }
  function adjChests(x, y) {
    return DIRS4.map(([dx, dy]) => inBounds(x + dx, y + dy) ? chestAt(x + dx, y + dy) : null)
      .filter(Boolean);
  }
  function adjWounded(p) {
    return DIRS4.map(([dx, dy]) => playerAt(p.x + dx, p.y + dy))
      .filter(q => q && q.wounded);
  }

  // =========================================================
  // Revelado (niebla de guerra)
  // =========================================================
  function revealTile(x, y) {
    const k = key(x, y);
    if (G.revealed.has(k)) return;
    G.revealed.add(k);
    const el = G.tileEls[y][x];
    if (el) el.classList.remove("unrevealed");
    // activar monstruo si lo hay
    const m = G.dungeon.monsters.find(m => m.hp > 0 && m.x === x && m.y === y);
    if (m && !m.active) { m.active = true; updateTokens(); }
    // muros vecinos visibles (marco)
    if (cell(x, y).t !== "wall") {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (inBounds(nx, ny) && cell(nx, ny).t === "wall") {
          const kk = key(nx, ny);
          if (!G.revealed.has(kk)) {
            G.revealed.add(kk);
            G.tileEls[ny][nx].classList.remove("unrevealed");
          }
        }
      }
    }
  }

  function revealRoom(roomId) {
    const room = G.dungeon.rooms[roomId];
    if (room.revealed) return;
    room.revealed = true;
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++)
        revealTile(x, y);
  }

  function revealFrom(x, y) {
    const c = cell(x, y);
    if (c.t === "room" || c.t === "exit") { revealRoom(c.room); return; }
    // pasillo: línea recta en las 4 direcciones
    revealTile(x, y);
    for (const [dx, dy] of DIRS4) {
      let nx = x + dx, ny = y + dy;
      while (inBounds(nx, ny) && cell(nx, ny).t === "corridor") {
        revealTile(nx, ny);
        nx += dx; ny += dy;
      }
    }
  }

  // Casilla "frontera": aún no revelada, transitable y colindante con una
  // casilla revelada. Son las aberturas negras que abren zonas nuevas.
  function isFrontier(x, y) {
    if (!inBounds(x, y) || G.revealed.has(key(x, y)) || !walkableCell(x, y)) return false;
    return DIRS4.some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return inBounds(nx, ny) && G.revealed.has(key(nx, ny)) && walkableCell(nx, ny);
    });
  }

  // Coloca marcadores "!" intermitentes sobre las casillas frontera.
  function updateFrontier() {
    const layer = $("tokens");
    layer.querySelectorAll(".frontier-marker").forEach(e => e.remove());
    if (!G || G.phase === "over") return;
    const seen = new Set();
    for (const rk of G.revealed) {
      const [rx, ry] = rk.split(",").map(Number);
      if (!walkableCell(rx, ry)) continue;
      for (const [dx, dy] of DIRS4) {
        const nx = rx + dx, ny = ry + dy, k = key(nx, ny);
        if (seen.has(k) || !isFrontier(nx, ny)) continue;
        seen.add(k);
        const el = document.createElement("div");
        el.className = "frontier-marker";
        el.dataset.k = k;
        el.style.left = nx * T + "px";
        el.style.top = ny * T + "px";
        el.textContent = "!";
        layer.appendChild(el);
      }
    }
  }

  // =========================================================
  // Construcción del tablero (DOM)
  // =========================================================
  function buildBoard() {
    const board = $("board");
    board.innerHTML = "";
    board.style.width = COLS * T + "px";
    board.style.height = ROWS * T + "px";
    G.tileEls = [];
    for (let y = 0; y < ROWS; y++) {
      G.tileEls.push([]);
      for (let x = 0; x < COLS; x++) {
        const c = cell(x, y);
        const div = document.createElement("div");
        div.className = "tile unrevealed";
        div.style.left = x * T + "px";
        div.style.top = y * T + "px";
        div.dataset.x = x; div.dataset.y = y;
        let img;
        if (c.t === "wall") img = "tile_wall";
        else if (c.t === "corridor") img = "tile_corridor";
        else if (c.t === "exit") img = "tile_exit";
        else img = "tile_room" + G.dungeon.rooms[c.room].styleIdx;
        div.style.backgroundImage = `url(img/${img}.png)`;
        board.appendChild(div);
        G.tileEls[y].push(div);
      }
    }
    updateTokens();
  }

  function updateTokens() {
    const layer = $("tokens");
    // crear/actualizar fichas de jugadores, monstruos activos y cofres
    const wanted = new Map();
    // cofres sin abrir y revelados (debajo de personajes/monstruos)
    for (const c of G.dungeon.chests)
      if (!c.opened && G.revealed.has(key(c.x, c.y)))
        wanted.set("chest_" + c.x + "_" + c.y, { img: "chest", x: c.x, y: c.y });
    for (const p of G.players)
      wanted.set("p" + p.idx, { img: "token_" + p.classId, x: p.x, y: p.y, wounded: p.wounded, active: G.turnIdx === p.idx && G.phase === "players" });
    for (const m of G.dungeon.monsters)
      if (m.hp > 0 && m.active && G.revealed.has(key(m.x, m.y)))
        wanted.set(m.uid, { img: "token_" + m.type, x: m.x, y: m.y });

    // eliminar solo las fichas (con uid) que ya no procedan; conserva
    // marcadores de frontera y de destino
    for (const el of Array.from(layer.children))
      if (el.dataset.uid && !wanted.has(el.dataset.uid)) el.remove();

    for (const [uid, w] of wanted) {
      let el = layer.querySelector(`[data-uid="${uid}"]`);
      if (!el) {
        el = document.createElement("img");
        el.className = "token";
        el.dataset.uid = uid;
        el.src = "img/" + w.img + ".png";
        layer.appendChild(el);
      }
      el.style.left = w.x * T + "px";
      el.style.top = w.y * T + "px";
      el.classList.toggle("wounded", !!w.wounded);
      el.classList.toggle("active-turn", !!w.active);
    }
    updateFrontier();
  }

  // =========================================================
  // Cámara: pan, pinch-zoom y auto-encuadre por fase
  // =========================================================
  const CAM = { scale: 1, tx: 0, ty: 0 };
  const ZOOM_MAX = 2.0;

  function viewport() { const v = $("viewport"); return { w: v.clientWidth, h: v.clientHeight }; }
  function fitScale() { const { w, h } = viewport(); return Math.min(w / (COLS * T), h / (ROWS * T)); }
  function clampScale(s) { return Math.max(fitScale(), Math.min(ZOOM_MAX, s)); }
  function turnScale() { return Math.max(fitScale(), Math.min(1.0, ZOOM_MAX)); }

  function clampPan() {
    const { w, h } = viewport();
    const bw = COLS * T * CAM.scale, bh = ROWS * T * CAM.scale;
    CAM.tx = bw <= w ? (w - bw) / 2 : Math.max(w - bw, Math.min(0, CAM.tx));
    CAM.ty = bh <= h ? (h - bh) / 2 : Math.max(h - bh, Math.min(0, CAM.ty));
  }

  function camApply(instant) {
    clampPan();
    const cam = $("camera");
    cam.style.transition = instant ? "none" : "transform 0.55s ease";
    cam.style.transform = `translate(${CAM.tx}px, ${CAM.ty}px) scale(${CAM.scale})`;
  }

  // centra un punto del tablero (px de tablero); si scale es null conserva el zoom
  function camCenterOn(px, py, scale, instant) {
    if (scale != null) CAM.scale = clampScale(scale);
    const { w, h } = viewport();
    CAM.tx = w / 2 - px * CAM.scale;
    CAM.ty = h / 2 - py * CAM.scale;
    camApply(instant);
  }

  // sigue una casilla sin cambiar el nivel de zoom (animaciones de movimiento)
  function focusTile(x, y, instant = false) {
    camCenterOn(x * T + T / 2, y * T + T / 2, null, instant);
  }

  // encuadra una caja de casillas + margen (en casillas)
  function camFitBounds(minx, miny, maxx, maxy, margin, instant) {
    const { w, h } = viewport();
    const scale = clampScale(Math.min(
      w / ((maxx - minx + 1 + margin * 2) * T),
      h / ((maxy - miny + 1 + margin * 2) * T)));
    camCenterOn((minx + maxx + 1) / 2 * T, (miny + maxy + 1) / 2 * T, scale, instant);
  }

  function combatRoom() {
    const f = G.combatFocus || currentPlayer();
    const c = cell(f.x, f.y);
    return c && (c.t === "room" || c.t === "exit") ? G.dungeon.rooms[c.room] : null;
  }

  // Auto-encuadre según la fase; transición suave salvo instant=true
  function autoZoom(mode, instant = false) {
    if (mode) G.zoomMode = mode;
    const p = currentPlayer();
    if (G.zoomMode === "move" && G.moveMap) {
      let minx = p.x, miny = p.y, maxx = p.x, maxy = p.y;
      for (const [, n] of G.moveMap) {
        minx = Math.min(minx, n.x); miny = Math.min(miny, n.y);
        maxx = Math.max(maxx, n.x); maxy = Math.max(maxy, n.y);
      }
      camFitBounds(minx, miny, maxx, maxy, 1, instant);          // todas las casillas + 1 extra
    } else if (G.zoomMode === "combat" && combatRoom()) {
      const r = combatRoom();
      camFitBounds(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1, 1, instant); // sala + 1 bloque de margen
    } else {
      camCenterOn(p.x * T + T / 2, p.y * T + T / 2, turnScale(), instant); // resto: zoom por defecto
    }
  }

  // ---- gestos: pinch-zoom + arrastre del tablero + tap sobre casilla ----
  const pointers = new Map();
  let pinch = null;
  let multiTouch = false;   // true mientras dure un gesto con 2+ dedos (no cuenta como tap)

  function tileFromClient(cx, cy) {
    const r = $("viewport").getBoundingClientRect();
    const bx = (cx - r.left - CAM.tx) / CAM.scale, by = (cy - r.top - CAM.ty) / CAM.scale;
    const tx = Math.floor(bx / T), ty = Math.floor(by / T);
    return (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) ? null : { x: tx, y: ty };
  }

  function handleTap(cx, cy) {
    if (G.confirming) return;
    const t = tileFromClient(cx, cy);
    if (!t) return;
    if (G.targetCb) { G.targetCb(t.x, t.y); return; }
    if (G.moveMap) onMoveTileTap(t.x, t.y);
  }

  function camInitGestures() {
    const vp = $("viewport");
    vp.addEventListener("pointerdown", (e) => {
      if (e.target.closest("#confirm-bar, #btn-autozoom")) return; // no capturar la UI
      vp.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
      if (pointers.size >= 2) { multiTouch = true; startPinch(); }
    });
    vp.addEventListener("pointermove", (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 2 && pinch) { updatePinch(); return; }
      if (pointers.size === 1) {
        if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) p.moved = true;
        if (p.moved) { CAM.tx += dx; CAM.ty += dy; camApply(true); }
      }
    });
    const up = (e) => {
      const p = pointers.get(e.pointerId);
      if (p && pointers.size === 1 && !p.moved && !multiTouch && e.type === "pointerup")
        handleTap(e.clientX, e.clientY);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) multiTouch = false;
    };
    vp.addEventListener("pointerup", up);
    vp.addEventListener("pointercancel", up);
  }

  function startPinch() {
    const [a, b] = [...pointers.values()];
    const r = $("viewport").getBoundingClientRect();
    const midX = (a.x + b.x) / 2 - r.left, midY = (a.y + b.y) / 2 - r.top;
    pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y), scale: CAM.scale,
      bpx: (midX - CAM.tx) / CAM.scale, bpy: (midY - CAM.ty) / CAM.scale
    };
  }
  function updatePinch() {
    const [a, b] = [...pointers.values()];
    const r = $("viewport").getBoundingClientRect();
    const midX = (a.x + b.x) / 2 - r.left, midY = (a.y + b.y) / 2 - r.top;
    CAM.scale = clampScale(pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist);
    CAM.tx = midX - pinch.bpx * CAM.scale;   // mantiene el punto bajo los dedos
    CAM.ty = midY - pinch.bpy * CAM.scale;
    camApply(true);
  }

  // =========================================================
  // Overlays genéricos
  // =========================================================
  function showMessage(html, btnText) {
    return new Promise(res => {
      $("msg-text").innerHTML = html;
      const btns = $("msg-buttons");
      btns.innerHTML = "";
      const b = document.createElement("button");
      b.className = "btn primary"; b.textContent = btnText || I18N.t("ok");
      b.onclick = () => { $("msg-overlay").classList.add("hidden"); res(); };
      btns.appendChild(b);
      $("msg-overlay").classList.remove("hidden");
    });
  }

  function showConfirm(html, yes, no) {
    return new Promise(res => {
      yes = yes || I18N.t("yes");
      no = no || I18N.t("no");
      $("msg-text").innerHTML = html;
      const btns = $("msg-buttons");
      btns.innerHTML = "";
      for (const [txt, val, cls] of [[yes, true, "primary"], [no, false, ""]]) {
        const b = document.createElement("button");
        b.className = "btn " + cls; b.textContent = txt;
        b.onclick = () => { $("msg-overlay").classList.add("hidden"); res(val); };
        btns.appendChild(b);
      }
      $("msg-overlay").classList.remove("hidden");
    });
  }

  function showChoice(html, options) { // options: [{label, value}]
    return new Promise(res => {
      $("msg-text").innerHTML = html;
      const btns = $("msg-buttons");
      btns.innerHTML = "";
      options.forEach((o, i) => {
        const b = document.createElement("button");
        b.className = "btn" + (i === 0 ? " primary" : "");
        b.textContent = o.label;
        b.onclick = () => { $("msg-overlay").classList.add("hidden"); res(o.value); };
        btns.appendChild(b);
      });
      $("msg-overlay").classList.remove("hidden");
    });
  }

  // ---- Combate con retratos + VS + vida visibles en todo momento ----
  function combatantOf(kind, ref) {
    if (kind === "player")
      return { portrait: I18N.portrait(ref.classId), name: ref.nombre, hp: ref.hp, maxHp: ref.maxHp };
    return { portrait: I18N.portrait(ref.type), name: I18N.name(ref.type), hp: ref.hp, maxHp: DATA.MONSTERS[ref.type].hp };
  }

  function setHpBar(side, hp, maxHp) {
    const pct = Math.max(0, Math.min(100, Math.round(hp / maxHp * 100)));
    const fill = $("combat-" + side + "-hp"), txt = $("combat-" + side + "-hptext");
    fill.style.width = pct + "%";
    fill.style.background = pct <= 33 ? "linear-gradient(#e06c6c,#a83a3a)"
      : pct <= 66 ? "linear-gradient(#e0c86c,#a8903a)" : "linear-gradient(#6ce06c,#3aa83a)";
    txt.textContent = Math.max(0, hp) + " / " + maxHp;
  }

  function combatShowUI(att, def) {
    $("combat-att-img").src = "img/" + att.portrait + ".png";
    $("combat-def-img").src = "img/" + def.portrait + ".png";
    $("combat-att-name").textContent = att.name;
    $("combat-def-name").textContent = def.name;
    setHpBar("att", att.hp, att.maxHp);
    setHpBar("def", def.hp, def.maxHp);
    $("combat-att-side").classList.remove("lunge-r");
    const badge = $("combat-badge"); badge.classList.remove("show"); badge.textContent = "";
    $("combat-def-img").classList.remove("hit-shake");
    $("combat-dice").innerHTML = "";
    $("combat-hint").textContent = "";
    $("combat-result").textContent = "";
    $("combat-roll").classList.add("hidden");
    $("combat-continue").classList.add("hidden");
    $("combat-overlay").classList.remove("hidden");
  }

  function combatDiceRoll(dados, auto) {
    return new Promise(resolve => {
      const box = $("combat-dice"); box.innerHTML = "";
      const dice = [];
      for (let i = 0; i < dados; i++) { const d = Dice.buildDie("attack"); box.appendChild(d); dice.push(d); }
      const rollBtn = $("combat-roll"), hint = $("combat-hint");
      const go = () => {
        rollBtn.classList.add("hidden"); hint.textContent = "";
        Dice.rollDice(dice, "attack").then(res => resolve(res.filter(r => r === "skull").length));
      };
      if (auto) { rollBtn.classList.add("hidden"); hint.textContent = ""; setTimeout(go, 600); }
      else {
        hint.textContent = I18N.t("diceRollHint");
        rollBtn.textContent = I18N.t("diceRoll");
        rollBtn.classList.remove("hidden");
        rollBtn.onclick = go;
      }
    });
  }

  // Embestida del atacante -> colisión (círculo rojo sobre el dañado) -> vuelta.
  async function combatHit(dmg, defHpAfter, defMaxHp) {
    const attSide = $("combat-att-side"), defImg = $("combat-def-img"), badge = $("combat-badge");
    attSide.classList.add("lunge-r");
    await sleep(200);
    badge.textContent = dmg;
    badge.classList.add("show");
    defImg.classList.add("hit-shake");
    setHpBar("def", defHpAfter, defMaxHp);
    await sleep(150);
    attSide.classList.remove("lunge-r");
    await sleep(330);
    defImg.classList.remove("hit-shake");
  }

  function combatWait(auto) {
    return new Promise(res => {
      const c = $("combat-continue");
      c.textContent = I18N.t("continueBtn");
      c.classList.remove("hidden");
      c.onclick = () => res();
      if (auto) setTimeout(() => { if (!c.classList.contains("hidden")) res(); }, 1500);
    });
  }

  // Secuencia completa. Con `dados` tira; con `fixed` aplica daño fijo (hechizos).
  async function runCombat({ att, def, dados, fixed, auto, resultLabel }) {
    combatShowUI(att, def);
    let dmg;
    if (dados) dmg = await combatDiceRoll(dados, auto);
    else { await sleep(500); dmg = fixed; }
    $("combat-result").textContent = resultLabel(dmg);
    if (dmg > 0) await combatHit(dmg, def.hp - dmg, def.maxHp);
    await combatWait(auto);
    $("combat-overlay").classList.add("hidden");
    return dmg;
  }

  function floatText(x, y, text, cls = "") {
    const el = document.createElement("div");
    el.className = "float-text " + cls;
    el.textContent = text;
    el.style.left = x * T + T / 2 + "px";
    el.style.top = y * T + "px";
    $("tokens").appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // =========================================================
  // HUD y acciones
  // =========================================================
  function currentPlayer() { return G.players[G.turnIdx]; }

  function updateHud() {
    const p = currentPlayer();
    if (!p) return;
    $("hud-portrait").src = "img/token_" + p.classId + ".png";
    $("hud-name").textContent = p.nombre;
    $("hud-hp").textContent = "❤️ " + p.hp + "/" + p.maxHp;
    $("hud-gold").textContent = "💰 " + p.oro;
    const box = $("hud-items");
    box.innerHTML = "";
    const addIcon = (img, count) => {
      const w = document.createElement("span");
      w.className = "hud-item";
      w.innerHTML = `<img src="img/${img}.png">` + (count != null ? `<b>${count}</b>` : "");
      box.appendChild(w);
    };
    for (const it of p.items)
      addIcon(it.tipo === "pocion" ? "item_pocion" : (it.dmg === 1 ? "item_pergamino" : "item_pergamino2"));
    for (const h of p.hechizos)
      if (h.usos > 0) addIcon(h.tipo === "bola" ? "item_bola" : "item_cura", h.usos);
  }

  function itemIcon(tipo, dmg) {
    if (tipo === "pocion") return "item_pocion";
    return dmg === 1 ? "item_pergamino" : "item_pergamino2";
  }

  // Menú de acciones: panel flotante (NO oscurece el tablero) con el retrato
  // del personaje activo en la cabecera; se puede arrastrar por la pantalla.
  function showActionMenu(buttons) {
    setInlineActions([]);              // limpia la barra inferior
    $("confirm-bar").classList.add("hidden");
    const p = currentPlayer();
    $("action-portrait").src = "img/" + I18N.portrait(p.classId) + ".png";
    $("action-title").textContent = p.nombre;
    const box = $("action-buttons");
    box.innerHTML = "";
    for (const b of buttons) {
      const el = document.createElement("button");
      el.className = "btn action" + (b.primary ? " primary" : "");
      el.textContent = b.label;
      el.onclick = () => { hideActionMenu(); b.cb(); };
      box.appendChild(el);
    }
    $("action-popup").classList.remove("hidden");
    positionMenu();
  }

  function hideActionMenu() { $("action-popup").classList.add("hidden"); }

  // coloca el panel (posición recordada o por defecto: centrado-inferior)
  function positionMenu() {
    const card = $("action-card");
    if (G && G.menuPos) {
      card.style.left = G.menuPos.left + "px";
      card.style.top = G.menuPos.top + "px";
      return;
    }
    const cw = card.offsetWidth || 300, ch = card.offsetHeight || 260;
    card.style.left = Math.max(8, (window.innerWidth - cw) / 2) + "px";
    card.style.top = Math.max(60, window.innerHeight * 0.52 - ch / 2) + "px";
  }

  // arrastre del panel sujetando la cabecera
  function initMenuDrag() {
    const header = $("action-header"), card = $("action-card");
    let start = null;
    header.addEventListener("pointerdown", (e) => {
      header.setPointerCapture(e.pointerId);
      const r = card.getBoundingClientRect();
      start = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      header.style.cursor = "grabbing";
    });
    header.addEventListener("pointermove", (e) => {
      if (!start) return;
      let left = Math.max(4, Math.min(window.innerWidth - card.offsetWidth - 4, e.clientX - start.dx));
      let top = Math.max(4, Math.min(window.innerHeight - card.offsetHeight - 4, e.clientY - start.dy));
      card.style.left = left + "px"; card.style.top = top + "px";
      G.menuPos = { left, top };
    });
    const end = () => { start = null; header.style.cursor = "grab"; };
    header.addEventListener("pointerup", end);
    header.addEventListener("pointercancel", end);
  }

  // Controles en línea (barra inferior) que NO oscurecen el tablero: se usan
  // cuando el jugador está interactuando con el tablero (elegir casilla/objetivo).
  function setInlineActions(buttons) {
    hideActionMenu();
    const bar = $("actions");
    bar.innerHTML = "";
    for (const b of buttons) {
      const el = document.createElement("button");
      el.className = "btn action" + (b.primary ? " primary" : "");
      el.textContent = b.label;
      el.onclick = b.cb;
      bar.appendChild(el);
    }
  }

  // Barra de confirmación anclada arriba/abajo, sin oscurecer el tablero, para
  // que el jugador siga viendo la zona de movimiento. Si se pasa `dest`, la
  // barra se ancla en el lado opuesto a la casilla destino.
  function tileScreenY(y) {
    return CAM.ty + (y * T + T / 2) * CAM.scale;   // posición real en pantalla
  }

  function showConfirmBar(html, yes, no, dest) {
    yes = yes || I18N.t("yes");
    no = no || I18N.t("no");
    return new Promise(res => {
      const bar = $("confirm-bar");
      $("confirm-text").innerHTML = html;
      const bb = $("confirm-buttons");
      bb.innerHTML = "";
      for (const [txt, val, cls] of [[yes, true, "primary"], [no, false, ""]]) {
        const b = document.createElement("button");
        b.className = "btn " + cls;
        b.textContent = txt;
        b.onclick = () => { bar.classList.add("hidden"); G.confirming = false; res(val); };
        bb.appendChild(b);
      }
      const top = dest ? tileScreenY(dest.y) > viewport().h * 0.5 : false;
      bar.classList.toggle("top", top);
      bar.classList.toggle("bottom", !top);
      G.confirming = true;
      bar.classList.remove("hidden");
    });
  }

  // Círculo animado sobre la casilla destino que se está confirmando.
  function showDestMarker(x, y) {
    clearDestMarker();
    const el = document.createElement("div");
    el.className = "dest-marker";
    el.id = "dest-marker";
    el.style.left = x * T + "px";
    el.style.top = y * T + "px";
    $("tokens").appendChild(el);
  }
  function clearDestMarker() {
    const el = $("dest-marker");
    if (el) el.remove();
  }

  // =========================================================
  // Movimiento
  // =========================================================
  function reachable(px, py, steps) {
    // BFS: devuelve mapa key->{dist, from}
    const res = new Map();
    res.set(key(px, py), { dist: 0, from: null, x: px, y: py });
    const q = [{ x: px, y: py, dist: 0 }];
    while (q.length) {
      const n = q.shift();
      if (n.dist >= steps) continue;
      for (const [dx, dy] of DIRS4) {
        const nx = n.x + dx, ny = n.y + dy, k = key(nx, ny);
        if (res.has(k) || !walkableCell(nx, ny)) continue;
        if (G.revealed.has(k)) {
          // casilla revelada: se puede atravesar (si no hay cofre/monstruo)
          if (!passable(nx, ny)) continue;
          res.set(k, { dist: n.dist + 1, from: key(n.x, n.y), x: nx, y: ny });
          q.push({ x: nx, y: ny, dist: n.dist + 1 });
        } else if (isFrontier(nx, ny)) {
          // casilla frontera (negra): destino válido que abre la zona, pero
          // no se puede atravesar (lo desconocido queda más allá).
          // Si hay un cofre o monstruo dormido encima, no se puede pisar:
          // se marca `blocked` y el jugador se queda en la casilla anterior,
          // desde donde la zona se abre igualmente.
          res.set(k, {
            dist: n.dist + 1, from: key(n.x, n.y), x: nx, y: ny,
            frontier: true, blocked: !passable(nx, ny)
          });
        }
      }
    }
    return res;
  }

  function pathTo(res, k) {
    const path = [];
    let cur = res.get(k);
    while (cur && cur.from) {
      path.unshift({ x: cur.x, y: cur.y });
      cur = res.get(cur.from);
    }
    return path;
  }

  function clearHighlights() {
    document.querySelectorAll(".tile.highlight, .tile.path, .tile.target")
      .forEach(el => el.classList.remove("highlight", "path", "target"));
    document.querySelectorAll(".frontier-marker.reach")
      .forEach(el => el.classList.remove("reach"));
    G.moveMap = null;
    G.targetCb = null;
  }

  async function onMoveTileTap(x, y) {
    const k = key(x, y);
    const node = G.moveMap.get(k);
    if (!node || node.dist === 0 || playerAt(x, y)) return;
    // marcar camino, círculo de destino y pedir confirmación (sin oscurecer)
    document.querySelectorAll(".tile.path").forEach(el => el.classList.remove("path"));
    let path = pathTo(G.moveMap, k);
    if (node.blocked) path = path.slice(0, -1); // no se puede pisar: te quedas delante
    for (const s of path) G.tileEls[s.y][s.x].classList.add("path");
    showDestMarker(x, y);
    setInlineActions([]); // oculta "Parar aquí" mientras se confirma
    const ok = await showConfirmBar(I18N.t("moveHere"), I18N.t("yes"), I18N.t("no"), { x, y });
    clearDestMarker();
    if (!ok) {
      document.querySelectorAll(".tile.path").forEach(el => el.classList.remove("path"));
      // restaura el control para seguir eligiendo destino
      setInlineActions([{ label: I18N.t("stopHereBtn", { n: G.moveLeft }), cb: finishMove }]);
      return;
    }
    clearHighlights();
    G.moveLeft -= path.length;
    await animateMove(currentPlayer(), path);
    if (node.blocked) {
      // casilla negra ocupada: se abre la zona desde la casilla de delante
      revealFrom(x, y);
      updateTokens();
      await promptChests(currentPlayer());
    }
    // si quedan pasos, puede elegir un nuevo destino (p. ej. zona recién revelada)
    if (G.moveLeft > 0) showMoveOptions();
    else finishMove();
  }

  async function animateMove(p, path) {
    for (const step of path) {
      p.x = step.x; p.y = step.y;
      revealFrom(p.x, p.y);   // pisar una casilla frontera abre su zona
      updateTokens();
      focusTile(p.x, p.y);
      await sleep(220);
      // victoria al pisar la salida
      if (cell(p.x, p.y).t === "exit") { await victory(); return; }
      // cofres al pasar por delante
      await promptChests(p);
      // primeros auxilios al pasar al lado de un herido
      await promptFirstAid(p);
    }
    updateHud();
  }

  async function promptChests(p) {
    for (const chest of adjChests(p.x, p.y)) {
      if (G.promptedChests.has(chest)) continue;
      G.promptedChests.add(chest); // si dice que no, queda el botón "Abrir cofre"
      showDestMarker(chest.x, chest.y);
      const ok = await showConfirmBar(I18N.t("chestPrompt"), I18N.t("openBtn"), I18N.t("leaveBtn"), { x: chest.x, y: chest.y });
      clearDestMarker();
      if (ok) await openChest(p, chest);
    }
  }

  async function openChest(p, chest) {
    chest.opened = true;
    updateTokens(); // la ficha del cofre desaparece
    const loot = chest.loot;
    let img, msg;
    if (loot.tipo === "oro") {
      p.oro += loot.cantidad;
      img = "item_oro";
      msg = I18N.t("lootGoldMsg", { n: loot.cantidad });
      floatText(chest.x, chest.y, "+" + loot.cantidad + " 💰", "gold");
    } else if (loot.tipo === "pocion") {
      p.items.push({ tipo: "pocion" });
      img = "item_pocion";
      msg = I18N.t("lootPotionMsg");
    } else {
      p.items.push({ tipo: "pergamino", dmg: loot.dmg });
      img = loot.dmg === 1 ? "item_pergamino" : "item_pergamino2";
      msg = I18N.t("lootScrollMsg", { n: loot.dmg });
    }
    updateHud();
    // popup con la imagen del contenido, descripción y botón de cierre
    await showMessage(`<img class="loot-img" src="img/${img}.png"><br>${msg}`, I18N.t("lootClose"));
  }

  function itemLabel(it) {
    if (it.tipo === "pocion") return I18N.t("potion");
    return it.dmg === 1 ? I18N.t("scroll") : I18N.t("scrollPlus");
  }

  async function promptFirstAid(p) {
    for (const q of adjWounded(p)) {
      showDestMarker(q.x, q.y);
      const ok = await showConfirmBar(I18N.t("woundedPrompt", { name: q.nombre }),
        I18N.t("healBtn"), I18N.t("notNowBtn"), { x: q.x, y: q.y });
      clearDestMarker();
      if (ok) {
        q.wounded = false;
        q.hp = q.maxHp;
        floatText(q.x, q.y, "+❤️", "heal");
        updateTokens();
      }
    }
  }

  // =========================================================
  // Combate
  // =========================================================
  async function playerAttack(p, m) {
    G.combatFocus = { x: p.x, y: p.y };
    autoZoom("combat");
    const att = combatantOf("player", p), def = combatantOf("monster", m);
    const dmg = await runCombat({
      att, def, dados: p.dados,
      resultLabel: d => d > 0 ? I18N.t("dmgResult", { n: d }) : I18N.t("noDmgShield")
    });
    if (dmg > 0) damageMonster(p, m, dmg);
  }

  function damageMonster(p, m, dmg) {
    m.hp -= dmg;
    floatText(m.x, m.y, "-" + dmg, "dmg");
    if (m.hp <= 0) {
      const oro = DATA.MONSTERS[m.type].oro;
      p.oro += oro;
      floatText(m.x, m.y, "+" + oro + " 💰", "gold");
    }
    updateTokens();
    updateHud();
  }

  async function monsterAttack(m, p) {
    G.combatFocus = { x: p.x, y: p.y };
    autoZoom("combat");
    const att = combatantOf("monster", m), def = combatantOf("player", p);
    const dmg = await runCombat({
      att, def, dados: DATA.MONSTERS[m.type].dados, auto: true,
      resultLabel: d => d > 0 ? I18N.t("dmgResult", { n: d }) : I18N.t("noDmgMiss")
    });
    if (dmg > 0) await damagePlayer(p, dmg);
  }

  async function damagePlayer(p, dmg) {
    p.hp -= dmg;
    floatText(p.x, p.y, "-" + dmg, "dmg");
    if (p.hp <= 0) {
      // poción o hechizo de cura automáticos
      const potIdx = p.items.findIndex(it => it.tipo === "pocion");
      const cura = p.hechizos.find(h => h.tipo === "cura" && h.usos > 0);
      if (potIdx >= 0) {
        p.items.splice(potIdx, 1);
        p.hp = p.maxHp;
        await showMessage(I18N.t("autoPotion", { name: p.nombre }), I18N.t("ok"));
      } else if (cura) {
        cura.usos--;
        p.hp = p.maxHp;
        await showMessage(I18N.t("autoCure", { name: p.nombre }), I18N.t("ok"));
      } else {
        p.hp = 0;
        p.wounded = true;
        await showMessage(I18N.t("fell", { name: p.nombre }), I18N.t("ok"));
      }
    }
    updateTokens();
    updateHud();
  }

  // =========================================================
  // Objetos y hechizos
  // =========================================================
  async function useItemMenu(p) {
    const opts = [];
    p.items.forEach((it, i) => opts.push({ label: itemLabel(it), value: i }));
    for (const h of p.hechizos)
      if (h.usos > 0)
        opts.push({ label: (h.tipo === "bola" ? I18N.t("fireball") : I18N.t("cure")) + ` (${h.usos})`, value: h });
    opts.push({ label: I18N.t("cancel"), value: null });
    const sel = await showChoice(I18N.t("whatUse"), opts);
    if (sel === null || sel === undefined) return playerActions();

    if (typeof sel === "number") { // objeto
      const it = p.items[sel];
      if (it.tipo === "pocion") {
        if (p.hp >= p.maxHp) { await showMessage(I18N.t("fullHp"), I18N.t("ok")); return playerActions(); }
        p.items.splice(sel, 1);
        p.hp = p.maxHp;
        floatText(p.x, p.y, "+❤️", "heal");
      } else { // pergamino: enemigo adyacente
        const targets = adjMonsters(p);
        if (!targets.length) { await showMessage(I18N.t("noAdjEnemies"), I18N.t("ok")); return playerActions(); }
        const m = await pickTarget(targets);
        if (!m) return playerActions();
        p.items.splice(sel, 1);
        await runCombat({
          att: combatantOf("player", p), def: combatantOf("monster", m),
          fixed: it.dmg, resultLabel: () => I18N.t("scrollHit", { n: it.dmg })
        });
        damageMonster(p, m, it.dmg);
      }
    } else { // hechizo
      if (sel.tipo === "cura") {
        if (p.hp >= p.maxHp) { await showMessage(I18N.t("fullHp"), I18N.t("ok")); return playerActions(); }
        sel.usos--;
        p.hp = p.maxHp;
        floatText(p.x, p.y, "+❤️", "heal");
      } else { // bola de fuego
        const targets = G.dungeon.monsters.filter(m =>
          m.hp > 0 && m.active && G.revealed.has(key(m.x, m.y)) &&
          Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= DATA.RANGO_BOLA);
        if (!targets.length) { await showMessage(I18N.t("noTargets", { n: DATA.RANGO_BOLA }), I18N.t("ok")); return playerActions(); }
        const m = await pickTarget(targets);
        if (!m) return playerActions();
        sel.usos--;
        await runCombat({
          att: combatantOf("player", p), def: combatantOf("monster", m),
          fixed: sel.dmg, resultLabel: () => I18N.t("fireballHit", { n: sel.dmg })
        });
        damageMonster(p, m, sel.dmg);
      }
    }
    updateHud();
    updateTokens();
    playerActions();
  }

  function pickTarget(monsters) {
    return new Promise(res => {
      for (const m of monsters) G.tileEls[m.y][m.x].classList.add("target");
      setInlineActions([{ label: I18N.t("cancel"), cb: () => { clearHighlights(); res(null); } }]);
      G.targetCb = (x, y) => {
        const m = monsters.find(m => m.x === x && m.y === y);
        if (m) { clearHighlights(); res(m); }
      };
    });
  }

  // =========================================================
  // Turno del jugador
  // =========================================================
  async function startPlayerTurn() {
    const p = currentPlayer();
    updateHud();
    updateTokens();
    autoZoom("turn");
    await showMessage(`<img class="msg-portrait" src="img/${I18N.portrait(p.classId)}.png"><br>` +
      I18N.t("turnOf", { name: p.nombre }), I18N.t("start"));
    G.hasMoved = false;
    G.hasAttacked = false;
    G.moveLeft = 0;
    G.promptedChests = new Set();
    playerActions();
  }

  function playerActions() {
    const p = currentPlayer();
    const btns = [];
    const enemies = adjMonsters(p);

    if (!G.hasMoved)
      btns.push({ label: I18N.t("moveBtn"), primary: !enemies.length, cb: startMove });
    if (enemies.length && !G.hasAttacked)
      btns.push({ label: I18N.t("attackBtn"), primary: true, cb: () => startAttack(enemies) });
    if (adjChests(p.x, p.y).length)
      btns.push({ label: I18N.t("openChestBtn"), cb: async () => { G.promptedChests = new Set(); await promptChests(p); playerActions(); } });
    if (adjWounded(p).length)
      btns.push({ label: I18N.t("firstAidBtn"), cb: async () => { await promptFirstAid(p); playerActions(); } });
    if (p.items.length || p.hechizos.some(h => h.usos > 0))
      btns.push({ label: I18N.t("useItemBtn"), cb: () => useItemMenu(p) });
    btns.push({ label: I18N.t("endTurnBtn"), cb: endPlayerTurn });
    showActionMenu(btns);
  }

  async function startMove() {
    const p = currentPlayer();
    const results = await Dice.roll({ count: 2, type: "move", title: I18N.t("moveDiceTitle", { name: p.nombre }) });
    G.moveLeft = results[0] + results[1];
    G.movedAny = false;
    showMoveOptions();
  }

  function showMoveOptions() {
    const p = currentPlayer();
    G.moveMap = reachable(p.x, p.y, G.moveLeft);
    let any = false;
    for (const [, node] of G.moveMap) {
      if (node.dist === 0 || playerAt(node.x, node.y)) continue;
      any = true;
      if (node.frontier) {
        // casilla negra alcanzable: resalta su marcador "!" en verde
        const m = $("tokens").querySelector(`.frontier-marker[data-k="${node.x},${node.y}"]`);
        if (m) m.classList.add("reach");
      } else {
        G.tileEls[node.y][node.x].classList.add("highlight");
      }
    }
    if (!any) {
      clearHighlights();
      if (!G.movedAny) showMessage(I18N.t("noMoveTiles")).then(finishMove);
      else finishMove();
      return;
    }
    G.movedAny = true;
    autoZoom("move");   // encuadra todas las casillas alcanzables + 1 extra
    setInlineActions([{ label: I18N.t("stopHereBtn", { n: G.moveLeft }), cb: finishMove }]);
  }

  async function finishMove() {
    clearHighlights();
    G.moveLeft = 0;
    G.hasMoved = true;
    playerActions();
  }

  async function startAttack(enemies) {
    const p = currentPlayer();
    const m = enemies.length === 1 ? enemies[0] : await pickTarget(enemies);
    if (!m) return playerActions();
    G.hasAttacked = true;
    await playerAttack(p, m);
    if (checkAllMonstersDead()) return;
    playerActions();
  }

  function checkAllMonstersDead() { return false; } // ganar solo por la salida

  async function endPlayerTurn() {
    clearHighlights();
    // siguiente jugador no herido, o fase de monstruos
    let next = G.turnIdx + 1;
    while (next < G.players.length && G.players[next].wounded) next++;
    if (next < G.players.length) {
      G.turnIdx = next;
      await startPlayerTurn();
    } else {
      await monstersPhase();
    }
  }

  // =========================================================
  // Fase de monstruos
  // =========================================================
  async function monstersPhase() {
    G.phase = "monsters";
    setInlineActions([]);
    hideActionMenu();
    $("confirm-bar").classList.add("hidden");
    updateTokens();
    const active = G.dungeon.monsters.filter(m => m.hp > 0 && m.active);
    if (active.length) $("hud-name").textContent = I18N.t("monstersTurn");

    for (const m of active) {
      if (m.hp <= 0) continue;
      const targets = G.players.filter(p => !p.wounded);
      if (!targets.length) break;

      let victim = DIRS4.map(([dx, dy]) => playerAt(m.x + dx, m.y + dy)).find(p => p && !p.wounded);
      if (!victim) {
        const moved = monsterMove(m, targets);
        if (moved) {
          updateTokens();
          focusTile(m.x, m.y);
          await sleep(450);
        }
        victim = DIRS4.map(([dx, dy]) => playerAt(m.x + dx, m.y + dy)).find(p => p && !p.wounded);
      }
      if (victim) {
        await monsterAttack(m, victim);
        if (await checkDefeat()) return;
      }
    }

    // nueva ronda de jugadores
    G.phase = "players";
    let first = 0;
    while (first < G.players.length && G.players[first].wounded) first++;
    if (first >= G.players.length) { await checkDefeat(); return; }
    G.turnIdx = first;
    await startPlayerTurn();
  }

  function monsterMove(m, targets) {
    // BFS desde el monstruo por casillas reveladas y transitables
    const base = DATA.MONSTERS[m.type];
    const seen = new Map();
    seen.set(key(m.x, m.y), null);
    const q = [{ x: m.x, y: m.y }];
    let goal = null;
    while (q.length && !goal) {
      const n = q.shift();
      for (const [dx, dy] of DIRS4) {
        const nx = n.x + dx, ny = n.y + dy, k = key(nx, ny);
        if (seen.has(k) || !inBounds(nx, ny)) continue;
        const pl = playerAt(nx, ny);
        if (pl && !pl.wounded) { goal = { x: n.x, y: n.y }; break; } // llegar adyacente
        if (!G.revealed.has(k) || !passable(nx, ny) || playerAt(nx, ny)) continue;
        seen.set(k, key(n.x, n.y));
        q.push({ x: nx, y: ny });
      }
    }
    if (!goal) return false;
    // reconstruir camino hasta goal
    const path = [];
    let cur = key(goal.x, goal.y);
    while (cur && seen.get(cur) !== null) {
      const [cx, cy] = cur.split(",").map(Number);
      path.unshift({ x: cx, y: cy });
      cur = seen.get(cur);
    }
    const steps = path.slice(0, base.mov);
    if (!steps.length) return false;
    const last = steps[steps.length - 1];
    m.x = last.x; m.y = last.y;
    return true;
  }

  // =========================================================
  // Fin de partida
  // =========================================================
  async function victory() {
    G.phase = "over";
    const rows = G.players.map(p => `<div>${p.nombre}: 💰 ${p.oro}</div>`).join("");
    const total = G.players.reduce((a, p) => a + p.oro, 0);
    $("end-title").textContent = I18N.t("victoryTitle");
    $("end-text").innerHTML = `${I18N.t("victoryText")}<br><br>${rows}<br><b>${I18N.t("total")}: 💰 ${total}</b>`;
    $("end-restart").textContent = I18N.t("playAgain");
    $("end-overlay").classList.remove("hidden");
    throw { gameOver: true };
  }

  async function checkDefeat() {
    if (G.players.some(p => !p.wounded)) return false;
    G.phase = "over";
    $("end-title").textContent = I18N.t("defeatTitle");
    $("end-text").innerHTML = I18N.t("defeatText");
    $("end-restart").textContent = I18N.t("playAgain");
    $("end-overlay").classList.remove("hidden");
    return true;
  }

  // =========================================================
  // Configuración de partida
  // =========================================================
  const CLASS_ORDER = ["barbaro", "enano", "mago", "elfo"];

  function setupScreens() {
    const el = $("setup");
    el.classList.remove("hidden");
    let size = null, numPlayers = null;
    const picks = [];

    function screenLang() {
      el.innerHTML = `<h1>⚔️ Mini-Quest</h1>
        <div class="setup-btns">
          <button class="btn big" data-v="es">🇪🇸 Español</button>
          <button class="btn big" data-v="ja">🇯🇵 にほんご</button>
        </div>`;
      el.querySelectorAll("button").forEach(b =>
        b.onclick = () => { I18N.setLang(b.dataset.v); screenSize(); });
    }

    function screenSize() {
      el.innerHTML = `<h1>⚔️ Mini-Quest</h1><p>${I18N.t("advLength")}</p>
        <div class="setup-btns">
          <button class="btn big" data-v="corta">${I18N.t("sizeShort")}<br><small>${I18N.t("rooms4")}</small></button>
          <button class="btn big" data-v="media">${I18N.t("sizeMedium")}<br><small>${I18N.t("rooms8")}</small></button>
          <button class="btn big" data-v="larga">${I18N.t("sizeLong")}<br><small>${I18N.t("rooms10")}</small></button>
        </div>`;
      el.querySelectorAll("button").forEach(b => b.onclick = () => { size = b.dataset.v; screenPlayers(); });
    }

    function screenPlayers() {
      el.innerHTML = `<h1>⚔️ Mini-Quest</h1><p>${I18N.t("howManyHeroes")}</p>
        <div class="setup-btns">` +
        [1, 2, 3, 4].map(n => `<button class="btn big" data-v="${n}">${n}</button>`).join("") +
        `</div>`;
      el.querySelectorAll("button").forEach(b => b.onclick = () => { numPlayers = +b.dataset.v; screenClass(0); });
    }

    function screenClass(i) {
      if (i >= numPlayers) { el.classList.add("hidden"); startGame(size, picks); return; }
      const taken = picks.map(p => p.classId);
      el.innerHTML = `<h1>${I18N.t("playerN", { n: i + 1 })}</h1><p>${I18N.t("chooseHero")}</p>
        <div class="setup-btns classes">` +
        CLASS_ORDER.map(cid => {
          const c = DATA.CLASSES[cid];
          const dis = taken.includes(cid) ? "disabled" : "";
          const spells = cid === "mago" ? "🔥×6" : cid === "elfo" ? "🔥×2 ✨×1" : "—";
          return `<button class="btn class-card" data-v="${cid}" ${dis}>
            <img src="img/${I18N.portrait(cid)}.png">
            <b>${I18N.name(cid)}</b>
            <small>❤️${c.hp} ⚔️${c.dados} ${spells}</small>
          </button>`;
        }).join("") + `</div>`;
      el.querySelectorAll("button:not([disabled])").forEach(b =>
        b.onclick = () => { picks.push({ classId: b.dataset.v, playerNum: i + 1 }); screenClass(i + 1); });
    }

    screenLang();
  }

  function startGame(size, picks) {
    let numRooms = DATA.SIZES[size];
    if (size === "larga") numRooms = 10 + Math.floor(Math.random() * 3);

    const dungeon = Dungeon.generate(DATA, numRooms, picks.length);
    const players = picks.map((pk, i) => {
      const c = DATA.CLASSES[pk.classId];
      return {
        idx: i, classId: c.id,
        nombre: I18N.name(c.id) + (picks.length > 1 ? I18N.t("playerSuffix", { n: pk.playerNum }) : ""),
        hp: c.hp, maxHp: c.hp, dados: c.dados, oro: 0,
        x: dungeon.spawnTiles[i].x, y: dungeon.spawnTiles[i].y,
        wounded: false, items: [],
        hechizos: c.hechizos.map(h => ({ ...h }))
      };
    });

    G = {
      dungeon, players, revealed: new Set(),
      turnIdx: 0, phase: "players",
      hasMoved: false, hasAttacked: false, moveLeft: 0, movedAny: false,
      moveMap: null, targetCb: null, promptedChests: new Set(), confirming: false,
      zoomMode: "turn", combatFocus: null, menuPos: null, tileEls: []
    };

    buildBoard();
    revealRoom(dungeon.startRoom.id);
    updateTokens();
    $("game-ui").classList.remove("hidden");
    $("btn-autozoom").onclick = () => autoZoom(G.zoomMode);
    camInitGestures();
    camCenterOn(players[0].x * T + T / 2, players[0].y * T + T / 2, turnScale(), true);
    startPlayerTurn().catch(handleEnd);
  }

  function handleEnd(e) { if (!e || !e.gameOver) console.error(e); }

  function init() {
    $("end-restart").onclick = () => location.reload();
    initMenuDrag();
    // rotación de pantalla / cambio de tamaño: reencuadra la cámara y recoloca el menú
    window.addEventListener("resize", () => {
      if (!G || !G.players) return;
      autoZoom(G.zoomMode, true);
      G.menuPos = null;
      if (!$("action-popup").classList.contains("hidden")) positionMenu();
    });
    // capturar promesas de victoria no gestionadas
    window.addEventListener("unhandledrejection", (e) => {
      if (e.reason && e.reason.gameOver) e.preventDefault();
    });
    setupScreens();
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", Game.init);

