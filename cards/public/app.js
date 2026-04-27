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
