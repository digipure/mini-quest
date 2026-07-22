// ============================================================
// Mini-Quest - Datos del juego (clases, monstruos, cofres)
// ============================================================
"use strict";

const DATA = {
  GRID_COLS: 26,
  GRID_ROWS: 20,
  TILE: 64,

  CLASSES: {
    barbaro: { id: "barbaro", nombre: "Bárbaro", hp: 7,  dados: 3, hechizos: [] },
    enano:   { id: "enano",   nombre: "Enano",   hp: 10, dados: 2, hechizos: [] },
    mago:    { id: "mago",    nombre: "Mago",    hp: 5,  dados: 1,
               hechizos: [{ tipo: "bola", usos: 6, dmg: 3 }] },
    elfo:    { id: "elfo",    nombre: "Elfo",    hp: 5,  dados: 2,
               hechizos: [{ tipo: "bola", usos: 2, dmg: 3 }, { tipo: "cura", usos: 1 }] }
  },

  MONSTERS: {
    goblin: { id: "goblin", nombre: "Goblin", hp: 1, dados: 1, mov: 5, oro: 1 },
    orco:   { id: "orco",   nombre: "Orco",   hp: 1, dados: 2, mov: 4, oro: 3 },
    troll:  { id: "troll",  nombre: "Troll",  hp: 2, dados: 3, mov: 2, oro: 5 },
    zombie: { id: "zombie", nombre: "Zombie", hp: 1, dados: 3, mov: 3, oro: 2 },
    dragon: { id: "dragon", nombre: "Dragón", hp: 4, dados: 3, mov: 2, oro: 100 }
  },

  // Botín de cofres, en orden de importancia (tier 0..5)
  LOOT: [
    { tier: 0, tipo: "oro",       cantidad: 25,  nombre: "25 de oro" },
    { tier: 1, tipo: "pocion",    nombre: "Poción de vida" },
    { tier: 2, tipo: "pergamino", dmg: 1, nombre: "Pergamino de fuego" },
    { tier: 3, tipo: "oro",       cantidad: 100, nombre: "100 de oro" },
    { tier: 4, tipo: "pergamino", dmg: 2, nombre: "Pergamino de fuego mejorado" },
    { tier: 5, tipo: "oro",       cantidad: 200, nombre: "200 de oro" }
  ],

  // Grupos de monstruos según el tier del cofre de la habitación
  GUARDS_BY_TIER: [
    [["goblin"], ["goblin", "goblin"]],
    [["goblin", "goblin"], ["zombie"]],
    [["zombie", "goblin"], ["orco"]],
    [["orco", "orco"], ["orco", "zombie", "goblin"]],
    [["troll"], ["orco", "troll"]],
    [["troll", "orco"], ["troll", "orco", "orco"]]
  ],

  // Guardia de la sala final (además del dragón)
  FINAL_GUARDS: [["orco", "troll"], ["troll", "troll"], ["orco", "orco", "troll"]],

  SIZES: { corta: 4, media: 8, larga: 11 },

  RANGO_BOLA: 5 // alcance (chebyshev) de las bolas de fuego
};

if (typeof module !== "undefined") module.exports = DATA;
