import test from "node:test";
import assert from "node:assert/strict";

import {
  createLeaderboardEntry,
  fromSupabaseRow,
  insertLeaderboardEntry,
  isSupabaseEnabled,
  toSupabaseRow,
} from "../public/leaderboard.js";

test("createLeaderboardEntry trims the player name and normalizes the score", () => {
  const entry = createLeaderboardEntry(
    {
      name: "  Mina  ",
      score: "42.8",
      source: "manual",
    },
    () => 1710000000000,
  );

  assert.deepEqual(entry, {
    id: "1710000000000-42-Mina",
    name: "Mina",
    score: 42,
    source: "round",
    recordedAt: "2024-03-09T16:00:00.000Z",
  });
});

test("insertLeaderboardEntry keeps the list sorted by highest score first", () => {
  const entries = [
    createLeaderboardEntry({ name: "Ari", score: 18 }, () => 10),
    createLeaderboardEntry({ name: "Bea", score: 45 }, () => 20),
  ];
  const updated = insertLeaderboardEntry(
    entries,
    createLeaderboardEntry({ name: "Cho", score: 27 }, () => 30),
  );

  assert.deepEqual(
    updated.map((entry) => `${entry.name}:${entry.score}`),
    ["Bea:45", "Cho:27", "Ari:18"],
  );
});

test("insertLeaderboardEntry breaks score ties by newest entry first", () => {
  const entries = [
    createLeaderboardEntry({ name: "Ari", score: 30 }, () => 10),
    createLeaderboardEntry({ name: "Bea", score: 30 }, () => 20),
  ];
  const updated = insertLeaderboardEntry(
    entries,
    createLeaderboardEntry({ name: "Cho", score: 30 }, () => 30),
  );

  assert.deepEqual(
    updated.map((entry) => entry.name),
    ["Cho", "Bea", "Ari"],
  );
});

test("isSupabaseEnabled returns true only when url and anon key are present", () => {
  assert.equal(isSupabaseEnabled(null), false);
  assert.equal(isSupabaseEnabled({ supabaseUrl: "https://example.supabase.co" }), false);
  assert.equal(isSupabaseEnabled({ supabaseAnonKey: "anon-key" }), false);
  assert.equal(
    isSupabaseEnabled({
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon-key",
    }),
    true,
  );
});

test("toSupabaseRow maps a local entry to the database contract", () => {
  const entry = createLeaderboardEntry(
    {
      name: "Mina",
      score: 42,
      source: "manual",
    },
    () => 1710000000000,
  );

  assert.deepEqual(toSupabaseRow(entry), {
    player_name: "Mina",
    score: 42,
    source: "round",
    client_id: entry.id,
    created_at: "2024-03-09T16:00:00.000Z",
  });
});

test("fromSupabaseRow coerces legacy non-round rows to round", () => {
  assert.deepEqual(
    fromSupabaseRow({
      id: 8,
      player_name: "Legacy",
      score: 12,
      source: "manual",
      created_at: "2026-05-02T13:10:00.000Z",
      client_id: "remote-8",
    }),
    {
      id: "remote-8",
      name: "Legacy",
      score: 12,
      source: "round",
      recordedAt: "2026-05-02T13:10:00.000Z",
    },
  );
});

test("fromSupabaseRow normalizes a database row into a leaderboard entry", () => {
  assert.deepEqual(
    fromSupabaseRow({
      id: 7,
      player_name: "Ari",
      score: "58",
      source: "round",
      created_at: "2026-05-02T13:10:00.000Z",
      client_id: "remote-7",
    }),
    {
      id: "remote-7",
      name: "Ari",
      score: 58,
      source: "round",
      recordedAt: "2026-05-02T13:10:00.000Z",
    },
  );
});
