// app.js (repo root)
// Wires UI (index.html) to engine (src/game/battleEngine.js) + data (data/*.json)

import {
  createFighter,
  awardXP,
  basicAttack,
  heavyAttack,
  heal as healAbility,
  shield as shieldAbility,
  resolveRound,
  isDefeated,
} from "./src/game/battleEngine.js";

const els = {
  modeSelect: document.getElementById("modeSelect"),
  startBtn: document.getElementById("startBtn"),
  speakBtn: document.getElementById("speakBtn"),
  promptTitle: document.getElementById("promptTitle"),
  promptSub: document.getElementById("promptSub"),
  promptMain: document.getElementById("promptMain"),
  choices: document.getElementById("choices"),
  log: document.getElementById("log"),

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
};

const state = {
  player: createFighter("Player", false),
  bot: createFighter("WordBot", true),
  roundActive: false,
  correctAnswer: null,
  currentPromptToSpeak: null,
  wordBank: null,
  mathBank: null,
};

function setLog(msg) {
  els.log.textContent = msg;
}

function pct(n, max) {
  return `${Math.max(0, Math.min(100, Math.round((n / max) * 100)))}%`;
}

function renderBars() {
  // HP
  els.pHpBar.style.width = pct(state.player.hp, state.player.maxHp);
  els.pHpText.textContent = `${state.player.hp} / ${state.player.maxHp}`;
  els.bHpBar.style.width = pct(state.bot.hp, state.bot.maxHp);
  els.bHpText.textContent = `${state.bot.hp} / ${state.bot.maxHp}`;

  // XP (battle XP - show up to 30 for now)
  els.pXpBar.style.width = pct(state.player.battleXP, 30);
  els.pXpText.textContent = `${state.player.battleXP} XP`;
  els.bXpBar.style.width = pct(state.bot.battleXP, 30);
  els.bXpText.textContent = `${state.bot.battleXP} XP`;

  // Shields
  els.pShieldText.textContent = state.player.shield > 0 ? `Shield: ${state.player.shield}` : "";
  els.bShieldText.textContent = state.bot.shield > 0 ? `Shield: ${state.bot.shield}` : "";
}

function resetRoundUI() {
  els.choices.innerHTML = "";
  els.promptMain.textContent = "Press Start";
  state.correctAnswer = null;
  state.currentPromptToSpeak = null;
  state.roundActive = false;
}

function speak(text) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function pickRandom(arr) {
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

function makeChoices(correct, all) {
  const wrongs = shuffle(all.filter(x => x !== correct)).slice(0, 3);
  return shuffle([correct, ...wrongs]);
}

function makeMathRound(bank) {
  // bank.items = [{ q: "7 + 8", a: "15" }, ...]
  const item = pickRandom(bank.items);
  const correct = item.a;
  const allAnswers = bank.items.map(i => i.a);
  const choices = makeChoices(correct, allAnswers);
  return { prompt: item.q, correct, choices, speakText: item.q };
}

function makeWordRound(bank) {
  // bank.words = ["clinical", ...]
  const correct = pickRandom(bank.words);
  const choices = makeChoices(correct, bank.words);
  // Listen & Tap: we SPEAK the correct word, and show 4 word choices
  return { prompt: "Listen & Choose", correct, choices, speakText: correct };
}

async function loadData() {
  // These must match your data file names
  const [words, math] = await Promise.all([
    fetch("./data/words_grade3.json").then(r => r.json()),
    fetch("./data/math_grade3.json").then(r => r.json()),
  ]);
  state.wordBank = words;
  state.mathBank = math;
  setLog("Loaded Grade 3 content.");
}

function endIfGameOver() {
  if (isDefeated(state.player)) {
    setLog("You lost! Refresh to play again.");
    els.startBtn.disabled = true;
    state.roundActive = false;
    return true;
  }
  if (isDefeated(state.bot)) {
    setLog("You won! Refresh to play again.");
    els.startBtn.disabled = true;
    state.roundActive = false;
    return true;
  }
  return false;
}

function botAttemptAnswer(correct) {
  // Timer-based “AI”: reaction speed depends on mode + random jitter
  // Faster = harder. For MVP, keep it moderate.
  const base = els.modeSelect.value === "math" ? 950 : 850;
  const jitter = Math.random() * 550; // 0–550ms
  const willBeCorrect = Math.random() < 0.75; // bot accuracy
  const delay = base + jitter;

  setTimeout(() => {
    if (!state.roundActive) return;

    if (willBeCorrect) {
      // Bot wins round
      state.roundActive = false;
      resolveRound(state.bot, state.player);
      setLog("Bot was first! +3 XP for bot, you take 5 damage.");
      renderBars();
      endIfGameOver();
    } else {
      // Bot “misses” (does nothing). Player can still answer.
    }
  }, delay);
}

function onPlayerChoice(btn, value) {
  if (!state.roundActive) return;

  const correct = state.correctAnswer;

  if (value === correct) {
    state.roundActive = false;
    btn.classList.add("correct");
    resolveRound(state.player, state.bot);
    setLog("You were first! +3 XP for you, bot takes 5 damage.");
    renderBars();
    endIfGameOver();
  } else {
    btn.classList.add("wrong");
    setLog("Wrong! Keep trying fast.");
  }
}

function renderRound(round) {
  els.promptTitle.textContent = els.modeSelect.value === "math" ? "Math Battle" : "Listen & Tap";
  els.promptSub.textContent = "First correct answer wins the round and earns XP.";
  els.promptMain.textContent = round.prompt;

  state.correctAnswer = round.correct;
  state.currentPromptToSpeak = round.speakText;

  els.choices.innerHTML = "";
  round.choices.forEach(choice => {
    const b = document.createElement("button");
    b.className = "choice";
    b.textContent = choice;
    b.addEventListener("click", () => onPlayerChoice(b, choice));
    els.choices.appendChild(b);
  });

  // Auto-speak at start of round for reading mode
  if (els.modeSelect.value === "words") {
    speak(round.speakText);
  }
}

function startRound() {
  if (!state.wordBank || !state.mathBank) {
    setLog("Loading… try again in a moment.");
    return;
  }
  if (endIfGameOver()) return;

  state.roundActive = true;

  const round = els.modeSelect.value === "math"
    ? makeMathRound(state.mathBank)
    : makeWordRound(state.wordBank);

  renderRound(round);
  botAttemptAnswer(round.correct);
}

function wireAbilities() {
  document.querySelectorAll(".ability").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.ability;

      let ok = false;
      if (type === "basic") ok = basicAttack(state.player, state.bot);
      if (type === "heavy") ok = heavyAttack(state.player, state.bot);
      if (type === "shield") ok = shieldAbility(state.player);
      if (type === "heal") ok = healAbility(state.player);

      if (!ok) {
        setLog("Not enough XP for that ability.");
      } else {
        setLog(`Used ${type}!`);
      }

      renderBars();
      endIfGameOver();
    });
  });
}

// Buttons
els.startBtn.addEventListener("click", startRound);
els.speakBtn.addEventListener("click", () => speak(state.currentPromptToSpeak));
els.modeSelect.addEventListener("change", () => {
  resetRoundUI();
  setLog("Mode changed. Press Start Round.");
});

// Init
wireAbilities();
renderBars();
resetRoundUI();
loadData();
