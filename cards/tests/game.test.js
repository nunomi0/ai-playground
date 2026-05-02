import test from "node:test";
import assert from "node:assert/strict";

import { buildDeck, evaluateMatch, play } from "../public/game.js";

test("buildDeck creates duplicate suit-rank pairs so Prism matches are possible", () => {
  const deck = buildDeck();
  const counts = new Map();

  for (const card of deck) {
    const key = `${card.suit}:${card.rank}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  assert.equal(deck.length, 72);
  assert.equal(counts.size, 36);
  for (const count of counts.values()) {
    assert.equal(count, 2);
  }
});

test("evaluateMatch picks Bond when it beats Twin", () => {
  const result = evaluateMatch(
    { id: "h-5", suit: "azure", rank: 5 },
    { id: "b-5", suit: "gold", rank: 5 },
  );

  assert.deepEqual(result, {
    kind: "bond",
    points: 20,
    label: "BOND OF TEN",
  });
});

test("evaluateMatch picks Bond when it beats Hue", () => {
  const result = evaluateMatch(
    { id: "h-1", suit: "verdant", rank: 1 },
    { id: "b-9", suit: "verdant", rank: 9 },
  );

  assert.deepEqual(result, {
    kind: "bond",
    points: 20,
    label: "BOND OF TEN",
  });
});

test("evaluateMatch keeps Hue when it beats Bond", () => {
  const result = evaluateMatch(
    { id: "h-9", suit: "crimson", rank: 9 },
    { id: "b-1", suit: "crimson", rank: 1 },
  );

  assert.deepEqual(result, {
    kind: "hue",
    points: 27,
    label: "HUE MATCH",
  });
});

test("evaluateMatch picks Prism when all major conditions overlap", () => {
  const result = evaluateMatch(
    { id: "h-5", suit: "gold", rank: 5 },
    { id: "b-5", suit: "gold", rank: 5 },
  );

  assert.deepEqual(result, {
    kind: "perfect",
    points: 25,
    label: "PRISM",
  });
});

test("play adds the highest scoring applicable result to the round total", () => {
  const state = {
    deck: [],
    hand: [{ id: "h-5", suit: "azure", rank: 5 }],
    board: [{ id: "b-5", suit: "gold", rank: 5 }],
    score: 7,
    turn: 1,
    log: [],
    over: false,
  };

  const next = play(state, 0, 0);

  assert.equal(next.score, 27);
  assert.equal(next.log[0].result.kind, "bond");
});
