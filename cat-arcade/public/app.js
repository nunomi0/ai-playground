import { createBreakoutBricks } from "/cat-arcade/breakout.js";
import {
  SUIKA_LIMIT_GRACE_SECONDS,
  SUIKA_LIMIT_Y,
  SUIKA_WALL_MARGIN,
  breakoutInitialVelocity,
  breakoutPaddleBounceVelocity,
  breakoutResetVelocity,
  breakoutRoundVelocity,
  canDropSuikaPiece,
  canSpawnSuikaPiece,
  clampSuikaPieceX,
  dodgeObstacleSpeed,
  dodgeSpawnInterval,
  droppedSuikaVelocity,
  hasClearedSuikaLimit,
  isSuikaLimitBlinkVisible,
  isSuikaLimitThreat,
  shouldFinishSuikaLimit,
  stackBlockSpeed,
  stackBlockWidth,
  stackProgressForNextBlock,
  suikaBalancedStackPush,
  suikaLimitElapsedSeconds,
} from "/cat-arcade/game-rules.js";
import {
  scoreBreakoutBrick,
  scoreDodgeSurvival,
  scoreStackDrop,
  scoreSuikaMerge,
} from "/cat-arcade/scoring.js";

const drawCanvas = document.querySelector("#drawCanvas");
const gameCanvas = document.querySelector("#gameCanvas");
const clearButton = document.querySelector("#clearCanvas");
const resetButton = document.querySelector("#resetCat");
const openDrawButton = document.querySelector("#openDraw");
const closeDrawButton = document.querySelector("#closeDraw");
const startButton = document.querySelector("#startRandomGame");
const modal = document.querySelector("#drawModal");
const modeEl = document.querySelector("#gameMode");
const scoreEl = document.querySelector("#gameScore");
const statusEl = document.querySelector("#gameStatus");
const playerNameEl = document.querySelector("#playerName");
const refreshLeaderboardButton = document.querySelector("#refreshLeaderboard");
const leaderboardListEl = document.querySelector("#leaderboardList");
const leaderboardEmptyEl = document.querySelector("#leaderboardEmpty");
const leaderboardModeButtons = [...document.querySelectorAll("[data-leaderboard-mode]")];
const duelRoomCodeEl = document.querySelector("#duelRoomCode");
const createDuelButton = document.querySelector("#createDuel");
const joinDuelButton = document.querySelector("#joinDuel");
const leaveDuelButton = document.querySelector("#leaveDuel");
const duelStatusEl = document.querySelector("#duelStatus");
const rivalScoreEl = document.querySelector("#rivalScore");
const rivalPanelEl = document.querySelector(".rival-panel");
const rivalCanvas = document.querySelector("#rivalCanvas");
const rivalVideo = document.querySelector("#rivalVideo");
const duelChatEl = document.querySelector("#duelChat");
const duelChatForm = document.querySelector("#duelChatForm");
const duelChatInput = document.querySelector("#duelChatInput");

const drawCtx = drawCanvas.getContext("2d", { willReadFrequently: true });
const gameCtx = gameCanvas.getContext("2d");
const rivalCtx = rivalCanvas.getContext("2d");
const TAU = Math.PI * 2;
const GAME_WIDTH = gameCanvas.width;
const GAME_HEIGHT = gameCanvas.height;
const PIXEL = 5;
const BAD_FONT = '"Segoe Print", "Comic Sans MS", "Bradley Hand ITC", "Chalkboard SE", "Nanum Pen Script", "Gaegu", "Poor Story", cursive';
const PLAYER_NAME_KEY = "bad-cat-arcade-player-name";
const LEADERBOARD_CACHE_KEY = "bad-cat-arcade-shared-cache";
const LEADERBOARD_LIMIT = 8;
const LEADERBOARD_MODES = ["suika", "blocks", "dodge", "breakout"];
const LEADERBOARD_TABLE = "cat_arcade_scores";
const LEADERBOARD_SELECT = "id,player_name,score,source,created_at,client_id";
const DUEL_PLAYERS_TABLE = "cat_arcade_duel_players";
const DUEL_MESSAGES_TABLE = "cat_arcade_duel_messages";
const DUEL_SIGNALS_TABLE = "cat_arcade_duel_signals";
const DUEL_PLAYER_SELECT =
  "room_code,player_id,player_name,mode,score,done,snapshot,updated_at";
const DUEL_MESSAGE_SELECT = "id,room_code,player_id,player_name,message,created_at";
const DUEL_SIGNAL_SELECT = "id,room_code,sender_id,recipient_id,signal_type,payload,created_at";
const CAT_CLIENT_PREFIX = "cat-arcade";
const DUEL_PLAYER_KEY = "bad-cat-arcade-duel-session-player-id";
const DUEL_PRESENCE_INTERVAL_MS = 4000;
const DUEL_POLL_INTERVAL_MS = 900;
const DUEL_STALE_MS = 15000;
const DUEL_CHAT_LIMIT = 24;
const DUEL_SIGNAL_LIMIT = 80;
const DUEL_RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
const DEFAULT_SUPABASE_URL = "https://rexaexziprkcyeyxnivh.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJleGFleHppcHJrY3lleXhuaXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MDgwNzgsImV4cCI6MjA5MzI4NDA3OH0.jjIAwIviP5vi04zd-rnD_Li0dFThERp9BOBJMSKoDLU";
const supabaseConfig = {
  supabaseUrl:
    globalThis.__CAT_ARCADE_SUPABASE__?.supabaseUrl ??
    DEFAULT_SUPABASE_URL,
  supabaseAnonKey:
    globalThis.__CAT_ARCADE_SUPABASE__?.supabaseAnonKey ??
    DEFAULT_SUPABASE_ANON_KEY,
};
const MODE_NAME_MAP = {
  "brick?": "breakout",
  brick: "breakout",
  "dodge?": "dodge",
  "apple?": "suika",
  apple: "suika",
  "stack?": "blocks",
  stack: "blocks",
};
const MODE_NAMES = new Set(["breakout", "dodge", "suika", "blocks"]);

const state = {
  drawing: false,
  hasInk: false,
  lastPoint: null,
  pointerX: GAME_WIDTH / 2,
  keys: new Set(),
  game: null,
  lastFrame: performance.now(),
  currentSprite: null,
  leaderboard: [],
  leaderboardStatus: "loading",
  leaderboardMode: "suika",
  duel: {
    roomCode: "",
    playerId: "",
    role: "",
    mode: "",
    active: false,
    opponent: null,
    opponentId: "",
    presenceTimer: null,
    pollTimer: null,
    pc: null,
    dataChannel: null,
    localStream: null,
    remoteStream: null,
    makingOffer: false,
    lastStateSentAt: 0,
    seenSignalIds: new Set(),
    chatIds: new Set(),
  },
};

const modes = [
  { name: "breakout", create: createBreakout },
  { name: "dodge", create: createDodge },
  { name: "suika", create: createMerge },
  { name: "blocks", create: createStack },
];

drawCtx.imageSmoothingEnabled = false;
gameCtx.imageSmoothingEnabled = false;
rivalCtx.imageSmoothingEnabled = false;
drawCtx.fillStyle = "#000000";
drawCtx.strokeStyle = "#000000";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function canvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setScore(score) {
  scoreEl.textContent = Math.max(0, Math.floor(score)).toString();
  if (state.duel.active) {
    sendDuelState();
  }
}

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizePlayerName(name) {
  const cleaned = String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
  return cleaned || "bad cat";
}

function loadPlayerName() {
  const stored = getStorage()?.getItem(PLAYER_NAME_KEY);
  return normalizePlayerName(stored || playerNameEl.value);
}

function rememberPlayerName() {
  const name = normalizePlayerName(playerNameEl.value);
  playerNameEl.value = name;

  try {
    getStorage()?.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // The name still travels with this save even if storage is blocked.
  }

  return name;
}

function normalizeModeName(mode) {
  return MODE_NAME_MAP[mode] ?? (MODE_NAMES.has(mode) ? mode : "game");
}

function normalizeScoreValue(score) {
  const value = Number(score);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function sortedLeaderboard(entries) {
  return entries
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return Date.parse(right.recordedAt) - Date.parse(left.recordedAt);
    });
}

function compactLeaderboard(entries) {
  return sortedLeaderboard(
    LEADERBOARD_MODES.flatMap((mode) =>
      sortedLeaderboard(entries.filter((entry) => entry.mode === mode)).slice(0, LEADERBOARD_LIMIT),
    ),
  );
}

function visibleLeaderboardEntries() {
  return sortedLeaderboard(
    state.leaderboard.filter((entry) => entry.mode === state.leaderboardMode),
  ).slice(0, LEADERBOARD_LIMIT);
}

function loadLeaderboardCache() {
  try {
    const parsed = JSON.parse(getStorage()?.getItem(LEADERBOARD_CACHE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) {
      return [];
    }

    return compactLeaderboard(
      parsed
        .filter((entry) => Number.isFinite(entry.score))
        .map((entry) => ({
          id: String(entry.id ?? ""),
          name: normalizePlayerName(entry.name),
          mode: normalizeModeName(entry.mode),
          score: normalizeScoreValue(entry.score),
          recordedAt: entry.recordedAt ?? new Date(0).toISOString(),
        })),
    );
  } catch {
    return [];
  }
}

function saveLeaderboardCache(entries) {
  try {
    getStorage()?.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Shared scores are still fetched live from Supabase when storage is blocked.
  }
}

function canUseSharedLeaderboard() {
  return (
    String(supabaseConfig.supabaseUrl ?? "").trim().length > 0 &&
    String(supabaseConfig.supabaseAnonKey ?? "").trim().length > 0
  );
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

function createLeaderboardEntry(game) {
  const now = Date.now();
  const mode = normalizeModeName(game.modeName);
  const name = rememberPlayerName();
  return {
    id: `${CAT_CLIENT_PREFIX}:${mode}:${now}-${Math.random().toString(16).slice(2)}`,
    name,
    mode,
    score: normalizeScoreValue(game.score),
    recordedAt: new Date(now).toISOString(),
  };
}

function toSupabaseRow(entry) {
  return {
    player_name: normalizePlayerName(entry.name),
    score: normalizeScoreValue(entry.score),
    source: "round",
    client_id: entry.id,
    created_at: entry.recordedAt,
  };
}

function fromSupabaseRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const clientId = String(row.client_id ?? "");
  if (!clientId.startsWith(`${CAT_CLIENT_PREFIX}:`)) {
    return null;
  }

  const [, mode] = clientId.split(":");
  const recordedAt = row.created_at ? new Date(row.created_at).toISOString() : null;
  if (!recordedAt) {
    return null;
  }

  return {
    id: clientId,
    name: normalizePlayerName(row.player_name),
    mode: normalizeModeName(mode),
    score: normalizeScoreValue(row.score),
    recordedAt,
  };
}

async function fetchSharedLeaderboardMode(mode) {
  const params = new URLSearchParams({
    select: LEADERBOARD_SELECT,
    client_id: `like.${CAT_CLIENT_PREFIX}:${mode}:*`,
    order: "score.desc,created_at.desc",
    limit: String(LEADERBOARD_LIMIT),
  });

  const response = await fetch(buildSupabaseUrl(`/rest/v1/${LEADERBOARD_TABLE}`, params), {
    headers: getSupabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error("shared scores failed");
  }

  const rows = await response.json();
  return rows.map(fromSupabaseRow);
}

async function fetchSharedLeaderboard() {
  const entries = await Promise.all(LEADERBOARD_MODES.map(fetchSharedLeaderboardMode));
  return compactLeaderboard(entries.flat());
}

async function insertSharedScore(entry) {
  const response = await fetch(buildSupabaseUrl(`/rest/v1/${LEADERBOARD_TABLE}`), {
    method: "POST",
    headers: {
      ...getSupabaseHeaders({ includeJson: true }),
      Prefer: "return=representation",
    },
    body: JSON.stringify(toSupabaseRow(entry)),
  });

  if (!response.ok) {
    throw new Error("score save failed");
  }

  const rows = await response.json();
  return fromSupabaseRow(rows[0]) ?? entry;
}

async function refreshLeaderboard() {
  if (!canUseSharedLeaderboard()) {
    state.leaderboardStatus = "offline";
    state.leaderboard = loadLeaderboardCache();
    renderLeaderboard();
    return;
  }

  state.leaderboardStatus = state.leaderboard.length > 0 ? "refreshing" : "loading";
  renderLeaderboard();

  try {
    state.leaderboard = await fetchSharedLeaderboard();
    state.leaderboardStatus = "ready";
    saveLeaderboardCache(state.leaderboard);
  } catch {
    state.leaderboard = loadLeaderboardCache();
    state.leaderboardStatus = "error";
  }

  renderLeaderboard();
}

function mergeLeaderboardEntry(entry) {
  state.leaderboard = compactLeaderboard([entry, ...state.leaderboard]);
  saveLeaderboardCache(state.leaderboard);
  renderLeaderboard();
}

function migrateOldLocalScores() {
  try {
    const parsed = JSON.parse(getStorage()?.getItem("bad-cat-arcade-leaderboard") ?? "[]");
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return;
    }

    const migrated = parsed
      .filter((entry) => Number.isFinite(entry.score))
      .map((entry) => ({
        id: `${CAT_CLIENT_PREFIX}:${normalizeModeName(entry.mode)}:local-${entry.id ?? Date.now()}`,
        name: loadPlayerName(),
        mode: normalizeModeName(entry.mode),
        score: normalizeScoreValue(entry.score),
        recordedAt: entry.recordedAt ?? new Date(0).toISOString(),
      }));

    if (migrated.length > 0 && loadLeaderboardCache().length === 0) {
      saveLeaderboardCache(compactLeaderboard(migrated));
    }
  } catch {
    // Old local-only scores are best-effort cache only.
  }
}

function renderLeaderboard() {
  const entries = visibleLeaderboardEntries();
  leaderboardListEl.innerHTML = "";
  leaderboardEmptyEl.hidden = entries.length > 0 && state.leaderboardStatus === "ready";
  leaderboardModeButtons.forEach((button) => {
    const active = button.dataset.leaderboardMode === state.leaderboardMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
  });

  if (!leaderboardEmptyEl.hidden) {
    const messages = {
      loading: "loading shared scores",
      refreshing: "refreshing shared scores",
      ready: `no ${state.leaderboardMode} scores yet`,
      error: "shared scores offline",
      offline: "shared scores not configured",
    };
    leaderboardEmptyEl.textContent = messages[state.leaderboardStatus] ?? "no scores yet";
  }

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-item";

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = `${index + 1}.`;

    const main = document.createElement("span");
    main.className = "leaderboard-main";

    const name = document.createElement("span");
    name.className = "leaderboard-name";
    name.textContent = entry.name;

    const meta = document.createElement("span");
    meta.className = "leaderboard-meta";
    meta.textContent = entry.mode;

    main.append(name, meta);

    const score = document.createElement("strong");
    score.className = "leaderboard-score";
    score.textContent = String(entry.score);

    item.append(rank, main, score);
    leaderboardListEl.append(item);
  });
}

function setLeaderboardMode(mode) {
  if (!LEADERBOARD_MODES.includes(mode)) {
    return;
  }

  state.leaderboardMode = mode;
  renderLeaderboard();
}

async function recordLeaderboardScore(game) {
  if (game.saved) {
    return;
  }

  game.saved = true;
  const entry = createLeaderboardEntry(game);
  mergeLeaderboardEntry(entry);

  if (!canUseSharedLeaderboard()) {
    setStatus("score cached. shared scores offline");
    return;
  }

  setStatus("saving score to supabase");
  try {
    const inserted = await insertSharedScore(entry);
    mergeLeaderboardEntry(inserted);
    setStatus("score saved to supabase");
    await refreshLeaderboard();
  } catch {
    setStatus("score cached. supabase save failed");
  }
}

function getOrCreateDuelPlayerId() {
  let storage = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }

  const existing = storage?.getItem(DUEL_PLAYER_KEY);
  if (existing) {
    return existing;
  }

  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const playerId = `${CAT_CLIENT_PREFIX}-duel-${id}`.slice(0, 96);
  try {
    storage?.setItem(DUEL_PLAYER_KEY, playerId);
  } catch {
    state.duel.playerId = state.duel.playerId || playerId;
  }
  return state.duel.playerId || playerId;
}

function normalizeDuelRoomCode(code) {
  return String(code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function createDuelRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function getModeByName(modeName) {
  return modes.find((mode) => mode.name === modeName) ?? modes[0];
}

function randomModeName() {
  return modes[Math.floor(Math.random() * modes.length)].name;
}

function canUseDuel() {
  return canUseSharedLeaderboard() && canUseWebRtc();
}

function canUseWebRtc() {
  return (
    typeof RTCPeerConnection === "function" &&
    typeof RTCSessionDescription === "function" &&
    typeof RTCIceCandidate === "function" &&
    typeof gameCanvas.captureStream === "function"
  );
}

function setDuelStatus(text) {
  duelStatusEl.textContent = text;
}

function drawRivalPlaceholder(label = "waiting") {
  rivalPanelEl.classList.remove("is-live");
  rivalVideo.srcObject = null;
  rivalCtx.clearRect(0, 0, rivalCanvas.width, rivalCanvas.height);
  rivalCtx.fillStyle = "#ffffff";
  rivalCtx.fillRect(0, 0, rivalCanvas.width, rivalCanvas.height);
  rivalCtx.strokeStyle = "#eeeeee";
  rivalCtx.lineWidth = 1;
  for (let x = 0; x <= rivalCanvas.width; x += 24) {
    rivalCtx.beginPath();
    rivalCtx.moveTo(x, 0);
    rivalCtx.lineTo(x, rivalCanvas.height);
    rivalCtx.stroke();
  }
  for (let y = 0; y <= rivalCanvas.height; y += 24) {
    rivalCtx.beginPath();
    rivalCtx.moveTo(0, y);
    rivalCtx.lineTo(rivalCanvas.width, y);
    rivalCtx.stroke();
  }
  rivalCtx.fillStyle = "#000000";
  rivalCtx.font = `22px ${BAD_FONT}`;
  rivalCtx.textAlign = "center";
  rivalCtx.fillText(label, rivalCanvas.width / 2, rivalCanvas.height / 2);
  rivalCtx.textAlign = "start";
}

function setRivalStream(stream) {
  state.duel.remoteStream = stream;
  rivalVideo.srcObject = stream;
  rivalPanelEl.classList.add("is-live");
  void rivalVideo.play().catch(() => {
    setDuelStatus("tap to play rival");
  });
}

function createDuelPayload() {
  const game = state.game;
  return {
    room_code: state.duel.roomCode,
    player_id: state.duel.playerId,
    player_name: rememberPlayerName(),
    mode: normalizeModeName(state.duel.mode || game?.modeName || "game"),
    score: normalizeScoreValue(game?.score ?? 0),
    done: Boolean(game?.done),
    snapshot: {
      transport: "webrtc",
      role: state.duel.role,
      mode: normalizeModeName(game?.modeName ?? state.duel.mode),
      score: normalizeScoreValue(game?.score ?? 0),
      done: Boolean(game?.done),
      message: game?.message ?? "",
      sentAt: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };
}

async function upsertDuelPlayer() {
  if (!state.duel.active || !canUseDuel()) {
    return;
  }

  const params = new URLSearchParams({ on_conflict: "room_code,player_id" });
  const response = await fetch(buildSupabaseUrl(`/rest/v1/${DUEL_PLAYERS_TABLE}`, params), {
    method: "POST",
    headers: {
      ...getSupabaseHeaders({ includeJson: true }),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(createDuelPayload()),
  });

  if (!response.ok) {
    throw new Error("duel save failed");
  }
}

async function fetchDuelPlayers(roomCode) {
  const params = new URLSearchParams({
    select: DUEL_PLAYER_SELECT,
    room_code: `eq.${roomCode}`,
    order: "updated_at.desc",
    limit: "4",
  });

  const response = await fetch(buildSupabaseUrl(`/rest/v1/${DUEL_PLAYERS_TABLE}`, params), {
    headers: getSupabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error("duel fetch failed");
  }

  return response.json();
}

function freshDuelPlayers(players) {
  const now = Date.now();
  return players.filter((player) => now - Date.parse(player.updated_at ?? 0) < DUEL_STALE_MS);
}

function findDuelHost(players) {
  return freshDuelPlayers(players).find((player) => player.snapshot?.role === "host");
}

async function fetchDuelMessages(roomCode) {
  const params = new URLSearchParams({
    select: DUEL_MESSAGE_SELECT,
    room_code: `eq.${roomCode}`,
    order: "created_at.desc",
    limit: String(DUEL_CHAT_LIMIT),
  });

  const response = await fetch(buildSupabaseUrl(`/rest/v1/${DUEL_MESSAGES_TABLE}`, params), {
    headers: getSupabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error("duel chat fetch failed");
  }

  return response.json();
}

async function fetchDuelSignals(roomCode) {
  const params = new URLSearchParams({
    select: DUEL_SIGNAL_SELECT,
    room_code: `eq.${roomCode}`,
    order: "created_at.desc",
    limit: String(DUEL_SIGNAL_LIMIT),
  });

  const response = await fetch(buildSupabaseUrl(`/rest/v1/${DUEL_SIGNALS_TABLE}`, params), {
    headers: getSupabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error("duel signal fetch failed");
  }

  return response.json();
}

async function sendDuelSignal(signalType, payload, recipientId = state.duel.opponentId || null) {
  if (!state.duel.active || !state.duel.roomCode || !state.duel.playerId) {
    return;
  }

  const response = await fetch(buildSupabaseUrl(`/rest/v1/${DUEL_SIGNALS_TABLE}`), {
    method: "POST",
    headers: {
      ...getSupabaseHeaders({ includeJson: true }),
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      room_code: state.duel.roomCode,
      sender_id: state.duel.playerId,
      recipient_id: recipientId,
      signal_type: signalType,
      payload,
      created_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error("duel signal send failed");
  }
}

function renderDuelMessages(messages, { includeSelf = false } = {}) {
  const sorted = [...messages].sort(
    (left, right) => Date.parse(left.created_at) - Date.parse(right.created_at),
  );

  for (const message of sorted) {
    const id = String(message.id ?? `${message.player_id}:${message.created_at}`);
    if (!includeSelf && message.player_id === state.duel.playerId) {
      state.duel.chatIds.add(id);
      continue;
    }
    if (state.duel.chatIds.has(id)) {
      continue;
    }

    state.duel.chatIds.add(id);
    const item = document.createElement("li");
    item.className = "duel-chat-item";

    const name = document.createElement("span");
    name.className = "duel-chat-name";
    name.textContent = normalizePlayerName(message.player_name);

    const text = document.createElement("span");
    text.className = "duel-chat-text";
    text.textContent = String(message.message ?? "").slice(0, 140);

    item.append(name, text);
    duelChatEl.append(item);
  }

  while (duelChatEl.children.length > DUEL_CHAT_LIMIT) {
    const first = duelChatEl.firstElementChild;
    if (first) {
      duelChatEl.removeChild(first);
    }
  }

  duelChatEl.scrollTop = duelChatEl.scrollHeight;
}

function sendDuelData(message) {
  const channel = state.duel.dataChannel;
  if (channel?.readyState === "open") {
    channel.send(JSON.stringify(message));
    return true;
  }
  return false;
}

function sendDuelState({ force = false } = {}) {
  if (!state.duel.active) {
    return;
  }
  const now = performance.now();
  if (!force && now - state.duel.lastStateSentAt < 250) {
    return;
  }

  const game = state.game;
  if (sendDuelData({
    type: "state",
    playerName: rememberPlayerName(),
    mode: normalizeModeName(game?.modeName ?? state.duel.mode),
    score: normalizeScoreValue(game?.score ?? 0),
    done: Boolean(game?.done),
    message: game?.message ?? "",
    sentAt: new Date().toISOString(),
  })) {
    state.duel.lastStateSentAt = now;
  }
}

function handleDuelData(rawMessage) {
  let message;
  try {
    message = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (message?.type === "state") {
    rivalScoreEl.textContent = String(normalizeScoreValue(message.score));
    setDuelStatus(`${normalizePlayerName(message.playerName)} ${normalizeModeName(message.mode)}`);
    return;
  }

  if (message?.type === "chat") {
    renderDuelMessages([
      {
        id: message.id,
        player_id: state.duel.opponent?.player_id ?? "rival",
        player_name: message.playerName,
        message: message.text,
        created_at: message.sentAt,
      },
    ]);
  }
}

function attachDuelDataChannel(channel) {
  state.duel.dataChannel = channel;
  channel.addEventListener("open", () => {
    setDuelStatus("webrtc connected");
    sendDuelState({ force: true });
  });
  channel.addEventListener("message", (event) => {
    handleDuelData(event.data);
  });
  channel.addEventListener("close", () => {
    if (state.duel.active) {
      setDuelStatus("webrtc reconnecting");
    }
  });
}

function ensureLocalDuelStream() {
  if (state.duel.localStream) {
    return state.duel.localStream;
  }

  const stream = gameCanvas.captureStream(24);
  state.duel.localStream = stream;
  return stream;
}

async function sendLocalOffer() {
  const pc = state.duel.pc;
  if (!pc || state.duel.makingOffer) {
    return;
  }

  state.duel.makingOffer = true;
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendDuelSignal("offer", pc.localDescription);
  } finally {
    state.duel.makingOffer = false;
  }
}

async function setupWebRtcDuel() {
  closeWebRtcDuel();

  const pc = new RTCPeerConnection(DUEL_RTC_CONFIG);
  state.duel.pc = pc;
  state.duel.seenSignalIds = new Set();

  ensureLocalDuelStream()
    .getTracks()
    .forEach((track) => pc.addTrack(track, state.duel.localStream));

  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      void sendDuelSignal("ice", event.candidate.toJSON()).catch(() => {
        setDuelStatus("signal failed");
      });
    }
  });

  pc.addEventListener("connectionstatechange", () => {
    if (["connected", "completed"].includes(pc.connectionState)) {
      setDuelStatus("webrtc connected");
    } else if (["failed", "disconnected"].includes(pc.connectionState) && state.duel.active) {
      setDuelStatus("webrtc reconnecting");
      drawRivalPlaceholder("reconnecting");
    }
  });

  pc.addEventListener("track", (event) => {
    const [stream] = event.streams;
    if (stream) {
      setRivalStream(stream);
    }
  });

  pc.addEventListener("datachannel", (event) => {
    attachDuelDataChannel(event.channel);
  });

  if (state.duel.role === "host") {
    attachDuelDataChannel(pc.createDataChannel("cat-arcade-duel"));
    await sendLocalOffer();
  }
}

function closeWebRtcDuel() {
  state.duel.dataChannel?.close();
  state.duel.pc?.close();
  state.duel.localStream?.getTracks().forEach((track) => track.stop());
  state.duel.dataChannel = null;
  state.duel.pc = null;
  state.duel.localStream = null;
  state.duel.remoteStream = null;
  state.duel.makingOffer = false;
  rivalPanelEl.classList.remove("is-live");
  rivalVideo.srcObject = null;
}

async function processDuelSignal(signal) {
  if (state.duel.seenSignalIds.has(signal.id)) {
    return;
  }
  if (signal.sender_id === state.duel.playerId) {
    state.duel.seenSignalIds.add(signal.id);
    return;
  }
  if (state.duel.opponentId && signal.sender_id !== state.duel.opponentId) {
    return;
  }
  if (signal.recipient_id && signal.recipient_id !== state.duel.playerId) {
    return;
  }

  const pc = state.duel.pc;
  if (!pc) {
    return;
  }

  const payload = signal.payload;

  if (signal.signal_type === "offer") {
    if (pc.signalingState !== "stable") {
      return;
    }
    await pc.setRemoteDescription(new RTCSessionDescription(payload));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendDuelSignal("answer", pc.localDescription, signal.sender_id);
    state.duel.seenSignalIds.add(signal.id);
    return;
  }

  if (signal.signal_type === "answer") {
    if (pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(payload));
    }
    state.duel.seenSignalIds.add(signal.id);
    return;
  }

  if (signal.signal_type === "ice" && payload) {
    if (!pc.remoteDescription) {
      return;
    }
    await pc.addIceCandidate(new RTCIceCandidate(payload));
    state.duel.seenSignalIds.add(signal.id);
  }
}

async function processDuelSignals(signals) {
  const sortedSignals = [...signals].sort(
    (left, right) => Date.parse(left.created_at) - Date.parse(right.created_at),
  );
  for (const signal of sortedSignals) {
    try {
      await processDuelSignal(signal);
    } catch {
      // The next poll can retry out-of-order WebRTC candidates.
    }
  }
}

function renderDuelPlayers(players) {
  const opponents = freshDuelPlayers(players).filter(
    (player) => player.player_id !== state.duel.playerId,
  );
  const host = findDuelHost(players);
  const opponent =
    state.duel.role === "guest" && host?.player_id !== state.duel.playerId
      ? host
      : opponents[0];

  state.duel.opponent = opponent ?? null;
  state.duel.opponentId = opponent?.player_id ?? "";
  if (!opponent) {
    rivalScoreEl.textContent = "0";
    setDuelStatus(state.duel.active ? `${state.duel.roomCode}: waiting` : "solo");
    drawRivalPlaceholder(state.duel.active ? state.duel.roomCode : "solo");
    return;
  }

  const opponentScore = normalizeScoreValue(opponent.score);
  rivalScoreEl.textContent = String(opponentScore);
  if (!rivalPanelEl.classList.contains("is-live")) {
    setDuelStatus(`${normalizePlayerName(opponent.player_name)} connecting`);
    drawRivalPlaceholder("connecting");
  }
}

async function pollDuelRoom() {
  if (!state.duel.active || !state.duel.roomCode) {
    return;
  }

  try {
    const [players, messages, signals] = await Promise.all([
      fetchDuelPlayers(state.duel.roomCode),
      fetchDuelMessages(state.duel.roomCode),
      fetchDuelSignals(state.duel.roomCode),
    ]);
    renderDuelPlayers(players);
    renderDuelMessages(messages);
    await processDuelSignals(signals);
  } catch {
    setDuelStatus("duel offline");
  }
}

function startDuelLoops() {
  window.clearInterval(state.duel.presenceTimer);
  window.clearInterval(state.duel.pollTimer);
  state.duel.presenceTimer = window.setInterval(() => {
    void upsertDuelPlayer().catch(() => setDuelStatus("duel offline"));
    sendDuelState({ force: true });
  }, DUEL_PRESENCE_INTERVAL_MS);
  state.duel.pollTimer = window.setInterval(() => {
    void pollDuelRoom();
  }, DUEL_POLL_INTERVAL_MS);
  void upsertDuelPlayer().catch(() => setDuelStatus("duel offline"));
  void pollDuelRoom();
}

function stopDuelLoops() {
  window.clearInterval(state.duel.presenceTimer);
  window.clearInterval(state.duel.pollTimer);
  state.duel.presenceTimer = null;
  state.duel.pollTimer = null;
}

function setDuelControlsActive(active) {
  leaveDuelButton.hidden = !active;
  createDuelButton.hidden = active;
  joinDuelButton.hidden = active;
  duelRoomCodeEl.disabled = active;
}

async function enterDuel(roomCode, modeName, role, opponent = null) {
  if (!canUseSharedLeaderboard()) {
    setStatus("duel needs supabase");
    setDuelStatus("offline");
    return;
  }
  if (!canUseWebRtc()) {
    setStatus("webrtc not available in this browser");
    setDuelStatus("webrtc unavailable");
    return;
  }

  const normalizedRoomCode = normalizeDuelRoomCode(roomCode);
  if (normalizedRoomCode.length < 4) {
    setStatus("duel code too short");
    return;
  }

  state.duel.roomCode = normalizedRoomCode;
  state.duel.playerId = getOrCreateDuelPlayerId();
  state.duel.role = role;
  state.duel.mode = normalizeModeName(modeName);
  state.duel.active = true;
  state.duel.opponent = opponent;
  state.duel.opponentId = opponent?.player_id ?? "";
  state.duel.chatIds = new Set();
  state.duel.seenSignalIds = new Set();
  state.duel.lastStateSentAt = 0;
  duelChatEl.innerHTML = "";
  duelRoomCodeEl.value = normalizedRoomCode;
  setDuelControlsActive(true);
  startGameMode(state.duel.mode, { duel: true });
  await setupWebRtcDuel();
  startDuelLoops();
  setStatus(`webrtc duel ${normalizedRoomCode} started`);
}

async function createDuel() {
  const roomCode = createDuelRoomCode();
  await enterDuel(roomCode, randomModeName(), "host");
}

async function joinDuel() {
  const roomCode = normalizeDuelRoomCode(duelRoomCodeEl.value);
  if (!roomCode) {
    setStatus("enter duel code");
    return;
  }

  try {
    if (!canUseSharedLeaderboard()) {
      setStatus("duel needs supabase");
      setDuelStatus("offline");
      return;
    }
    if (!canUseWebRtc()) {
      setStatus("webrtc not available in this browser");
      setDuelStatus("webrtc unavailable");
      return;
    }

    const playerId = getOrCreateDuelPlayerId();
    const players = await fetchDuelPlayers(roomCode);
    const otherPlayers = freshDuelPlayers(players).filter((player) => player.player_id !== playerId);
    if (otherPlayers.length === 0) {
      setStatus("no duel host found");
      setDuelStatus("empty room");
      return;
    }
    if (otherPlayers.length >= 2) {
      setStatus("duel room is full");
      setDuelStatus("room full");
      return;
    }

    const host = otherPlayers.find((player) => player.snapshot?.role === "host") ?? otherPlayers[0];
    await enterDuel(roomCode, host.mode ?? host.snapshot?.mode ?? randomModeName(), "guest", host);
  } catch {
    setStatus("duel join failed");
    setDuelStatus("duel offline");
  }
}

async function leaveDuel() {
  if (state.duel.active) {
    try {
      await upsertDuelPlayer();
    } catch {
      // Leaving should still clean up the local duel state.
    }
  }
  stopDuelLoops();
  closeWebRtcDuel();
  state.duel.active = false;
  state.duel.roomCode = "";
  state.duel.role = "";
  state.duel.mode = "";
  state.duel.opponent = null;
  state.duel.opponentId = "";
  state.duel.seenSignalIds = new Set();
  state.duel.lastStateSentAt = 0;
  duelChatEl.innerHTML = "";
  rivalScoreEl.textContent = "0";
  setDuelControlsActive(false);
  setDuelStatus("solo");
  drawRivalPlaceholder("solo");
  setStatus("left duel");
}

async function sendDuelMessage(message) {
  if (!state.duel.active || !state.duel.roomCode || !canUseDuel()) {
    setStatus("join a duel first");
    return;
  }

  const text = String(message ?? "").trim().replace(/\s+/g, " ").slice(0, 140);
  if (!text) {
    return;
  }

  const chatMessage = {
    id: `${state.duel.playerId}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
    type: "chat",
    playerName: rememberPlayerName(),
    text,
    sentAt: new Date().toISOString(),
  };
  renderDuelMessages(
    [
      {
        id: chatMessage.id,
        player_id: state.duel.playerId,
        player_name: chatMessage.playerName,
        message: chatMessage.text,
        created_at: chatMessage.sentAt,
      },
    ],
    { includeSelf: true },
  );

  if (sendDuelData(chatMessage)) {
    return;
  }

  const response = await fetch(buildSupabaseUrl(`/rest/v1/${DUEL_MESSAGES_TABLE}`), {
    method: "POST",
    headers: {
      ...getSupabaseHeaders({ includeJson: true }),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      room_code: state.duel.roomCode,
      player_id: state.duel.playerId || getOrCreateDuelPlayerId(),
      player_name: rememberPlayerName(),
      message: text,
      created_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error("duel chat send failed");
  }

  renderDuelMessages(await response.json());
}

function pixelBlock(ctx, x, y, size = PIXEL) {
  ctx.fillRect(Math.round(x / size) * size, Math.round(y / size) * size, size, size);
}

function pixelLine(ctx, a, b, size = PIXEL) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / size));

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    pixelBlock(ctx, a.x + dx * t, a.y + dy * t, size);
  }
}

function pixelPolyline(ctx, points, size = PIXEL) {
  for (let i = 1; i < points.length; i += 1) {
    pixelLine(ctx, points[i - 1], points[i], size);
  }
}

function startStroke(event) {
  event.preventDefault();
  drawCanvas.setPointerCapture(event.pointerId);
  const point = canvasPoint(drawCanvas, event);
  state.drawing = true;
  state.hasInk = true;
  state.lastPoint = point;
  pixelBlock(drawCtx, point.x, point.y);
}

function continueStroke(event) {
  if (!state.drawing || !state.lastPoint) {
    return;
  }

  event.preventDefault();
  const point = canvasPoint(drawCanvas, event);
  pixelLine(drawCtx, state.lastPoint, point);
  state.lastPoint = point;
}

function endStroke(event) {
  if (event.pointerId !== undefined && drawCanvas.hasPointerCapture(event.pointerId)) {
    drawCanvas.releasePointerCapture(event.pointerId);
  }
  state.drawing = false;
  state.lastPoint = null;
}

function clearDrawing() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  state.hasInk = false;
  state.currentSprite = null;
  setStatus("blank cat");
}

function drawBadCatSeed() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  drawCtx.fillStyle = "#000000";

  const lines = [
    [
      { x: 202, y: 240 },
      { x: 215, y: 178 },
      { x: 248, y: 218 },
      { x: 308, y: 190 },
      { x: 366, y: 220 },
      { x: 410, y: 168 },
      { x: 420, y: 248 },
      { x: 398, y: 304 },
      { x: 318, y: 332 },
      { x: 236, y: 306 },
      { x: 202, y: 240 },
    ],
    [
      { x: 234, y: 318 },
      { x: 216, y: 366 },
      { x: 270, y: 362 },
    ],
    [
      { x: 376, y: 318 },
      { x: 402, y: 370 },
      { x: 452, y: 352 },
    ],
    [
      { x: 211, y: 265 },
      { x: 150, y: 252 },
    ],
    [
      { x: 216, y: 286 },
      { x: 154, y: 296 },
    ],
    [
      { x: 382, y: 267 },
      { x: 452, y: 252 },
    ],
    [
      { x: 379, y: 287 },
      { x: 450, y: 300 },
    ],
    [
      { x: 280, y: 286 },
      { x: 306, y: 304 },
      { x: 340, y: 280 },
    ],
    [
      { x: 470, y: 306 },
      { x: 510, y: 276 },
      { x: 552, y: 292 },
      { x: 522, y: 330 },
    ],
  ];

  for (const line of lines) {
    pixelPolyline(drawCtx, line, 7);
  }

  for (const [x, y, width, height] of [
    [266, 252, 8, 8],
    [352, 244, 8, 8],
    [303, 276, 9, 7],
    [172, 330, 24, 8],
    [424, 334, 18, 8],
    [245, 202, 12, 12],
    [398, 203, 8, 17],
    [548, 294, 8, 8],
    [560, 306, 7, 7],
  ]) {
    drawCtx.fillRect(x, y, width, height);
  }

  for (let i = 0; i < 22; i += 1) {
    const x = 120 + ((i * 53) % 420);
    const y = 110 + ((i * 37) % 250);
    if (i % 4 === 0) {
      drawCtx.fillRect(x, y, 5, 5);
    }
  }

  state.hasInk = true;
  state.currentSprite = makeCatSprite();
  setStatus("default cat loaded");
}

function openDraw() {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  closeDrawButton.focus();
}

function closeDraw() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  openDrawButton.focus();
  state.currentSprite = makeCatSprite();
  state.game = null;
  modeEl.textContent = "ready";
  setScore(0);
  drawIdleGame();
  setStatus(state.currentSprite ? "cat saved" : "no cat yet");
}

function getInkBounds() {
  const { width, height } = drawCanvas;
  const pixels = drawCtx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 4) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < 0) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function makeCatSprite() {
  const bounds = getInkBounds();
  if (!bounds) {
    return null;
  }

  const pad = 18;
  const sourceX = clamp(bounds.minX - pad, 0, drawCanvas.width);
  const sourceY = clamp(bounds.minY - pad, 0, drawCanvas.height);
  const sourceRight = clamp(bounds.maxX + pad, 0, drawCanvas.width);
  const sourceBottom = clamp(bounds.maxY + pad, 0, drawCanvas.height);
  const width = Math.max(1, sourceRight - sourceX);
  const height = Math.max(1, sourceBottom - sourceY);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = width;
  canvas.height = height;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(drawCanvas, sourceX, sourceY, width, height, 0, 0, width, height);

  return { canvas, width, height, aspect: width / height };
}

function drawCat(ctx, sprite, centerX, centerY, maxWidth, maxHeight, rotation = 0, alpha = 1) {
  let width = maxWidth;
  let height = width / sprite.aspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * sprite.aspect;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha * 0.35;
  for (const [offsetX, offsetY] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    ctx.drawImage(sprite.canvas, -width / 2 + offsetX, -height / 2 + offsetY, width, height);
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite.canvas, -width / 2, -height / 2, width, height);
  ctx.restore();

  return { width, height };
}

function colorizedSprite(sprite, inkColor) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite.canvas, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = inkColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";

  return canvas;
}

function catVariantSprite(sprite, level, palette) {
  const key = `${level}:${palette.ink}:${palette.accent}`;
  if (!sprite.variants) {
    sprite.variants = new Map();
  }
  if (sprite.variants.has(key)) {
    return sprite.variants.get(key);
  }

  const pad = 34;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const colored = colorizedSprite(sprite, palette.ink);
  const wobble = ((level % 5) - 2) * 0.035;
  const squat = 1 + ((level % 3) - 1) * 0.055;
  const lean = 1 + ((level % 4) - 1.5) * 0.028;
  canvas.width = sprite.width + pad * 2;
  canvas.height = sprite.height + pad * 2;
  ctx.imageSmoothingEnabled = false;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(wobble);
  ctx.scale(lean, squat);
  ctx.globalAlpha = 0.2;
  ctx.drawImage(colored, -sprite.width / 2 - 3, -sprite.height / 2 + 2);
  ctx.drawImage(colored, -sprite.width / 2 + 3, -sprite.height / 2 - 2);
  ctx.globalAlpha = 1;
  ctx.drawImage(colored, -sprite.width / 2, -sprite.height / 2);
  ctx.restore();

  ctx.strokeStyle = palette.accent;
  ctx.fillStyle = palette.accent;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  const markX = pad + 18 + (level % 4) * 16;
  const markY = pad + 16 + (level % 5) * 10;
  if (level % 2 === 0) {
    ctx.beginPath();
    ctx.arc(markX, markY, 8 + (level % 3) * 3, 0.2, Math.PI * 1.35);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(markX - 12, markY);
    ctx.lineTo(markX + 14, markY + 9);
    ctx.moveTo(markX + 1, markY - 12);
    ctx.lineTo(markX + 10, markY + 18);
    ctx.stroke();
  }

  for (let i = 0; i < 3; i += 1) {
    ctx.fillRect(
      pad + ((level * 29 + i * 41) % Math.max(1, sprite.width)),
      pad + ((level * 17 + i * 37) % Math.max(1, sprite.height)),
      5,
      5,
    );
  }

  const variant = {
    canvas,
    width: canvas.width,
    height: canvas.height,
    aspect: canvas.width / canvas.height,
  };
  sprite.variants.set(key, variant);
  return variant;
}

function drawGameBackground(label) {
  gameCtx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  gameCtx.fillStyle = "#ffffff";
  gameCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  gameCtx.strokeStyle = "#eeeeee";
  gameCtx.lineWidth = 1;
  for (let x = 0; x <= GAME_WIDTH; x += 24) {
    gameCtx.beginPath();
    gameCtx.moveTo(x, 0);
    gameCtx.lineTo(x, GAME_HEIGHT);
    gameCtx.stroke();
  }
  for (let y = 0; y <= GAME_HEIGHT; y += 24) {
    gameCtx.beginPath();
    gameCtx.moveTo(0, y);
    gameCtx.lineTo(GAME_WIDTH, y);
    gameCtx.stroke();
  }
  gameCtx.fillStyle = "#000000";
  gameCtx.font = `20px ${BAD_FONT}`;
  gameCtx.fillText(label, 14, 28);
}

function drawOverlay(message) {
  gameCtx.save();
  gameCtx.fillStyle = "rgba(255, 255, 255, 0.84)";
  gameCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  gameCtx.fillStyle = "#000000";
  gameCtx.font = `42px ${BAD_FONT}`;
  gameCtx.textAlign = "center";
  gameCtx.fillText(message, GAME_WIDTH / 2, GAME_HEIGHT / 2);
  gameCtx.font = `18px ${BAD_FONT}`;
  gameCtx.fillText("start = new game", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 38);
  gameCtx.restore();
}

function finish(game, message) {
  if (game.done) {
    return;
  }

  game.done = true;
  game.message = message;
  setStatus(`${message}. saving score`);
  recordLeaderboardScore(game);
}

function horizontalControl(currentX, speed, dt, min, max) {
  let nextX = currentX;
  const left = state.keys.has("ArrowLeft") || state.keys.has("KeyA");
  const right = state.keys.has("ArrowRight") || state.keys.has("KeyD");

  if (left) {
    nextX -= speed * dt;
  }
  if (right) {
    nextX += speed * dt;
  }
  if (!left && !right) {
    nextX += (state.pointerX - nextX) * Math.min(1, dt * 11);
  }

  return clamp(nextX, min, max);
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectOverlap(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

function outlinedRect(x, y, w, h) {
  gameCtx.fillStyle = "#ffffff";
  gameCtx.fillRect(x, y, w, h);
  gameCtx.strokeStyle = "#000000";
  gameCtx.lineWidth = 2;
  gameCtx.strokeRect(x, y, w, h);
}

function createBreakout(sprite) {
  let bricks = createBreakoutBricks(1);

  return {
    done: false,
    message: "",
    score: 0,
    round: 1,
    paddleX: GAME_WIDTH / 2,
    ball: { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 132, ...breakoutInitialVelocity(), r: 8 },
    lives: 3,
    action() {},
    update(dt) {
      this.paddleX = horizontalControl(this.paddleX, 620, dt, 76, GAME_WIDTH - 76);
      const ball = this.ball;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x <= ball.r || ball.x >= GAME_WIDTH - ball.r) {
        ball.vx *= -1;
        ball.x = clamp(ball.x, ball.r, GAME_WIDTH - ball.r);
      }
      if (ball.y <= ball.r) {
        ball.vy = Math.abs(ball.vy);
      }

      const paddle = { x: this.paddleX - 76, y: GAME_HEIGHT - 68, w: 152, h: 30 };
      if (ball.vy > 0 && circleRectOverlap(ball, paddle)) {
        const hit = (ball.x - this.paddleX) / 76;
        const velocity = breakoutPaddleBounceVelocity(hit, ball.vy);
        ball.vx = velocity.vx;
        ball.vy = velocity.vy;
        ball.y = paddle.y - ball.r;
      }

      for (const brick of bricks) {
        if (!brick.alive || !circleRectOverlap(ball, brick)) {
          continue;
        }
        brick.alive = false;
        this.score += scoreBreakoutBrick();
        setScore(this.score);
        ball.vy *= -1;
        break;
      }

      if (ball.y > GAME_HEIGHT + 40) {
        this.lives -= 1;
        if (this.lives <= 0) {
          finish(this, "game over");
          return;
        }
        ball.x = GAME_WIDTH / 2;
        ball.y = GAME_HEIGHT - 132;
        const velocity = breakoutResetVelocity(Math.random() > 0.5 ? 1 : -1);
        ball.vx = velocity.vx;
        ball.vy = velocity.vy;
      }

      if (bricks.every((brick) => !brick.alive)) {
        this.round += 1;
        bricks = createBreakoutBricks(this.round);
        ball.x = GAME_WIDTH / 2;
        ball.y = GAME_HEIGHT - 132;
        const velocity = breakoutRoundVelocity(this.round);
        ball.vx = velocity.vx;
        ball.vy = velocity.vy;
        setStatus(`breakout set ${this.round}`);
      }
    },
    draw() {
      drawGameBackground(`breakout ${this.round}  mouse = move`);
      for (const brick of bricks) {
        if (brick.alive) {
          outlinedRect(brick.x, brick.y, brick.w, brick.h);
        }
      }

      gameCtx.fillStyle = "#000000";
      gameCtx.beginPath();
      gameCtx.arc(this.ball.x, this.ball.y, this.ball.r, 0, TAU);
      gameCtx.fill();
      drawCat(gameCtx, sprite, this.paddleX, GAME_HEIGHT - 54, 152, 70);
      gameCtx.font = `18px ${BAD_FONT}`;
      gameCtx.fillText(`x${this.lives}`, GAME_WIDTH - 48, 28);
      if (this.done) {
        drawOverlay(this.message);
      }
    },
  };
}

function createDodge(sprite) {
  const obstacles = [];

  return {
    done: false,
    message: "",
    score: 0,
    survivalTime: 0,
    spawnTime: 0.35,
    catX: GAME_WIDTH / 2,
    action() {},
    update(dt) {
      this.survivalTime += dt;
      this.score = scoreDodgeSurvival(this.score, dt);
      setScore(this.score);
      this.catX = horizontalControl(this.catX, 680, dt, 56, GAME_WIDTH - 56);
      this.spawnTime -= dt;

      if (this.spawnTime <= 0) {
        const size = 30 + Math.random() * 48;
        obstacles.push({
          x: 24 + Math.random() * (GAME_WIDTH - 48 - size),
          y: -size,
          w: size,
          h: size,
          speed: dodgeObstacleSpeed(this.survivalTime, Math.random()),
        });
        this.spawnTime = dodgeSpawnInterval(this.survivalTime);
      }

      const catBox = { x: this.catX - 46, y: GAME_HEIGHT - 96, w: 92, h: 74 };
      for (const obstacle of obstacles) {
        obstacle.y += obstacle.speed * dt;
        if (rectsOverlap(catBox, obstacle)) {
          finish(this, "bonk");
        }
      }

      while (obstacles.length && obstacles[0].y > GAME_HEIGHT + 80) {
        obstacles.shift();
      }
    },
    draw() {
      drawGameBackground("dodge  mouse = move");
      for (const obstacle of obstacles) {
        outlinedRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
        gameCtx.beginPath();
        gameCtx.moveTo(obstacle.x, obstacle.y);
        gameCtx.lineTo(obstacle.x + obstacle.w, obstacle.y + obstacle.h);
        gameCtx.moveTo(obstacle.x + obstacle.w, obstacle.y);
        gameCtx.lineTo(obstacle.x, obstacle.y + obstacle.h);
        gameCtx.stroke();
      }
      drawCat(gameCtx, sprite, this.catX, GAME_HEIGHT - 62, 108, 84);
      if (this.done) {
        drawOverlay(this.message);
      }
    },
  };
}

function createMerge(sprite) {
  const baseLevels = [
    { r: 36, fill: "#fff2a8", ink: "#171513", accent: "#d24b3f" },
    { r: 47, fill: "#b9f2c5", ink: "#102a18", accent: "#f28f3b" },
    { r: 60, fill: "#a9d8ff", ink: "#102238", accent: "#f45da6" },
    { r: 76, fill: "#ffc0df", ink: "#321327", accent: "#2f8fdd" },
    { r: 95, fill: "#ffd19a", ink: "#3a1f10", accent: "#1d9a63" },
    { r: 118, fill: "#d8c4ff", ink: "#23133f", accent: "#e2a800" },
    { r: 145, fill: "#9df0e2", ink: "#123633", accent: "#df4f3f" },
  ];
  const pieces = [];
  const gravity = 1080;
  const wallDamping = 0.48;
  const collisionDamping = 0.34;

  const game = {
    done: false,
    message: "",
    score: 0,
    current: newPiece(),
    spawnTimer: 0,
    overLimitStartedAt: null,
    overLimitElapsed: 0,
    action() {
      if (canDropSuikaPiece(this.current, this.overLimitStartedAt, this.done)) {
        const velocity = droppedSuikaVelocity();
        this.current.dropped = true;
        this.current.vx = velocity.vx;
        this.current.vy = velocity.vy;
        pieces.push(this.current);
        this.current = null;
        this.spawnTimer = 0.34;
        setStatus("dropped");
      }
    },
    update(dt, now = performance.now()) {
      if (this.current) {
        this.current.x = clampSuikaPieceX(state.pointerX, this.current.r, GAME_WIDTH);
      } else if (this.spawnTimer > 0) {
        this.spawnTimer -= dt;
      } else if (canSpawnSuikaPiece(this.overLimitStartedAt, this.done)) {
        this.current = newPiece();
      }

      stepPieces(dt);
      mergeTouching(this);

      if (pieces.some(isSuikaLimitThreat)) {
        if (this.overLimitStartedAt === null) {
          this.overLimitStartedAt = now;
        }
        this.overLimitElapsed = suikaLimitElapsedSeconds(this.overLimitStartedAt, now);
      } else {
        this.overLimitStartedAt = null;
        this.overLimitElapsed = 0;
      }

      if (shouldFinishSuikaLimit(this.overLimitStartedAt, now)) {
        finish(this, "full");
      }
    },
    draw() {
      drawGameBackground("suika  click/space = drop");
      for (const piece of pieces) {
        drawMergePiece(piece);
      }
      drawSuikaLimitLine(this.overLimitElapsed, this.overLimitStartedAt !== null);
      if (this.current) {
        drawMergePiece(this.current);
        gameCtx.setLineDash([5, 7]);
        gameCtx.beginPath();
        gameCtx.moveTo(this.current.x, 40);
        gameCtx.lineTo(this.current.x, GAME_HEIGHT - 28);
        gameCtx.strokeStyle = "#000000";
        gameCtx.stroke();
        gameCtx.setLineDash([]);
      }
      if (this.done) {
        drawOverlay(this.message);
      }
    },
  };

  function randomSpawnLevel() {
    const roll = Math.random();
    if (roll < 0.34) {
      return 0;
    }
    if (roll < 0.62) {
      return 1;
    }
    if (roll < 0.82) {
      return 2;
    }
    if (roll < 0.95) {
      return 3;
    }
    return 4;
  }

  function newPiece() {
    const level = randomSpawnLevel();
    const radius = mergeLevel(level).r;
    return {
      x: clampSuikaPieceX(state.pointerX, radius, GAME_WIDTH),
      y: Math.max(SUIKA_LIMIT_Y, radius + 12),
      vx: 0,
      vy: 0,
      age: 0,
      level,
      r: radius,
      dropped: false,
      limitArmed: false,
    };
  }

  function stepPieces(dt) {
    for (const piece of pieces) {
      piece.age += dt;
      piece.vy += gravity * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;

      if (hasClearedSuikaLimit(piece)) {
        piece.limitArmed = true;
      }

      if (piece.x - piece.r < SUIKA_WALL_MARGIN) {
        piece.x = SUIKA_WALL_MARGIN + piece.r;
        piece.vx = Math.abs(piece.vx) * wallDamping;
      } else if (piece.x + piece.r > GAME_WIDTH - SUIKA_WALL_MARGIN) {
        piece.x = GAME_WIDTH - SUIKA_WALL_MARGIN - piece.r;
        piece.vx = -Math.abs(piece.vx) * wallDamping;
      }

      if (piece.y + piece.r > GAME_HEIGHT - 24) {
        piece.y = GAME_HEIGHT - 24 - piece.r;
        piece.vy = -Math.abs(piece.vy) * 0.26;
        piece.vx *= 0.82;
        if (Math.abs(piece.vy) < 16) {
          piece.vy = 0;
        }
      }
    }

    for (let pass = 0; pass < 7; pass += 1) {
      for (let i = 0; i < pieces.length; i += 1) {
        for (let j = i + 1; j < pieces.length; j += 1) {
          separatePieces(pieces[i], pieces[j]);
        }
      }
    }
  }

  function separatePieces(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
    const overlap = a.r + b.r - distance;
    const stackPush = suikaBalancedStackPush(a, b, overlap);
    if (overlap <= 0) {
      applyBalancedStackPush(a, b, stackPush);
      return;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    const push = overlap / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;

    const relativeVelocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (relativeVelocity < 0) {
      const impulse = -(1 + collisionDamping) * relativeVelocity * 0.5;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;
    }

    applyBalancedStackPush(a, b, stackPush);
  }

  function applyBalancedStackPush(a, b, stackPush) {
    if (stackPush === 0) {
      return;
    }

    a.vx -= stackPush;
    b.vx += stackPush;
  }

  function mergeTouching(activeGame) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < pieces.length; i += 1) {
        for (let j = i + 1; j < pieces.length; j += 1) {
          const a = pieces[i];
          const b = pieces[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const touch = Math.sqrt(dx * dx + dy * dy) <= a.r + b.r + 2;
          if (!touch || a.level !== b.level) {
            continue;
          }

          a.x = (a.x + b.x) / 2;
          a.y = (a.y + b.y) / 2;
          a.vx = (a.vx + b.vx) * 0.22;
          a.vy = Math.max(30, (a.vy + b.vy) * 0.18);
          a.age = 0;
          a.level += 1;
          a.r = mergeLevel(a.level).r;
          pieces.splice(j, 1);
          activeGame.score += scoreSuikaMerge(a.level);
          setScore(activeGame.score);
          changed = true;
          break;
        }
        if (changed) {
          break;
        }
      }
    }
  }

  function mergeLevel(level) {
    if (baseLevels[level]) {
      return baseLevels[level];
    }

    const extra = level - baseLevels.length + 1;
    return {
      r: Math.min(196, 145 + extra * 22),
      fill: level % 2 === 0 ? "#f6f0ff" : "#e8fff6",
      ink: level % 2 === 0 ? "#24113d" : "#0e3324",
      accent: level % 3 === 0 ? "#df4f3f" : "#2f8fdd",
    };
  }

  function drawSuikaLimitLine(overLimitElapsed, overLimitActive) {
    const blinkVisible = !overLimitActive || isSuikaLimitBlinkVisible(overLimitElapsed);
    gameCtx.save();
    gameCtx.setLineDash([14, 10]);
    gameCtx.strokeStyle = overLimitActive ? "#d24b3f" : "#000000";
    gameCtx.globalAlpha = overLimitActive ? (blinkVisible ? 1 : 0.18) : 0.72;
    gameCtx.lineWidth = overLimitActive ? 4 : 3;
    gameCtx.beginPath();
    gameCtx.moveTo(SUIKA_WALL_MARGIN, SUIKA_LIMIT_Y);
    gameCtx.lineTo(GAME_WIDTH - SUIKA_WALL_MARGIN, SUIKA_LIMIT_Y);
    gameCtx.stroke();
    gameCtx.restore();
  }

  function drawMergePiece(piece) {
    const level = mergeLevel(piece.level);
    gameCtx.fillStyle = level.fill;
    gameCtx.beginPath();
    gameCtx.arc(piece.x, piece.y, piece.r, 0, TAU);
    gameCtx.fill();
    gameCtx.strokeStyle = "#000000";
    gameCtx.lineWidth = 2;
    gameCtx.stroke();
    gameCtx.strokeStyle = level.accent;
    gameCtx.lineWidth = 3;
    gameCtx.beginPath();
    gameCtx.arc(piece.x, piece.y, piece.r - 7, -0.4, TAU * 0.72);
    gameCtx.stroke();
    drawCat(
      gameCtx,
      catVariantSprite(sprite, piece.level, level),
      piece.x,
      piece.y,
      piece.r * 1.88,
      piece.r * 1.42,
      ((piece.level % 5) - 2) * 0.025,
      0.98,
    );
  }

  return game;
}

function createStack(sprite) {
  const blockHeight = 34;
  const startWidth = 270;
  const minWidth = 70;
  const blocks = [
    { x: GAME_WIDTH / 2 - 170, y: GAME_HEIGHT - 48, w: 340, h: blockHeight, base: true },
  ];

  const game = {
    done: false,
    message: "",
    score: 0,
    current: makeBlock(0),
    action() {
      if (this.done || !this.current) {
        return;
      }

      const top = blocks[blocks.length - 1];
      const left = Math.max(top.x, this.current.x);
      const right = Math.min(top.x + top.w, this.current.x + this.current.w);
      const overlap = right - left;
      if (overlap < 24) {
        finish(this, "fell");
        return;
      }

      blocks.push({ x: this.current.x, y: top.y - this.current.h, w: this.current.w, h: this.current.h });
      const clean = overlap > Math.min(top.w, this.current.w) * 0.92;
      this.score += scoreStackDrop({ clean });
      if (clean) {
        setStatus("clean stack");
      } else {
        setStatus("stacked");
      }
      setScore(this.score);

      while (blocks[blocks.length - 1].y < 110) {
        for (const block of blocks) {
          block.y += this.current.h + 10;
        }
      }

      this.current = makeBlock(stackProgressForNextBlock(blocks.length));
    },
    update(dt) {
      this.current.x += this.current.vx * dt;
      if (this.current.x <= 14 || this.current.x + this.current.w >= GAME_WIDTH - 14) {
        this.current.vx *= -1;
        this.current.x = clamp(this.current.x, 14, GAME_WIDTH - 14 - this.current.w);
      }
    },
    draw() {
      drawGameBackground("blocks  click/space = drop");
      for (const block of blocks) {
        drawBlock(block, false);
      }
      drawBlock(this.current, true);
      if (this.done) {
        drawOverlay(this.message);
      }
    },
  };

  function makeBlock(progress) {
    const top = blocks[blocks.length - 1];
    const width = stackBlockWidth(progress, startWidth, minWidth);
    const speed = stackBlockSpeed(progress);
    const startsLeft = progress % 2 === 0;
    return {
      x: startsLeft ? 18 : GAME_WIDTH - width - 18,
      y: top.y - blockHeight,
      w: width,
      h: blockHeight,
      vx: (startsLeft ? 1 : -1) * speed,
    };
  }

  function drawBlock(block, active) {
    outlinedRect(block.x, block.y, block.w, block.h);
    if (!block.base) {
      drawCat(
        gameCtx,
        sprite,
        block.x + block.w / 2,
        block.y + block.h / 2,
        Math.min(block.w - 8, 132),
        block.h + 26,
        0,
        active ? 1 : 0.76,
      );
    }
  }

  return game;
}

function startGameMode(modeName, { duel = false } = {}) {
  const sprite = makeCatSprite();
  if (!sprite) {
    setStatus("draw a cat first");
    openDraw();
    drawCanvas.classList.remove("shake");
    window.requestAnimationFrame(() => drawCanvas.classList.add("shake"));
    return;
  }

  closeDrawIfOpen();
  const mode = getModeByName(modeName);
  state.pointerX = GAME_WIDTH / 2;
  state.currentSprite = sprite;
  state.game = mode.create(sprite);
  state.game.modeName = mode.name;
  state.game.saved = false;
  setLeaderboardMode(mode.name);
  modeEl.textContent = mode.name;
  setScore(0);
  if (duel) {
    state.duel.mode = mode.name;
  }
  setStatus(`${mode.name} started. mouse, arrows, space.`);
  state.game.draw();
}

function startRandomGame() {
  const modeName = state.duel.active && state.duel.mode ? state.duel.mode : randomModeName();
  startGameMode(modeName, { duel: state.duel.active });
}

function closeDrawIfOpen() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function drawIdleGame() {
  drawGameBackground("ready");
  const sprite = makeCatSprite();
  if (sprite) {
    drawCat(gameCtx, sprite, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 26, 330, 240);
  }
  gameCtx.save();
  gameCtx.fillStyle = "#000000";
  gameCtx.font = `42px ${BAD_FONT}`;
  gameCtx.textAlign = "center";
  gameCtx.fillText("start", GAME_WIDTH / 2, 96);
  gameCtx.font = `18px ${BAD_FONT}`;
  gameCtx.fillText("draw opens the paint popup", GAME_WIDTH / 2, 126);
  gameCtx.restore();
}

function tick(time) {
  const dt = Math.min(0.033, Math.max(0, (time - state.lastFrame) / 1000));
  state.lastFrame = time;

  if (state.game) {
    if (!state.game.done) {
      state.game.update(dt, time);
    }
    state.game.draw();
  }

  window.requestAnimationFrame(tick);
}

drawCanvas.addEventListener("pointerdown", startStroke);
drawCanvas.addEventListener("pointermove", continueStroke);
drawCanvas.addEventListener("pointerup", endStroke);
drawCanvas.addEventListener("pointercancel", endStroke);
drawCanvas.addEventListener("pointerleave", endStroke);

clearButton.addEventListener("click", clearDrawing);
resetButton.addEventListener("click", drawBadCatSeed);
openDrawButton.addEventListener("click", openDraw);
closeDrawButton.addEventListener("click", closeDraw);
startButton.addEventListener("click", startRandomGame);
createDuelButton.addEventListener("click", () => {
  void createDuel();
});
joinDuelButton.addEventListener("click", () => {
  void joinDuel();
});
leaveDuelButton.addEventListener("click", () => {
  void leaveDuel();
});
refreshLeaderboardButton.addEventListener("click", () => {
  setStatus("refreshing scores");
  void refreshLeaderboard();
});
leaderboardModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLeaderboardMode(button.dataset.leaderboardMode);
  });
});
playerNameEl.addEventListener("change", () => {
  rememberPlayerName();
  setStatus("name saved");
});
duelRoomCodeEl.addEventListener("input", () => {
  duelRoomCodeEl.value = normalizeDuelRoomCode(duelRoomCodeEl.value);
});
duelChatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = duelChatInput.value;
  duelChatInput.value = "";
  void sendDuelMessage(text).catch(() => setStatus("chat send failed"));
});
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeDraw();
  }
});

gameCanvas.addEventListener("pointermove", (event) => {
  state.pointerX = canvasPoint(gameCanvas, event).x;
});

gameCanvas.addEventListener("pointerdown", (event) => {
  state.pointerX = canvasPoint(gameCanvas, event).x;
  state.game?.action();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && modal.classList.contains("is-open")) {
    closeDraw();
    return;
  }

  if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(event.code)) {
    event.preventDefault();
  }

  if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(event.code)) {
    state.keys.add(event.code);
  }

  if (event.code === "Space") {
    state.game?.action();
  }
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.code);
});

playerNameEl.value = loadPlayerName();
migrateOldLocalScores();
state.leaderboard = loadLeaderboardCache();
renderLeaderboard();
setDuelControlsActive(false);
drawRivalPlaceholder("solo");
void refreshLeaderboard();
drawBadCatSeed();
drawIdleGame();
window.requestAnimationFrame(tick);
