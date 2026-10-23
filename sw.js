// Mini-Quest - Service Worker (cache offline)
const CACHE = "mini-quest-v12";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/i18n.js",
  "./js/data.js",
  "./js/dungeon.js",
  "./js/dice.js",
  "./js/game.js",
  "img/apple-touch-icon.png",
  "img/title_bg.png",
  "img/chest.png",
  "img/item_oro.png",
  "img/item_pocion.png",
  "img/item_pergamino.png",
  "img/item_pergamino2.png",
  "img/item_bola.png",
  "img/item_cura.png",
  "img/die_1.png",
  "img/die_2.png",
  "img/die_3.png",
  "img/die_4.png",
  "img/die_5.png",
  "img/die_6.png",
  "img/die_shield.png",
  "img/die_skull.png",
  "img/icon-192.png",
  "img/icon-512.png",
  "img/portrait_barbaro.png",
  "img/portrait_dragon.png",
  "img/portrait_elfo.png",
  "img/portrait_enano.png",
  "img/portrait_goblin.png",
  "img/portrait_mago.png",
  "img/portrait_orco.png",
  "img/portrait_troll.png",
  "img/portrait_zombie.png",
  "img/tile_corridor.png",
  "img/tile_exit.png",
  "img/tile_room1.png",
  "img/tile_room2.png",
  "img/tile_room3.png",
  "img/tile_room4.png",
  "img/tile_room5.png",
  "img/tile_wall.png",
  "img/token_barbaro.png",
  "img/token_dragon.png",
  "img/token_elfo.png",
  "img/token_enano.png",
  "img/token_goblin.png",
  "img/token_mago.png",
  "img/token_orco.png",
  "img/token_troll.png",
  "img/token_zombie.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
