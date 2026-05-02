import { createGame, play, SUIT_BY_ID, MAX_TURNS, TOTAL_CARDS } from "./game.js";
import {
  createLeaderboardEntry,
  fromSupabaseRow,
  isSupabaseEnabled,
  LEADERBOARD_LIMIT,
  sortLeaderboard,
  toSupabaseRow,
} from "./leaderboard.js";

const boardEl = document.querySelector("#board");
const handEl = document.querySelector("#hand");
const scoreEl = document.querySelector("#score");
const bestScoreEl = document.querySelector("#best-score");
const turnEl = document.querySelector("#turn");
const deckEl = document.querySelector("#deck");
const promptEl = document.querySelector("#prompt");
const toastWrap = document.querySelector("#toast-wrap");
const overlay = document.querySelector("#overlay");
const finalScoreEl = document.querySelector("#final-score");
const finalHintEl = document.querySelector("#final-hint");
const restartBtn = document.querySelector("#restart");
const saveScoreForm = document.querySelector("#save-score-form");
const savePlayerNameEl = document.querySelector("#save-player-name");
const saveScoreButton = document.querySelector("#save-score-button");
const saveFeedbackEl = document.querySelector("#save-feedback");
const leaderboardListEl = document.querySelector("#leaderboard-list");
const leaderboardEmptyEl = document.querySelector("#leaderboard-empty");
const introOverlay = document.querySelector("#intro-overlay");
const introEyebrowEl = document.querySelector("#intro-eyebrow");
const introTitleEl = document.querySelector("#intro-title");
const introTaglineEl = document.querySelector("#intro-tagline");
const introRulesEl = document.querySelector("#intro-rules");
const introFootEl = document.querySelector("#intro-foot");
const introStartBtn = document.querySelector("#intro-start");
const langSwitchEl = document.querySelector("#lang-switch");

const PLAYER_NAME_STORAGE_KEY = "prism-trio-player-name-v1";
const SHARED_LEADERBOARD_MESSAGE =
  "Set PRISM_TRIO_SUPABASE_URL and PRISM_TRIO_SUPABASE_ANON_KEY to enable the shared leaderboard.";
const LEADERBOARD_TABLE = "prism_trio_scores";
const LEADERBOARD_SELECT = "id,player_name,score,source,created_at,client_id";
const supabaseConfig = globalThis.__PRISM_TRIO_SUPABASE__ ?? {};

const MATCH_SOUND_PRESETS = {
  perfect: [
    { frequency: 523.25, offset: 0, duration: 0.22, gain: 0.06, type: "triangle" },
    { frequency: 659.25, offset: 0.06, duration: 0.24, gain: 0.05, type: "triangle" },
    { frequency: 783.99, offset: 0.12, duration: 0.26, gain: 0.04, type: "sine" },
  ],
  bond: [
    { frequency: 392, offset: 0, duration: 0.16, gain: 0.06, type: "sine" },
    { frequency: 523.25, offset: 0.08, duration: 0.2, gain: 0.05, type: "triangle" },
  ],
  hue: [
    { frequency: 349.23, offset: 0, duration: 0.14, gain: 0.055, type: "sine" },
    { frequency: 440, offset: 0.05, duration: 0.18, gain: 0.04, type: "triangle" },
  ],
  twin: [
    { frequency: 329.63, offset: 0, duration: 0.16, gain: 0.05, type: "square" },
    { frequency: 392, offset: 0.06, duration: 0.16, gain: 0.035, type: "square" },
  ],
  mismatch: [{ frequency: 196, offset: 0, duration: 0.14, gain: 0.045, type: "sawtooth" }],
};

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
    foot: `10 turns. Cards refill from a mirrored ${TOTAL_CARDS}-card deck.`,
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
    foot: `총 10턴. 카드는 ${TOTAL_CARDS}장 미러 덱에서 보충됩니다.`,
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
    foot: `全10ターン。カードは${TOTAL_CARDS}枚のミラーデッキから補充されます。`,
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

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadStoredPlayerName() {
  const storage = getStorage();
  if (!storage) return "";

  const name = storage.getItem(PLAYER_NAME_STORAGE_KEY);
  return typeof name === "string" ? name.trim() : "";
}

function rememberPlayerName(name) {
  const storage = getStorage();
  const trimmed = String(name ?? "").trim();
  if (!storage || !trimmed) return;

  try {
    storage.setItem(PLAYER_NAME_STORAGE_KEY, trimmed);
  } catch {
    // Ignore storage write failures and keep the name in-memory only.
  }
}

function formatEntryDate(recordedAt) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(recordedAt));
}

function setFeedback(el, message, isError = false) {
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function canUseSharedLeaderboard() {
  return isSupabaseEnabled(supabaseConfig);
}

function buildSupabaseUrl(pathname, searchParams) {
  const url = new URL(pathname, supabaseConfig.supabaseUrl);
  if (searchParams) {
    url.search = searchParams.toString();
  }
  return url.toString();
}

function getSupabaseHeaders({ includeJson = false } = {}) {
  const headers = {
    apikey: supabaseConfig.supabaseAnonKey,
    Authorization: `Bearer ${supabaseConfig.supabaseAnonKey}`,
  };

  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function fetchSupabaseLeaderboard() {
  const params = new URLSearchParams({
    select: LEADERBOARD_SELECT,
    order: "score.desc,created_at.desc",
    limit: String(LEADERBOARD_LIMIT),
  });

  const response = await fetch(
    buildSupabaseUrl(`/rest/v1/${LEADERBOARD_TABLE}`, params),
    {
      headers: getSupabaseHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error("Couldn't load shared scores from Supabase.");
  }

  const rows = await response.json();
  return sortLeaderboard(rows.map((row) => fromSupabaseRow(row)).filter(Boolean)).slice(
    0,
    LEADERBOARD_LIMIT,
  );
}

async function insertSupabaseScore(entry) {
  const row = toSupabaseRow(entry);
  const response = await fetch(
    buildSupabaseUrl(`/rest/v1/${LEADERBOARD_TABLE}`),
    {
      method: "POST",
      headers: {
        ...getSupabaseHeaders({ includeJson: true }),
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    },
  );

  if (!response.ok) {
    throw new Error("Supabase rejected that score.");
  }

  const rows = await response.json();
  return fromSupabaseRow(rows[0]);
}

let currentLang = detectLanguage();
let state = createGame();
let selectedHandIndex = null;
let scoreSavedForRound = false;
let roundSavePending = false;
let audioContext = null;
let leaderboardState = {
  status: canUseSharedLeaderboard() ? "loading" : "unconfigured",
  message: canUseSharedLeaderboard()
    ? "Loading shared scores..."
    : SHARED_LEADERBOARD_MESSAGE,
  entries: [],
};

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

function getAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext) audioContext = new AudioCtor();
  return audioContext;
}

async function playMatchSound(result) {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      return;
    }
  }

  const voices = MATCH_SOUND_PRESETS[result.kind] ?? MATCH_SOUND_PRESETS.mismatch;
  const startTime = context.currentTime;

  for (const voice of voices) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = startTime + voice.offset;
    const noteEnd = noteStart + voice.duration;

    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(voice.frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.linearRampToValueAtTime(voice.gain, noteStart + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
  }
}

function hydratePlayerInputs() {
  const name = loadStoredPlayerName();
  if (!savePlayerNameEl.value) savePlayerNameEl.value = name;
}

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

function syncLeaderboardControls() {
  const ready = canUseSharedLeaderboard();
  saveScoreButton.disabled = !ready || scoreSavedForRound || roundSavePending;
}

function renderLeaderboard() {
  const entries = leaderboardState.entries;

  leaderboardListEl.innerHTML = "";
  bestScoreEl.textContent = entries[0] ? String(entries[0].score) : "—";

  if (leaderboardState.status === "ready" && entries.length === 0) {
    leaderboardEmptyEl.hidden = false;
    leaderboardEmptyEl.textContent = "No scores saved yet.";
  } else if (leaderboardState.status === "ready") {
    leaderboardEmptyEl.hidden = true;
    leaderboardEmptyEl.textContent = "";
  } else {
    leaderboardEmptyEl.hidden = false;
    leaderboardEmptyEl.textContent = leaderboardState.message;
  }

  entries.forEach((entry, index) => {
    const li = document.createElement("li");
    li.className = "leaderboard-item";

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = `#${index + 1}`;

    const main = document.createElement("div");
    main.className = "leaderboard-main";

    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = entry.name;

    const meta = document.createElement("span");
    meta.className = "leaderboard-meta";
    meta.textContent = `run · ${formatEntryDate(entry.recordedAt)}`;

    main.append(name, meta);

    const score = document.createElement("span");
    score.className = "leaderboard-score";
    score.textContent = String(entry.score);

    li.append(rank, main, score);
    leaderboardListEl.append(li);
  });

  syncLeaderboardControls();
}

async function refreshLeaderboard() {
  if (!canUseSharedLeaderboard()) {
    leaderboardState = {
      status: "unconfigured",
      message: SHARED_LEADERBOARD_MESSAGE,
      entries: [],
    };
    renderLeaderboard();
    return;
  }

  leaderboardState = {
    ...leaderboardState,
    status: "loading",
    message:
      leaderboardState.entries.length > 0 ? "Refreshing shared scores..." : "Loading shared scores...",
  };
  renderLeaderboard();

  try {
    const entries = await fetchSupabaseLeaderboard();
    leaderboardState = {
      status: "ready",
      message: "",
      entries,
    };
  } catch (error) {
    leaderboardState = {
      status: "error",
      message: error instanceof Error ? error.message : "Couldn't load shared scores.",
      entries: leaderboardState.entries,
    };
  }

  renderLeaderboard();
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

  renderLeaderboard();
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
  if (lastEntry) {
    flashToast(lastEntry.result);
    void playMatchSound(lastEntry.result);
  }
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

  hydratePlayerInputs();
  if (!scoreSavedForRound) {
    setFeedback(
      saveFeedbackEl,
      canUseSharedLeaderboard() ? "" : SHARED_LEADERBOARD_MESSAGE,
      !canUseSharedLeaderboard(),
    );
  }
  syncLeaderboardControls();
  overlay.hidden = false;
}

async function saveEntry(input, feedbackEl) {
  if (!canUseSharedLeaderboard()) {
    setFeedback(feedbackEl, SHARED_LEADERBOARD_MESSAGE, true);
    return false;
  }

  const entry = createLeaderboardEntry(input);
  rememberPlayerName(entry.name);
  savePlayerNameEl.value = entry.name;
  roundSavePending = true;
  syncLeaderboardControls();
  setFeedback(feedbackEl, "Saving to the shared leaderboard...");

  try {
    const inserted = await insertSupabaseScore(entry);
    leaderboardState = {
      status: "ready",
      message: "",
      entries: sortLeaderboard([...leaderboardState.entries, inserted]).slice(0, LEADERBOARD_LIMIT),
    };

    scoreSavedForRound = true;
    setFeedback(feedbackEl, "Saved to the shared leaderboard.");

    renderLeaderboard();
    await refreshLeaderboard();
    return true;
  } catch (error) {
    setFeedback(
      feedbackEl,
      error instanceof Error ? error.message : "Couldn't save that score.",
      true,
    );
    return false;
  } finally {
    roundSavePending = false;
    syncLeaderboardControls();
  }
}

saveScoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (scoreSavedForRound) {
    setFeedback(saveFeedbackEl, "This round is already saved.");
    return;
  }

  await saveEntry(
    {
      name: savePlayerNameEl.value,
      score: state.score,
      source: "round",
    },
    saveFeedbackEl,
  );
});

restartBtn.addEventListener("click", () => {
  state = createGame();
  selectedHandIndex = null;
  scoreSavedForRound = false;
  roundSavePending = false;
  overlay.hidden = true;
  setFeedback(saveFeedbackEl, "");
  hydratePlayerInputs();
  render();
});

introStartBtn.addEventListener("click", () => {
  introOverlay.hidden = true;
});

buildLangSwitch();
renderIntro();
hydratePlayerInputs();
render();
void refreshLeaderboard();
