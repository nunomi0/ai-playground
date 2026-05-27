import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  canPlaceTool,
  cellAt,
  createGame,
  findPath,
  forecastRisk,
  indexOf,
  isPassable,
  keyOf,
  rankInterventions,
} from "../public/engine.js";

test("seeded lattices are deterministic", () => {
  const first = createGame("same-oracle");
  const second = createGame("same-oracle");

  assert.deepEqual(
    first.cells.map((cell) => `${cell.kind}:${cell.flow}:${cell.variant}:${cell.memoryId ?? ""}`),
    second.cells.map((cell) => `${cell.kind}:${cell.flow}:${cell.variant}:${cell.memoryId ?? ""}`),
  );
  assert.deepEqual(first.memories, second.memories);
  assert.deepEqual(first.fractures, second.fractures);
});

test("every memory can be reached from the core", () => {
  const state = createGame("reachable-oracle");

  for (const memory of state.memories) {
    const path = findPath(state, state.core, memory);
    assert.ok(path.length > 0, `expected a path to ${memory.name}`);
  }
});

test("advance returns a new state and changes the field", () => {
  const state = createGame("advance-oracle");
  const beforeSignal = [...state.signal];

  const after = applyAction(state, { type: "step", steps: 4 });

  assert.equal(state.tick, 0);
  assert.equal(after.tick, 4);
  assert.notDeepEqual(after.signal, beforeSignal);
});

test("tools validate placement and spend charge", () => {
  const state = createGame("placement-oracle");
  const channel = findFirstChannel(state);

  const placed = applyAction(state, {
    type: "place",
    tool: "anchor",
    x: channel.x,
    y: channel.y,
  });

  assert.equal(placed.toolCells[keyOf(channel.x, channel.y)].type, "anchor");
  assert.equal(placed.budget, state.budget - 4);
  assert.equal(canPlaceTool(placed, "anchor", channel.x, channel.y).ok, false);
});

test("an anchor lowers future fracture noise nearby", () => {
  const state = createGame("quiet-fracture");
  const fracture = state.fractures[0];
  const target = nearestChannel(state, fracture);
  const baseline = applyAction(state, { type: "step", steps: 18 });
  const anchored = applyAction(state, {
    type: "place",
    tool: "anchor",
    x: target.x,
    y: target.y,
  }, { force: true });
  const later = applyAction(anchored, { type: "step", steps: 18 });
  const fractureIndex = indexOf(state, fracture.x, fracture.y);

  assert.ok(
    later.noise[fractureIndex] < baseline.noise[fractureIndex],
    `expected ${later.noise[fractureIndex]} to be below ${baseline.noise[fractureIndex]}`,
  );
});

test("forecast does not mutate the current state", () => {
  const state = createGame("forecast-oracle");
  const snapshot = JSON.stringify(state);
  const forecast = forecastRisk(state, 12);

  assert.equal(forecast.cells.length, state.width * state.height);
  assert.equal(JSON.stringify(state), snapshot);
});

test("oracle recommendations are sorted by score", () => {
  const state = createGame("ranked-oracle");
  const recommendations = rankInterventions(state, "siphon", 4);

  assert.ok(recommendations.length > 0);
  for (let i = 1; i < recommendations.length; i += 1) {
    assert.ok(recommendations[i - 1].score >= recommendations[i].score);
  }
});

function findFirstChannel(state) {
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (cellAt(state, x, y).kind === "channel") {
        return { x, y };
      }
    }
  }
  throw new Error("No channel cell found.");
}

function nearestChannel(state, origin) {
  const queue = [{ x: origin.x, y: origin.y }];
  const seen = new Set([keyOf(origin.x, origin.y)]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (cellAt(state, current.x, current.y).kind === "channel") {
      return current;
    }

    for (const direction of [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
    ]) {
      const next = { x: current.x + direction.dx, y: current.y + direction.dy };
      const key = keyOf(next.x, next.y);
      if (seen.has(key) || !isPassable(state, next.x, next.y)) {
        continue;
      }
      seen.add(key);
      queue.push(next);
    }
  }
  throw new Error("No nearby channel found.");
}
