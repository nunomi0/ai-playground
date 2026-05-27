import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  entityAt,
  findPath,
  getEnemies,
  getPlayer,
  isPassable,
  keyOf,
  lineOfSight,
  performAction,
  terrainAt,
} from "../public/engine.js";

const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

test("seeded runs build the same tactical map", () => {
  const first = createGame("logic-gauntlet");
  const second = createGame("logic-gauntlet");

  assert.deepEqual(
    first.terrain.map((tile) => `${tile.kind}:${tile.phase ?? ""}:${tile.variant ?? ""}`),
    second.terrain.map((tile) => `${tile.kind}:${tile.phase ?? ""}:${tile.variant ?? ""}`),
  );
  assert.deepEqual(first.items, second.items);
  assert.equal(first.totalFragments, 4);
  assert.equal(getEnemies(first).length, 8);
});

test("fragments are reachable from the core", () => {
  const state = createGame("reachability");
  state.entities = [getPlayer(state)];
  const player = getPlayer(state);

  for (const key of Object.keys(state.items)) {
    const [x, y] = key.split(",").map(Number);
    const path = findPath(state, player, { x, y }, { ignoreId: "player" });
    assert.ok(path.length > 0, `expected a path to ${key}`);
  }
});

test("movement records history and rewind restores the previous turn", () => {
  const state = createGame("rewind");
  const player = getPlayer(state);
  const direction = openDirection(state, player);

  const moved = performAction(state, { type: "move", dx: direction.dx, dy: direction.dy });
  const movedPlayer = getPlayer(moved);
  assert.equal(moved.history.length, 1);
  assert.notEqual(keyOf(movedPlayer.x, movedPlayer.y), keyOf(player.x, player.y));

  const rewound = performAction(moved, { type: "rewind" });
  const rewoundPlayer = getPlayer(rewound);
  assert.equal(keyOf(rewoundPlayer.x, rewoundPlayer.y), keyOf(player.x, player.y));
  assert.equal(rewoundPlayer.flux, player.flux - 1);
});

test("pulse damages and stuns nearby enemies", () => {
  const state = createGame("pulse");
  const player = getPlayer(state);
  const direction = openDirection(state, player);
  const blueprintHp = 4;
  state.entities = [
    player,
    {
      id: "test-hunter",
      kind: "hunter",
      team: "enemy",
      x: player.x + direction.dx,
      y: player.y + direction.dy,
      hp: blueprintHp,
      maxHp: blueprintHp,
      stun: 0,
      memory: null,
    },
  ];

  const after = performAction(state, { type: "pulse" });
  const enemy = getEnemies(after)[0];
  assert.ok(!enemy || enemy.hp <= blueprintHp - 2);
  assert.ok(getPlayer(after).energy <= 4);
});

test("visible hunters step closer after a wait turn", () => {
  const state = createGame("hunter-chase");
  const player = getPlayer(state);
  const enemyCell = visibleOpenCell(state, player);
  state.entities = [
    player,
    {
      id: "test-hunter",
      kind: "hunter",
      team: "enemy",
      x: enemyCell.x,
      y: enemyCell.y,
      hp: 4,
      maxHp: 4,
      stun: 0,
      memory: null,
    },
  ];
  const before = distance(player, enemyCell);

  const after = performAction(state, { type: "wait" });
  const enemy = getEnemies(after)[0];
  assert.ok(distance(getPlayer(after), enemy) < before);
});

test("a charged core wins by entering the exit", () => {
  const state = createGame("victory");
  const player = getPlayer(state);
  state.entities = [player];
  player.fragments = state.totalFragments;
  const exit = locateTile(state, "exit");
  const neighbor = DIRECTIONS.map((direction) => ({
    x: exit.x + direction.dx,
    y: exit.y + direction.dy,
    dx: -direction.dx,
    dy: -direction.dy,
  })).find((cell) => isPassable(state, cell.x, cell.y));

  assert.ok(neighbor, "expected an open exit neighbor");
  player.x = neighbor.x;
  player.y = neighbor.y;

  const after = performAction(state, { type: "move", dx: neighbor.dx, dy: neighbor.dy });
  assert.equal(after.victory, true);
});

function openDirection(state, player) {
  const direction = DIRECTIONS.find((candidate) => {
    const x = player.x + candidate.dx;
    const y = player.y + candidate.dy;
    return isPassable(state, x, y) && !entityAt(state, x, y);
  });
  assert.ok(direction, "expected at least one open direction");
  return direction;
}

function visibleOpenCell(state, player) {
  for (const direction of DIRECTIONS) {
    for (let distance = 3; distance >= 2; distance -= 1) {
      const x = player.x + direction.dx * distance;
      const y = player.y + direction.dy * distance;
      if (
        isPassable(state, x, y) &&
        !entityAt(state, x, y) &&
        lineOfSight(state, player.x, player.y, x, y)
      ) {
        return { x, y };
      }
    }
  }
  throw new Error("No visible open enemy cell found.");
}

function locateTile(state, kind) {
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (terrainAt(state, x, y).kind === kind) {
        return { x, y };
      }
    }
  }
  throw new Error(`No ${kind} tile found.`);
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
