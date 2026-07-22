// ============================================================
// Mini-Quest - Textos en español y japonés (solo kana, para niños)
// I18N.t("clave", {vars}) / I18N.className(id) / I18N.monsterName(id)
// ============================================================
"use strict";

const I18N = (() => {
  const STRINGS = {
    es: {
      // configuración
      advLength: "¿Cómo de grande será la aventura?",
      sizeShort: "Corta", sizeMedium: "Media", sizeLong: "Larga",
      rooms4: "4 habitaciones", rooms8: "8 habitaciones", rooms10: "10-12 habitaciones",
      howManyHeroes: "¿Cuántos héroes jugáis?",
      playerN: "Jugador {n}", chooseHero: "Elige tu héroe",
      playerSuffix: " (J{n})",
      // turno
      turnOf: "Turno de <b>{name}</b>", start: "¡Empezar!", ok: "Vale",
      yes: "Sí", no: "No", cancel: "Cancelar",
      moveBtn: "🎲 Mover", attackBtn: "⚔️ Atacar", openChestBtn: "🎁 Abrir cofre",
      firstAidBtn: "🚑 Primeros auxilios", useItemBtn: "🎒 Usar objeto",
      endTurnBtn: "⏭️ Terminar", stopHereBtn: "🛑 Parar aquí (quedan {n})",
      moveHere: "¿Mover aquí?", noMoveTiles: "No hay ninguna casilla libre a la que moverse.",
      // cofres y curas
      chestPrompt: "Hay un <b>cofre</b> delante. ¿Abrirlo?",
      openBtn: "Abrir", leaveBtn: "Dejarlo",
      woundedPrompt: "<b>{name}</b> está herido. ¿Aplicar primeros auxilios?",
      healBtn: "Curar", notNowBtn: "Ahora no",
      lootPotion: "🧪 ¡Poción!", lootScroll: "📜 ¡Pergamino!",
      lootGoldMsg: "¡Has encontrado <b>{n} de oro</b>! 💰",
      lootPotionMsg: "¡Has encontrado una <b>Poción de vida</b>!<br>Te curará por completo al usarla.",
      lootScrollMsg: "¡Has encontrado un <b>Pergamino de fuego</b>!<br>Hace {n} de daño a un enemigo adyacente.",
      lootClose: "¡Genial!",
      // objetos y hechizos
      whatUse: "¿Qué quieres usar?",
      potion: "🧪 Poción de vida", scroll: "📜 Pergamino de fuego", scrollPlus: "📜 Pergamino de fuego mejorado",
      fireball: "🔥 Bola de fuego", cure: "✨ Curación",
      fullHp: "Ya tienes toda la vida.",
      noAdjEnemies: "No hay enemigos adyacentes.",
      noTargets: "No hay enemigos a la vista (alcance {n}).",
      scrollHit: "📜 ¡El pergamino hace {n} de daño!",
      fireballHit: "🔥 ¡La bola de fuego hace {n} de daño!",
      autoPotion: "🧪 ¡La poción de <b>{name}</b> se usa automáticamente y recupera toda la vida!",
      autoCure: "✨ ¡El hechizo de curación de <b>{name}</b> se activa y recupera toda la vida!",
      fell: "💔 <b>{name}</b> ha caído herido. Otro jugador puede curarle con primeros auxilios.",
      // combate
      attackTitle: "{att} ataca a {def}",
      moveDiceTitle: "{name} — dados de movimiento",
      dmgResult: "¡{n} de daño!", noDmgShield: "¡El golpe rebota en el escudo!", noDmgMiss: "¡Fallado!",
      monstersTurn: "Turno de los monstruos…",
      // dados
      diceHint: "¡Toca los dados para pararlos!",
      diceRoll: "🎲 ¡Tirar!",
      diceRollHint: "Pulsa el botón para lanzar los dados",
      diceMoveTotal: "Movimiento: {n}",
      diceNoDmg: "¡Sin daño!", diceDmg1: "💥 1 punto de daño", diceDmgN: "💥 {n} puntos de daño",
      continueBtn: "Continuar",
      // fin
      victoryTitle: "🏆 ¡VICTORIA!", victoryText: "¡Habéis encontrado la salida!",
      total: "Total", defeatTitle: "💀 Derrota…",
      defeatText: "Todos los héroes han caído. ¡Probad de nuevo!",
      playAgain: "Jugar otra vez"
    },

    ja: {
      advLength: "ぼうけんの ながさは？",
      sizeShort: "みじかい", sizeMedium: "ふつう", sizeLong: "ながい",
      rooms4: "へや 4つ", rooms8: "へや 8つ", rooms10: "へや 10〜12",
      howManyHeroes: "なんにんで あそぶ？",
      playerN: "プレイヤー {n}", chooseHero: "ヒーローを えらんでね",
      playerSuffix: "（P{n}）",
      turnOf: "<b>{name}</b>の ばん", start: "スタート！", ok: "OK",
      yes: "はい", no: "いいえ", cancel: "キャンセル",
      moveBtn: "🎲 うごく", attackBtn: "⚔️ こうげき", openChestBtn: "🎁 たからばこ",
      firstAidBtn: "🚑 てあて", useItemBtn: "🎒 アイテム",
      endTurnBtn: "⏭️ おわる", stopHereBtn: "🛑 ここで とまる（のこり {n}）",
      moveHere: "ここに うごく？", noMoveTiles: "うごける ところが ないよ。",
      chestPrompt: "<b>たからばこ</b>が あるよ。あける？",
      openBtn: "あける", leaveBtn: "やめる",
      woundedPrompt: "<b>{name}</b>が けがを しているよ。てあて する？",
      healBtn: "てあて する", notNowBtn: "あとで",
      lootPotion: "🧪 ポーション！", lootScroll: "📜 まきもの！",
      lootGoldMsg: "<b>{n} ゴールド</b>を みつけた！ 💰",
      lootPotionMsg: "<b>かいふくポーション</b>を みつけた！<br>つかうと たいりょく ぜんかい。",
      lootScrollMsg: "<b>ひの まきもの</b>を みつけた！<br>となりの てきに {n} ダメージ。",
      lootClose: "やったー！",
      whatUse: "どれを つかう？",
      potion: "🧪 ポーション", scroll: "📜 ひの まきもの", scrollPlus: "📜 つよい ひの まきもの",
      fireball: "🔥 ファイアボール", cure: "✨ かいふく",
      fullHp: "たいりょくは まんたんだよ。",
      noAdjEnemies: "ちかくに てきが いないよ。",
      noTargets: "とどく てきが いないよ（しゃてい {n}）。",
      scrollHit: "📜 まきもので {n} ダメージ！",
      fireballHit: "🔥 ファイアボールで {n} ダメージ！",
      autoPotion: "🧪 <b>{name}</b>の ポーションが じどうで はつどう！ たいりょく かいふく！",
      autoCure: "✨ <b>{name}</b>の かいふくの まほうが はつどう！ たいりょく かいふく！",
      fell: "💔 <b>{name}</b>は たおれた。なかまが てあて すると ふっかつ するよ。",
      attackTitle: "{att}が {def}を こうげき！",
      moveDiceTitle: "{name} — いどうの さいころ",
      dmgResult: "{n} ダメージ！", noDmgShield: "たてで はねかえした！", noDmgMiss: "はずれ！",
      monstersTurn: "モンスターの ばん…",
      diceHint: "さいころを タッチして とめてね！",
      diceRoll: "🎲 ふる！",
      diceRollHint: "ボタンを おして さいころを ふってね",
      diceMoveTotal: "いどう：{n}",
      diceNoDmg: "ダメージ なし！", diceDmg1: "💥 1 ダメージ", diceDmgN: "💥 {n} ダメージ",
      continueBtn: "つづける",
      victoryTitle: "🏆 かち！", victoryText: "しゅつぐちを みつけた！",
      total: "ごうけい", defeatTitle: "💀 まけ…",
      defeatText: "みんな たおれちゃった。もういちど チャレンジ！",
      playAgain: "もういちど あそぶ"
    }
  };

  const NAMES = {
    es: {
      barbaro: "Bárbaro", enano: "Enano", mago: "Mago", elfo: "Elfo",
      goblin: "Goblin", orco: "Orco", troll: "Troll", zombie: "Zombie", dragon: "Dragón"
    },
    ja: {
      barbaro: "バーバリアン", enano: "ドワーフ", mago: "まほうつかい", elfo: "エルフ",
      goblin: "ゴブリン", orco: "オーク", troll: "トロール", zombie: "ゾンビ", dragon: "ドラゴン"
    }
  };

  let LANG = "es";

  function t(key, vars) {
    let s = STRINGS[LANG][key];
    if (s === undefined) s = STRINGS.es[key] || key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll("{" + k + "}", v);
    return s;
  }

  return {
    t,
    setLang: (l) => { LANG = l; },
    getLang: () => LANG,
    name: (id) => NAMES[LANG][id] || NAMES.es[id] || id,
    portrait: (id) => "portrait_" + id
  };
})();

if (typeof module !== "undefined") module.exports = I18N;
