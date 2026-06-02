import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const schema = readFileSync(
  new URL("../../supabase/cat_arcade_scores.sql", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../../supabase/migrations/20260602090000_cat_arcade_duels.sql", import.meta.url),
  "utf8",
);

test("cat arcade exposes 1v1 duel controls with rival preview and chat", () => {
  for (const id of [
    "duelRoomCode",
    "createDuel",
    "joinDuel",
    "leaveDuel",
    "rivalCanvas",
    "rivalVideo",
    "duelChat",
    "duelChatForm",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  assert.match(css, /\.rival-panel\s*\{/);
  assert.match(css, /\.duel-chat\s*\{/);
});

test("cat arcade places duel status near the game title and rival before scores", () => {
  assert.match(html, /<div class="game-title-stack">[\s\S]*id="gameTitle"[\s\S]*id="gameStatus"/);
  assert.ok(
    html.indexOf('class="rival-panel"') < html.indexOf('class="leaderboard-panel"'),
    "rival panel should appear before scores",
  );
  assert.match(css, /\.game-title-stack\s*\{/);
  assert.match(css, /\.game-panel\.is-duel-room \.duel-arena\s*\{/);
  assert.match(css, /grid-template-columns:\s*minmax\(720px,\s*1fr\)\s*minmax\(220px,\s*280px\)/);
  assert.match(css, /@media \(max-width:\s*980px\)/);
});

test("cat arcade duel sync uses WebRTC for rival screen and chat", () => {
  assert.match(app, /DUEL_PLAYERS_TABLE\s*=\s*"cat_arcade_duel_players"/);
  assert.match(app, /DUEL_MESSAGES_TABLE\s*=\s*"cat_arcade_duel_messages"/);
  assert.match(app, /DUEL_SIGNALS_TABLE\s*=\s*"cat_arcade_duel_signals"/);
  assert.match(app, /new RTCPeerConnection\(DUEL_RTC_CONFIG\)/);
  assert.match(app, /gameCanvas\.captureStream\(24\)/);
  assert.match(app, /pc\.createDataChannel\("cat-arcade-duel"\)/);
  assert.match(app, /function sendDuelSignal\(signalType, payload/);
  assert.match(app, /state\.duel\.opponentId && signal\.sender_id !== state\.duel\.opponentId/);
  assert.match(app, /type:\s*"start-round"/);
  assert.match(app, /startGameMode\(modeName,\s*\{\s*duel:\s*true,\s*remote:\s*true\s*\}\)/);
  assert.match(app, /function sendDuelMessage\(message\)/);
  assert.match(app, /function pollDuelRoom\(\)/);
  assert.doesNotMatch(app, /startGameMode\(state\.duel\.mode,\s*\{\s*duel:\s*true\s*\}\)/);
});

test("cat arcade duel keeps rooms 1v1 and does not re-render local polled chat", () => {
  assert.match(app, /DUEL_PLAYER_KEY\s*=\s*"bad-cat-arcade-duel-session-player-id"/);
  assert.match(app, /storage = window\.sessionStorage/);
  assert.doesNotMatch(app, /storage = getStorage\(\);\s*const existing = storage\?\.getItem\(DUEL_PLAYER_KEY\)/);
  assert.match(app, /function freshDuelPlayers\(players\)/);
  assert.match(app, /function findDuelHost\(players\)/);
  assert.match(app, /setStatus\("duel room is full"\)/);
  assert.match(app, /function renderDuelMessages\(messages,\s*\{\s*includeSelf = false\s*\} = \{\}\)/);
  assert.match(app, /!includeSelf && message\.player_id === state\.duel\.playerId/);
  assert.match(app, /\{\s*includeSelf:\s*true\s*\}/);
});

test("cat arcade duel does not fall back to breakout when mode is missing", () => {
  assert.match(app, /function normalizeGameModeName\(mode,\s*fallback = "suika"\)/);
  assert.match(app, /function pickGameMode\(modeName,\s*fallback = randomModeName\(\)\)/);
  assert.doesNotMatch(app, /return modes\.find\(\(mode\) => mode\.name === modeName\) \?\? modes\[0\]/);
  assert.match(app, /await enterDuel\(roomCode,\s*"",\s*"guest",\s*host\)/);
  assert.match(app, /const mode = pickGameMode\(modeName\)/);
});

test("cat arcade duel tables allow anonymous room snapshots and messages", () => {
  for (const sql of [schema, migration]) {
    assert.match(sql, /create table if not exists public\.cat_arcade_duel_players/);
    assert.match(sql, /primary key \(room_code, player_id\)/);
    assert.match(sql, /snapshot jsonb not null/);
    assert.match(sql, /cat_arcade_duel_players_update_anon/);
    assert.match(sql, /create table if not exists public\.cat_arcade_duel_messages/);
    assert.match(sql, /char_length\(trim\(message\)\) between 1 and 140/);
    assert.match(sql, /create table if not exists public\.cat_arcade_duel_signals/);
    assert.match(sql, /signal_type in \('offer', 'answer', 'ice'\)/);
    assert.match(sql, /payload jsonb not null/);
  }
});
