// app.js
// Word Battle MVP (Polished UI + Home screen + Reliable clicks)
// Uses: ./src/game/battleEngine.js and JSON in /data

import { createInitialState, spendXpOnAbility, applyAbility } from "./src/game/battleEngine.js";

const els = {
  // screens
  homeScreen: document.getElementById("homeScreen"),
  battleScreen: document.getElementById("battleScreen"),

  // top
  modeSelect: document.getElementById("modeSelect"),
  homeBtn: document.getElementById("homeBtn"),

  // home buttons
  goBattle: document.getElementById("goBattle"),
  goLoadout: document.getElementById("goLoadout"),
  goShop: document.getElementById("goShop"),
  goRanks: document.getElementById("goRanks"),
  goPractice: document.getElementById("goPractice"),
  goQuests: document.getElementById("goQuests"),

  // home stats
  statWins: document.getElementById("statWins"),
  statWords: document.getElementById("statWords"),
  statCoins: document.getElementById("statCoins"),
  statGems: document.getElementById("statGems"),

  // battle HUD
  pHpBar: document.getElementById("pHpBar"),
  pHpText: document.getElementById("pHpText"),
  pXpBar: document.getElementById("pXpBar"),
  pXpText: document.getElementById("pXpText"),
  pShieldText: document.getElementById("pShieldText"),

  bHpBar: document.getElementById("bHpBar"),
  bHpText: document.getElementById("bHpText"),
  bXpBar: document.getElementById("bXpBar"),
  bXpText: document.getElementById("bXpText"),
  bShieldText: document.getElementById("bShieldText"),

  // battle prompt
  promptTitle: document.getElementById("promptTitle"),
  promptSub: document.getElementById("promptSub"),
  promptMain: document.getElementById("promptMain"),
  choices: document.getElementById("choices"),
  startBtn: document.getElementById("startBtn"),
  speakBtn: document.getElementById("speakBtn"),
  toast: document.getElementById("toast"),
  log: document.getElementById("log"),

  // abilities
  abilityButtons: Array.from(document.querySelectorAll(".ability")),
};

// ------------------------
// State
// ------------------------

let state = createInitialState();
state.roundActive = false;
state.correctAnswer = null;
state.currentChoices = [];
state.currentPrompt = "";

// simple lifetime stats (local-only)
let meta = {
  wins: 0,
  words: 0,
  coins: 0,
  gems: 0,
};

// cached data
let WORDS = [];
let MATH = [];

// ------------------------
// UI helpers
// ------------------------

function showHome() {
  els.homeScreen?.classList.remove("hidden");
  els.battleScreen?.classList.add("hidden");
}

function showBattle() {
  els.homeScreen?.classList.add("hidden");
  els.battleScreen?.classList.remove("hidden");
}

function setLog(msg) {
  if (!els.log) return;
  els.log.textContent = msg || "";
}

function setToast(msg, type) {
  if (!els.toast) return;
  els.toast.textContent = msg || "";
  els.toast.className = "toast " + (type || "");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pct(current, max) {
  if (!max) return 0;
  return clamp((current / max) * 100, 0, 100);
}

// ------------------------
// Data loading
// ------------------------

async function loadData() {
  // NOTE: filenames must match exactly:
  // /data/words_grade3.json and /data/math_grade3.json
  const [wordsRes, mathRes] = await Promise.all([
    fetch("./data/words_grade3.json"),
    fetch("./data/math_grade3.json"),
  ]);

  if (!wordsRes.ok) throw new Error("Could not load ./data/words_grade3.json");
  if (!mathRes.ok) throw new Error("Could not load ./data/math_grade3.json");

  const wordsJson = await wordsRes.json();
  const mathJson = await mathRes.json();

  WORDS = Array.isArray(wordsJson?.words) ? wordsJson.words : [];
  MATH = Array.isArray(mathJson?.problems) ? mathJson.problems : [];
}

// ------------------------
// Rendering
// ------------------------

function renderHomeStats() {
  if (els.statWins) els.statWins.textContent = String(meta.wins);
  if (els.statWords) els.statWords.textContent = String(meta.words);
  if (els.statCoins) els.statCoins.textContent = String(meta.coins);
  if (els.statGems) els.statGems.textContent = String(meta.gems);
}

function renderBars() {
  // Player
  if (els.pHpBar) els.pHpBar.style.width = pct(state.player.hp, state.player.maxHp) + "%";
  if (els.pHpText) els.pHpText.textContent = `${state.player.hp} / ${state.player.maxHp}`;
  if (els.pXpBar) els.pXpBar.style.width = pct(state.player.xp, state.player.maxXp) + "%";
  if (els.pXpText) els.pXpText.textContent = `${state.player.xp} XP`;
  if (els.pShieldText) els.pShieldText.textContent = state.player.shield > 0 ? `Shield: ${state.player.shield}` : "";

  // Bot
  if (els.bHpBar) els.bHpBar.style.width = pct(state.bot.hp, state.bot.maxHp) + "%";
  if (els.bHpText) els.bHpText.textContent = `${state.bot.hp} / ${state.bot.maxHp}`;
  if (els.bXpBar) els.bXpBar.style.width = pct(state.bot.xp, state.bot.maxXp) + "%";
  if (els.bXpText) els.bXpText.textContent = `${state.bot.xp} XP`;
  if (els.bShieldText) els.bShieldText.textContent = state.bot.shield > 0 ? `Shield: ${state.bot.shield}` : "";
}

function renderChoices() {
  if (!els.choices) return;
  els.choices.innerHTML = "";

  state.currentChoices.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = c;
    btn.addEventListener("click", () => onPlayerChoice(btn, c));
    els.choices.appendChild(btn);
  });
}

function renderPrompt() {
  if (!els.promptMain) return;
  els.promptMain.textContent = state.currentPrompt || "Ready?";
}

function setModeText() {
  const mode = els.modeSelect?.value || "words";
  if (!els.promptTitle || !els.promptSub) return;

  if (mode === "math") {
    els.promptTitle.textContent = "Math Battle";
    els.promptSub.textContent = "First correct answer wins the round.";
  } else {
    els.promptTitle.textContent = "Listen & Tap";
    els.promptSub.textContent = "First correct answer wins the round.";
  }
}

// ------------------------
// Game loop
// ------------------------

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRound() {
  const mode = els.modeSelect?.value || "words";

  if (mode === "math") {
    const p = randomPick(MATH);
    // p = { question, choices[], answer }
    state.currentPrompt = p?.question || "Solve:";
    state.correctAnswer = String(p?.answer ?? "");
    state.currentChoices = Array.isArray(p?.choices) ? p.choices.map(String) : [];
    // guarantee 4 choices
    if (state.currentChoices.length < 4) {
      const fill = ["1", "2", "3", "4", "5", "6"];
      while (state.currentChoices.length < 4) state.currentChoices.push(randomPick(fill));
      state.currentChoices = shuffle(state.currentChoices).slice(0, 4);
    }
  } else {
    // words mode
    const correct = randomPick(WORDS);
    const pool = WORDS.filter((w) => w !== correct);
    const wrongs = shuffle(pool).slice(0, 3);
    const choices = shuffle([correct, ...wrongs]);

    state.currentPrompt = "Listen & Choose";
    state.correctAnswer = correct;
    state.currentChoices = choices;
  }

  renderPrompt();
  renderChoices();
}

// Make bot deliberately slower so your clicks always register
function botAttemptAnswer() {
  // slower for MVP
  const base = (els.modeSelect?.value || "words") === "math" ? 1400 : 1200;
  const jitter = Math.random() * 900; // 0–900ms
  const willBeCorrect = Math.random() < 0.70;
  const delay = base + jitter;

  setTimeout(() => {
    if (!state.roundActive) return;
    if (!willBeCorrect) return;

    state.roundActive = false;
    resolveRound(state.bot, state.player);
    setToast("Bot was first!", "bad");
    setLog("Bot was first: +3 XP bot, you take 5 damage.");
    renderBars();
    endIfGameOver();
  }, delay);
}

function resolveRound(winner, loser) {
  // simple MVP: winner gets 3 XP, loser takes 5 damage
  winner.xp = clamp(winner.xp + 3, 0, winner.maxXp);

  let dmg = 5;
  // shield absorbs
  if (loser.shield > 0) {
    const absorbed = Math.min(loser.shield, dmg);
    loser.shield -= absorbed;
    dmg -= absorbed;
  }
  loser.hp = clamp(loser.hp - dmg, 0, loser.maxHp);
}

function endIfGameOver() {
  if (state.player.hp <= 0) {
    setToast("You lost the match.", "bad");
    setLog("Defeat. Click Home to try again.");
    state.roundActive = false;
  }
  if (state.bot.hp <= 0) {
    meta.wins += 1;
    meta.coins += 10; // tiny reward
    renderHomeStats();
    setToast("You won the match!", "good");
    setLog("Victory! +10 coins. (MVP reward)");
    state.roundActive = false;
  }
}

function startRound() {
  // reset round UI feedback
  setToast("", "");
  setLog("");
  state.roundActive = true;

  // build new prompt
  generateRound();

  // start bot timer
  botAttemptAnswer();
}

function onPlayerChoice(btn, value) {
  if (!state.roundActive) {
    setToast("Round already ended. Start next round.", "bad");
    return;
  }

  const correct = state.correctAnswer;

  if (String(value) === String(correct)) {
    state.roundActive = false;
    btn.classList.add("correct");

    // count "words solved" (for home stats)
    if ((els.modeSelect?.value || "words") === "words") meta.words += 1;

    resolveRound(state.player, state.bot);
    setToast("You were first!", "good");
    setLog("You were first: +3 XP you, bot takes 5 damage.");
    renderBars();
    renderHomeStats();
    endIfGameOver();
  } else {
    btn.classList.add("wrong");
    setToast("Wrong!", "bad");
    setLog("Wrong answer. Try again fast.");
  }
}

function speakCurrent() {
  const mode = els.modeSelect?.value || "words";

  try {
    if (!("speechSynthesis" in window)) {
      setToast("Speech not supported on this device.", "bad");
      return;
    }

    let toSpeak = "";
    if (mode === "math") {
      toSpeak = state.currentPrompt || "Solve the problem";
    } else {
      // Speak the correct answer as the “word spoken”
      toSpeak = state.correctAnswer || "Ready";
    }

    const u = new SpeechSynthesisUtterance(toSpeak);
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    setToast("Could not use speech on this browser.", "bad");
  }
}

function onAbilityClick(abilityKey) {
  const costOk = spendXpOnAbility(state.player, abilityKey);
  if (!costOk) {
    setToast("Not enough XP for that ability.", "bad");
    setLog("Earn XP by winning rounds.");
    renderBars();
    return;
  }

  applyAbility(state, "player", abilityKey);
  setToast(`Used: ${abilityKey.toUpperCase()}`, "good");
  setLog(`Ability used: ${abilityKey}`);
  renderBars();
}

// ------------------------
// Wire up events
// ------------------------

function wireEvents() {
  els.startBtn?.addEventListener("click", startRound);
  els.speakBtn?.addEventListener("click", speakCurrent);

  els.modeSelect?.addEventListener("change", () => {
    setModeText();
    setToast("", "");
    setLog("");
    state.roundActive = false;
    state.currentPrompt = "Ready?";
    state.currentChoices = [];
    state.correctAnswer = null;
    renderPrompt();
    if (els.choices) els.choices.innerHTML = "";
  });

  els.abilityButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-ability");
      if (key) onAbilityClick(key);
    });
  });

  // navigation
  els.homeBtn?.addEventListener("click", showHome);
  els.goBattle?.addEventListener("click", () => {
    showBattle();
    setModeText();
    renderBars();
    setToast("", "");
    setLog("Click Start Round to begin.");
  });

  // placeholders (for showstopper next steps)
  els.goLoadout?.addEventListener("click", () => setToast("Loadout screen coming next.", ""));
  els.goShop?.addEventListener("click", () => setToast("Shop screen coming next.", ""));
  els.goRanks?.addEventListener("click", () => setToast("Leaderboard coming next.", ""));
  els.goPractice?.addEventListener("click", () => setToast("Practice mode coming next.", ""));
  els.goQuests?.addEventListener("click", () => setToast("Quests coming next.", ""));
}

// ------------------------
// Init
// ------------------------

async function init() {
  try {
    await loadData();
  } catch (e) {
    console.error(e);
    setToast("Could not load word/math data. Check filenames in /data.", "bad");
    setLog(String(e?.message || e));
  }

  wireEvents();
  setModeText();
  renderBars();
  renderHomeStats();
  showHome();
}

init();
