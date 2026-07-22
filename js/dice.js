// ============================================================
// Mini-Quest - Dados como cubo 3D (6 caras)
// Los dados aparecen quietos; al pulsar "Tirar" (o en modo auto)
// caen sobre el tablero con rebote y volteo 3D hasta asentarse
// mostrando la cara del resultado.
//   Dice.roll({count, type, auto, title}) -> Promise<resultados>  (overlay propio)
//   Dice.buildDie(type) -> elemento cubo listo (para reusar en combate)
//   Dice.rollDice(dice, type) -> Promise<resultados>              (anima dados dados)
// type: 'move' -> números 1..6 ; 'attack' -> 'skull' | 'shield'
// ============================================================
"use strict";

const Dice = (() => {
  const $ = (id) => document.getElementById(id);
  const DROP_MS = 1100;
  const STAGGER = 130;

  // qué imagen va en cada cara del cubo
  const MOVE_FACES = { front: "die_1", back: "die_6", right: "die_2", left: "die_5", top: "die_3", bottom: "die_4" };
  const ATK_FACES  = { front: "die_skull", back: "die_shield", right: "die_skull", left: "die_shield", top: "die_skull", bottom: "die_shield" };
  const POS = ["front", "back", "right", "left", "top", "bottom"];
  // rotación (deg) que trae cada cara al frente
  const FACE_ORI = { front: [0, 0], back: [0, 180], right: [0, -90], left: [0, 90], top: [-90, 0], bottom: [90, 0] };
  // número de movimiento -> cara del cubo
  const NUM_POS = { 1: "front", 6: "back", 2: "right", 5: "left", 3: "top", 4: "bottom" };

  function buildDie(type) {
    const die = document.createElement("div");
    die.className = "die ready";
    // wrapper con inclinación isométrica fija: siempre se ven 3 caras
    const tilt = document.createElement("div");
    tilt.className = "cube-tilt";
    const cube = document.createElement("div");
    cube.className = "cube";
    const faces = type === "attack" ? ATK_FACES : MOVE_FACES;
    for (const pos of POS) {
      const f = document.createElement("div");
      f.className = "face face-" + pos;
      f.style.backgroundImage = `url(img/${faces[pos]}.png)`;
      cube.appendChild(f);
    }
    tilt.appendChild(cube);
    die.appendChild(tilt);
    die._cube = cube;
    return die;
  }

  // Anima un conjunto de dados ya creados. Resuelve con el array de resultados.
  function rollDice(dice, type) {
    return new Promise((resolve) => {
      const results = new Array(dice.length).fill(null);
      let settled = 0;
      dice.forEach((die, i) => {
        const result = type === "attack"
          ? (Math.random() < 0.5 ? "skull" : "shield")
          : 1 + Math.floor(Math.random() * 6);
        results[i] = result;
        const pos = type === "attack" ? (result === "skull" ? "front" : "back") : NUM_POS[result];
        const [fx, fy] = FACE_ORI[pos];
        const cube = die._cube;
        cube.style.setProperty("--fx", (720 + fx) + "deg"); // varias vueltas + orientación final
        cube.style.setProperty("--fy", (900 + fy) + "deg");

        die.classList.remove("ready");
        die.style.animationDelay = (i * STAGGER) + "ms";
        cube.style.animationDelay = (i * STAGGER) + "ms";
        void die.offsetWidth; // reinicia animaciones de forma fiable
        die.classList.add("dropping");
        cube.classList.add("tumbling");

        let done = false;
        const settle = () => {
          if (done) return;
          done = true;
          cube.classList.remove("tumbling");
          cube.style.transform = `rotateX(${fx}deg) rotateY(${fy}deg)`; // fija cara final
          die.classList.remove("dropping");
          die.classList.add("settled");
          settled++;
          if (settled === dice.length) resolve(results);
        };
        die.addEventListener("animationend", settle, { once: true });
        setTimeout(settle, DROP_MS + i * STAGGER + 160); // red de seguridad
      });
    });
  }

  // Tirada con overlay propio (movimiento y tiradas fuera de combate).
  function roll({ count, type, auto = false, title = "" }) {
    return new Promise((resolve) => {
      const overlay = $("dice-overlay"), box = $("dice-box"), titleEl = $("dice-title");
      const hint = $("dice-hint"), rollBtn = $("dice-roll"), contBtn = $("dice-continue"), totalEl = $("dice-total");

      box.innerHTML = "";
      titleEl.textContent = title;
      totalEl.textContent = "";
      contBtn.classList.add("hidden");
      contBtn.textContent = I18N.t("continueBtn");
      overlay.classList.remove("hidden");

      const dice = [];
      for (let i = 0; i < count; i++) { const d = buildDie(type); box.appendChild(d); dice.push(d); }

      const finish = (results) => {
        if (type === "move") {
          totalEl.textContent = I18N.t("diceMoveTotal", { n: results.reduce((a, b) => a + b, 0) });
        } else {
          const s = results.filter(r => r === "skull").length;
          totalEl.textContent = s === 0 ? I18N.t("diceNoDmg") : s === 1 ? I18N.t("diceDmg1") : I18N.t("diceDmgN", { n: s });
        }
        contBtn.classList.remove("hidden");
        contBtn.onclick = () => { overlay.classList.add("hidden"); resolve(results); };
        if (auto) setTimeout(() => { if (!contBtn.classList.contains("hidden")) contBtn.onclick(); }, 1400);
      };

      const doRoll = () => { rollBtn.classList.add("hidden"); hint.textContent = ""; rollDice(dice, type).then(finish); };

      if (auto) {
        rollBtn.classList.add("hidden");
        hint.textContent = "";
        setTimeout(doRoll, 550);
      } else {
        hint.textContent = I18N.t("diceRollHint");
        rollBtn.textContent = I18N.t("diceRoll");
        rollBtn.classList.remove("hidden");
        rollBtn.onclick = doRoll;
      }
    });
  }

  return { roll, buildDie, rollDice };
})();
