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

  // Al llegar a una puerta o al borde de una zona, revela la
  // habitación o pasillo colindante.
  function revealAdjacentZones(x, y) {
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      if (cell(nx, ny).t === "wall") continue;
      if (!G.revealed.has(key(nx, ny))) revealFrom(nx, ny);
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
    board.onclick = onBoardClick;
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

    // eliminar los que sobran
    for (const el of Array.from(layer.children))
      if (!wanted.has(el.dataset.uid)) el.remove();

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
  }

  // =========================================================
  // Cámara
  // =========================================================
  function viewport() { const v = $("viewport"); return { w: v.clientWidth, h: v.clientHeight }; }

  function focusTile(x, y, instant = false) {
    if (G.zoomedOut) return;
    const { w, h } = viewport();
    const scale = G.camScale;
    let tx = w / 2 - (x * T + T / 2) * scale;
    let ty = h / 2 - (y * T + T / 2) * scale;
    applyCam(tx, ty, scale, instant);
  }

  function zoomFit() {
    const { w, h } = viewport();
    const scale = Math.min(w / (COLS * T), h / (ROWS * T));
    applyCam((w - COLS * T * scale) / 2, (h - ROWS * T * scale) / 2, scale);
  }

  function applyCam(tx, ty, scale, instant = false) {
    const cam = $("camera");
    cam.style.transition = instant ? "none" : "transform 0.5s ease";
    cam.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function toggleZoom() {
    G.zoomedOut = !G.zoomedOut;
    $("btn-zoom").textContent = G.zoomedOut ? "🔍+" : "🗺️";
    if (G.zoomedOut) zoomFit();
    else { const p = currentPlayer(); focusTile(p.x, p.y); }
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

  // Menú de acciones: popup CENTRADO que oscurece el tablero, para que el
  // jugador se dé cuenta de que debe elegir.
  function showActionMenu(buttons) {
    setInlineActions([]);              // limpia la barra inferior
    $("confirm-bar").classList.add("hidden");
    const box = $("action-popup-buttons");
    box.innerHTML = "";
    for (const b of buttons) {
      const el = document.createElement("button");
      el.className = "btn action" + (b.primary ? " primary" : "");
      el.textContent = b.label;
      el.onclick = () => { hideActionMenu(); b.cb(); };
      box.appendChild(el);
    }
    $("action-popup").classList.remove("hidden");
  }

  function hideActionMenu() { $("action-popup").classList.add("hidden"); }

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
    return viewport().h / 2 + (y - currentPlayer().y) * T * G.camScale;
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
        // solo por casillas ya reveladas (las zonas nuevas se revelan al
        // llegar al borde y se puede seguir con los pasos restantes)
        if (!res.has(k) && passable(nx, ny) && G.revealed.has(k)) {
          res.set(k, { dist: n.dist + 1, from: key(n.x, n.y), x: nx, y: ny });
          q.push({ x: nx, y: ny, dist: n.dist + 1 });
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
    G.moveMap = null;
    G.targetCb = null;
  }

  function onBoardClick(e) {
    if (G.confirming) return; // ignorar taps mientras hay una confirmación abierta
    const tileEl = e.target.closest(".tile");
    if (!tileEl) return;
    const x = +tileEl.dataset.x, y = +tileEl.dataset.y;
    if (G.targetCb) { G.targetCb(x, y); return; }
    if (G.moveMap) onMoveTileTap(x, y);
  }

  async function onMoveTileTap(x, y) {
    const k = key(x, y);
    const node = G.moveMap.get(k);
    if (!node || node.dist === 0 || playerAt(x, y)) return;
    // marcar camino, círculo de destino y pedir confirmación (sin oscurecer)
    document.querySelectorAll(".tile.path").forEach(el => el.classList.remove("path"));
    const path = pathTo(G.moveMap, k);
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
    // si quedan pasos, puede elegir un nuevo destino (p. ej. zona recién revelada)
    if (G.moveLeft > 0) showMoveOptions();
    else finishMove();
  }

  async function animateMove(p, path) {
    for (const step of path) {
      p.x = step.x; p.y = step.y;
      revealFrom(p.x, p.y);
      revealAdjacentZones(p.x, p.y);
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
    focusTile(p.x, p.y);
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
    G.zoomedOut = false;
    $("btn-zoom").textContent = "🗺️";
    focusTile(p.x, p.y);
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
      if (node.dist > 0 && !playerAt(node.x, node.y)) {
        G.tileEls[node.y][node.x].classList.add("highlight");
        any = true;
      }
    }
    if (!any) {
      clearHighlights();
      if (!G.movedAny) showMessage(I18N.t("noMoveTiles")).then(finishMove);
      else finishMove();
      return;
    }
    G.movedAny = true;
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
      zoomedOut: false, camScale: 1, tileEls: []
    };

    buildBoard();
    revealRoom(dungeon.startRoom.id);
    updateTokens();
    $("game-ui").classList.remove("hidden");
    $("btn-zoom").onclick = toggleZoom;
    focusTile(players[0].x, players[0].y, true);
    startPlayerTurn().catch(handleEnd);
  }

  function handleEnd(e) { if (!e || !e.gameOver) console.error(e); }

  function init() {
    $("end-restart").onclick = () => location.reload();
    // capturar promesas de victoria no gestionadas
    window.addEventListener("unhandledrejection", (e) => {
      if (e.reason && e.reason.gameOver) e.preventDefault();
    });
    setupScreens();
  }

  return { init };
})();

window.addEventListener("DOMContentLoaded", Game.init);

