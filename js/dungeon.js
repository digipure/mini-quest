// ============================================================
// Mini-Quest - Generación aleatoria de la mazmorra
// Módulo puro (sin DOM) para poder testearlo con node.
// ============================================================
"use strict";

const Dungeon = (() => {
  const rnd = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rnd(arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // ---- colocación de habitaciones ----
  function placeRooms(cols, rows, numRooms) {
    const rooms = [];
    const maxW = numRooms > 8 ? 5 : 7;
    const maxH = numRooms > 8 ? 4 : 5;
    let attempts = 0;
    while (rooms.length < numRooms && attempts < 2000) {
      attempts++;
      const w = 3 + rnd(maxW - 2);
      const h = 3 + rnd(maxH - 2);
      const x = 1 + rnd(cols - w - 2);
      const y = 1 + rnd(rows - h - 2);
      // margen de 1 tile entre habitaciones
      const clash = rooms.some(r =>
        x < r.x + r.w + 1 && x + w + 1 > r.x &&
        y < r.y + r.h + 1 && y + h + 1 > r.y);
      if (!clash) {
        rooms.push({ id: rooms.length, x, y, w, h,
          cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2),
          styleIdx: 1 + rnd(5), revealed: false, isStart: false, isFinal: false });
      }
    }
    return rooms;
  }

  // ---- pasillo en L entre dos puntos ----
  function carveCorridor(grid, x1, y1, x2, y2) {
    const carve = (x, y) => { if (grid[y][x].t === "wall") grid[y][x] = { t: "corridor" }; };
    if (Math.random() < 0.5) {
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carve(x, y1);
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carve(x2, y);
    } else {
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carve(x1, y);
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carve(x, y2);
    }
  }

  function isWalkable(cell) {
    return cell.t === "corridor" || cell.t === "room" || cell.t === "exit";
  }

  // BFS para comprobar conectividad
  function connected(grid, cols, rows, from, to) {
    const seen = new Set([from.y * cols + from.x]);
    const q = [from];
    while (q.length) {
      const { x, y } = q.shift();
      if (x === to.x && y === to.y) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = ny * cols + nx;
        if (nx >= 0 && ny >= 0 && nx < cols && ny < rows &&
            !seen.has(k) && isWalkable(grid[ny][nx])) {
          seen.add(k);
          q.push({ x: nx, y: ny });
        }
      }
    }
    return false;
  }

  function roomTiles(room) {
    const tiles = [];
    for (let y = room.y; y < room.y + room.h; y++)
      for (let x = room.x; x < room.x + room.w; x++)
        tiles.push({ x, y });
    return tiles;
  }

  function tryGenerate(DATA, numRooms, numPlayers) {
    const cols = DATA.GRID_COLS, rows = DATA.GRID_ROWS;
    const rooms = placeRooms(cols, rows, numRooms);
    if (rooms.length < numRooms) return null;

    const grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ t: "wall" })));
    for (const r of rooms)
      for (const { x, y } of roomTiles(r))
        grid[y][x] = { t: "room", room: r.id };

    // conectar cada habitación con la más cercana ya conectada
    const done = [rooms[0]];
    const todo = rooms.slice(1);
    while (todo.length) {
      let best = null, bestD = Infinity, bestFrom = null;
      for (const r of todo) for (const c of done) {
        const d = Math.abs(r.cx - c.cx) + Math.abs(r.cy - c.cy);
        if (d < bestD) { bestD = d; best = r; bestFrom = c; }
      }
      carveCorridor(grid, bestFrom.cx, bestFrom.cy, best.cx, best.cy);
      done.push(best);
      todo.splice(todo.indexOf(best), 1);
    }

    // habitación inicial: esquina superior izquierda; final: la más lejana
    const start = rooms.reduce((a, b) => (a.cx + a.cy < b.cx + b.cy ? a : b));
    start.isStart = true;
    const final = rooms.reduce((a, b) => {
      const da = Math.abs(a.cx - start.cx) + Math.abs(a.cy - start.cy);
      const db = Math.abs(b.cx - start.cx) + Math.abs(b.cy - start.cy);
      return da >= db ? a : b;
    });
    if (final === start) return null;
    final.isFinal = true;

    // salida en la sala final
    const exitTile = { x: final.x + final.w - 1, y: final.y + final.h - 1 };
    grid[exitTile.y][exitTile.x] = { t: "exit", room: final.id };

    if (!connected(grid, cols, rows, { x: start.cx, y: start.cy }, exitTile)) return null;

    // ---- cofres y monstruos ----
    const monsters = [];
    const chests = [];
    let mid = 0;
    const addMonster = (type, pos) => {
      const base = DATA.MONSTERS[type];
      monsters.push({ uid: "m" + (mid++), type, x: pos.x, y: pos.y, hp: base.hp, active: false });
    };

    const middleRooms = rooms.filter(r => !r.isStart && !r.isFinal);
    // tiers repartidos con variedad (barajados, ciclando 0..5)
    let tiers = [];
    while (tiers.length < middleRooms.length) tiers = tiers.concat(shuffle([0, 1, 2, 3, 4, 5]));
    tiers = tiers.slice(0, middleRooms.length);

    middleRooms.forEach((room, i) => {
      const tier = tiers[i];
      const free = shuffle(roomTiles(room));
      const chestPos = free.pop();
      chests.push({ x: chestPos.x, y: chestPos.y, loot: DATA.LOOT[tier], opened: false });
      const group = pick(DATA.GUARDS_BY_TIER[tier]);
      for (const type of group) {
        if (!free.length) break;
        addMonster(type, free.pop());
      }
    });

    // sala final: dragón + guardia (evitando la salida)
    {
      const free = shuffle(roomTiles(final).filter(t => !(t.x === exitTile.x && t.y === exitTile.y)));
      addMonster("dragon", free.pop());
      for (const type of pick(DATA.FINAL_GUARDS)) {
        if (!free.length) break;
        addMonster(type, free.pop());
      }
    }

    // goblins sueltos en pasillos (débiles), lejos de la sala inicial
    const corridorTiles = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
      if (grid[y][x].t === "corridor" &&
          Math.abs(x - start.cx) + Math.abs(y - start.cy) > 6)
        corridorTiles.push({ x, y });
    for (const pos of shuffle(corridorTiles).slice(0, Math.min(2, corridorTiles.length)))
      addMonster("goblin", pos);

    // puntos de aparición de jugadores en la sala inicial
    const spawnTiles = shuffle(roomTiles(start)).slice(0, numPlayers);
    if (spawnTiles.length < numPlayers) return null;

    return { grid, rooms, monsters, chests, exitTile, spawnTiles, startRoom: start, finalRoom: final };
  }

  function generate(DATA, numRooms, numPlayers) {
    for (let i = 0; i < 200; i++) {
      const d = tryGenerate(DATA, numRooms, numPlayers);
      if (d) return d;
    }
    throw new Error("No se pudo generar la mazmorra");
  }

  return { generate, isWalkable, roomTiles };
})();

if (typeof module !== "undefined") module.exports = Dungeon;
