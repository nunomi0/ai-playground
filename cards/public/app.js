import { createGame, play, SUIT_BY_ID, MAX_TURNS } from "./game.js";

const boardEl = document.querySelector("#board");
const handEl = document.querySelector("#hand");
const scoreEl = document.querySelector("#score");
const turnEl = document.querySelector("#turn");
const deckEl = document.querySelector("#deck");
const promptEl = document.querySelector("#prompt");
const toastWrap = document.querySelector("#toast-wrap");
const overlay = document.querySelector("#overlay");
const finalScoreEl = document.querySelector("#final-score");
const finalHintEl = document.querySelector("#final-hint");
const restartBtn = document.querySelector("#restart");
const introOverlay = document.querySelector("#intro-overlay");
const introEyebrowEl = document.querySelector("#intro-eyebrow");
const introTitleEl = document.querySelector("#intro-title");
const introTaglineEl = document.querySelector("#intro-tagline");
const introRulesEl = document.querySelector("#intro-rules");
const introFootEl = document.querySelector("#intro-foot");
const introStartBtn = document.querySelector("#intro-start");
const langSwitchEl = document.querySelector("#lang-switch");

const I18N = {
  en: {
    label: "EN",
    eyebrow: "How to play",
    title: "Prism Trio",
    tagline: "Match holographic cards by hue, rank, or sum.",
    rules: [
      ["Prism", "same suit + same rank → rank × 5"],
      ["Hue", "same suit → rank × 3"],
      ["Twin", "same rank → rank × 3"],
      ["Bond", "ranks sum to 10 → +20"],
      ["Mismatch", "none of the above → −3"],
    ],
    foot: "10 turns. Cards refill from a 36-card deck.",
    start: "Start",
  },
  ko: {
    label: "한국어",
    eyebrow: "게임 방법",
    title: "프리즘 트리오",
    tagline: "색상, 숫자, 합으로 홀로그램 카드를 맞추세요.",
    rules: [
      ["프리즘", "같은 무늬 + 같은 숫자 → 숫자 × 5"],
      ["휴", "같은 무늬 → 숫자 × 3"],
      ["트윈", "같은 숫자 → 숫자 × 3"],
      ["본드", "두 숫자의 합이 10 → +20"],
      ["미스매치", "위 어디에도 해당 없음 → −3"],
    ],
    foot: "총 10턴. 카드는 36장 덱에서 보충됩니다.",
    start: "시작",
  },
  ja: {
    label: "日本語",
    eyebrow: "遊び方",
    title: "プリズム・トリオ",
    tagline: "色・数字・合計でホログラムカードを揃えよう。",
    rules: [
      ["プリズム", "同じ色 + 同じ数字 → 数字 × 5"],
      ["ヒュー", "同じ色 → 数字 × 3"],
      ["ツイン", "同じ数字 → 数字 × 3"],
      ["ボンド", "数字の合計が10 → +20"],
      ["ミスマッチ", "上記いずれでもない → −3"],
    ],
    foot: "全10ターン。カードは36枚のデッキから補充されます。",
    start: "スタート",
  },
};

function detectLanguage() {
  const candidates = [];
  if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
  if (navigator.language) candidates.push(navigator.language);
  for (const tag of candidates) {
    const code = String(tag).toLowerCase().split("-")[0];
    if (I18N[code]) return code;
  }
  return "en";
}

let currentLang = detectLanguage();

function renderIntro() {
  const t = I18N[currentLang];
  introEyebrowEl.textContent = t.eyebrow;
  introTitleEl.textContent = t.title;
  introTaglineEl.textContent = t.tagline;
  introFootEl.textContent = t.foot;
  introStartBtn.textContent = t.start;
  introRulesEl.innerHTML = "";
  for (const [name, desc] of t.rules) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = name;
    li.append(strong, document.createTextNode(` · ${desc}`));
    introRulesEl.append(li);
  }
  for (const button of langSwitchEl.querySelectorAll("button")) {
    const isActive = button.dataset.lang === currentLang;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  }
}

function buildLangSwitch() {
  langSwitchEl.innerHTML = "";
  for (const code of Object.keys(I18N)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.lang = code;
    button.textContent = I18N[code].label;
    button.setAttribute("role", "tab");
    button.addEventListener("click", () => {
      currentLang = code;
      renderIntro();
    });
    langSwitchEl.append(button);
  }
}

introStartBtn.addEventListener("click", () => {
  introOverlay.hidden = true;
});

buildLangSwitch();
renderIntro();

let state = createGame();
let selectedHandIndex = null;

function buildCard(card, role, index) {
  const suit = SUIT_BY_ID[card.suit];
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-3d";
  button.style.setProperty("--hue", String(suit.hue));
  button.dataset.role = role;
  button.dataset.index = String(index);
  button.setAttribute(
    "aria-label",
    `${suit.label} ${card.rank}${role === "hand" ? " (in hand)" : " (challenge)"}`,
  );
  button.innerHTML = `
    <div class="face">
      <div class="corner top">
        <span class="rank">${card.rank}</span>
        <span class="glyph" aria-hidden="true">${suit.glyph}</span>
      </div>
      <div class="center" aria-hidden="true">${suit.glyph}</div>
      <div class="corner bottom">
        <span class="rank">${card.rank}</span>
        <span class="glyph" aria-hidden="true">${suit.glyph}</span>
      </div>
    </div>
  `;
  attachTilt(button);
  return button;
}

function attachTilt(el) {
  const handleMove = (event) => {
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));
    const rx = (0.5 - clampedY) * 18;
    const ry = (clampedX - 0.5) * 22;
    el.style.setProperty("--mx", `${(clampedX * 100).toFixed(2)}%`);
    el.style.setProperty("--my", `${(clampedY * 100).toFixed(2)}%`);
    el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
    el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
  };
  const handleLeave = () => {
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");
  };
  el.addEventListener("pointermove", handleMove);
  el.addEventListener("pointerleave", handleLeave);
  el.addEventListener("blur", handleLeave);
}

function render() {
  scoreEl.textContent = String(state.score);
  turnEl.textContent = `${Math.min(state.turn, MAX_TURNS)} / ${MAX_TURNS}`;
  deckEl.textContent = String(state.deck.length);

  boardEl.innerHTML = "";
  state.board.forEach((card, idx) => {
    const el = buildCard(card, "board", idx);
    if (selectedHandIndex !== null) {
      el.classList.add("target-hint");
    }
    el.addEventListener("click", () => onBoardClick(idx));
    boardEl.append(el);
  });

  handEl.innerHTML = "";
  state.hand.forEach((card, idx) => {
    const el = buildCard(card, "hand", idx);
    if (idx === selectedHandIndex) {
      el.classList.add("selected");
    }
    el.addEventListener("click", () => onHandClick(idx));
    handEl.append(el);
  });

  if (state.over) {
    promptEl.textContent = "Round complete.";
  } else if (selectedHandIndex === null) {
    promptEl.textContent = "Pick a card from your hand.";
  } else {
    promptEl.textContent = "Now choose a challenge card to match.";
  }
}

function onHandClick(idx) {
  if (state.over) return;
  selectedHandIndex = selectedHandIndex === idx ? null : idx;
  render();
}

function onBoardClick(boardIdx) {
  if (state.over) return;
  if (selectedHandIndex === null) {
    promptEl.textContent = "Pick a hand card first.";
    return;
  }
  const handIdx = selectedHandIndex;
  selectedHandIndex = null;
  state = play(state, handIdx, boardIdx);
  const lastEntry = state.log[0];
  if (lastEntry) flashToast(lastEntry.result);
  render();
  if (state.over) finishGame();
}

function flashToast(result) {
  const el = document.createElement("div");
  el.className = `toast ${result.kind}`;
  const sign = result.points >= 0 ? "+" : "";
  el.textContent = `${result.label} · ${sign}${result.points}`;
  toastWrap.append(el);
  setTimeout(() => el.remove(), 1700);
}

function finishGame() {
  finalScoreEl.textContent = String(state.score);
  if (state.score >= 100) {
    finalHintEl.textContent = "Brilliant prism.";
  } else if (state.score >= 60) {
    finalHintEl.textContent = "Solid run.";
  } else if (state.score >= 30) {
    finalHintEl.textContent = "A flicker of light.";
  } else {
    finalHintEl.textContent = "The deck was cruel. Try again.";
  }
  overlay.hidden = false;
}

restartBtn.addEventListener("click", () => {
  state = createGame();
  selectedHandIndex = null;
  overlay.hidden = true;
  render();
});

render();
