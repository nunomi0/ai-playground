import test from "node:test";
import assert from "node:assert/strict";

import {
  GRID_SIZE,
  createGameState,
  placeFood,
  queueDirection,
  resolvePendingDirection,
  stepGame,
} from "../src/game.js";

test("queueDirection blocks direct reversal", () => {
  assert.equal(queueDirection("right", "left"), "right");
  assert.equal(queueDirection("up", "down"), "up");
});

test("resolvePendingDirection keeps the latest valid turn", () => {
  assert.equal(resolvePendingDirection("right", "up"), "up");
  assert.equal(resolvePendingDirection("right", "down"), "down");
});

test("resolvePendingDirection ignores direct reversals", () => {
  assert.equal(resolvePendingDirection("right", "left"), null);
  assert.equal(resolvePendingDirection("up", "down"), null);
});

test("stepGame moves snake forward without growing", () => {
  const initial = createGameState(() => 0);
  const next = stepGame(
    {
      ...initial,
      status: "running",
      food: { x: 0, y: 0 },
    },
    () => 0,
  );

  assert.deepEqual(next.snake, [
    { x: 5, y: 8 },
    { x: 4, y: 8 },
    { x: 3, y: 8 },
  ]);
  assert.equal(next.score, 0);
});

test("stepGame grows snake and increments score when food is eaten", () => {
  const initial = createGameState(() => 0.5);
  const next = stepGame(
    {
      ...initial,
      status: "running",
      food: { x: 5, y: 8 },
    },
    () => 0,
  );

  assert.equal(next.snake.length, initial.snake.length + 1);
  assert.equal(next.score, 1);
  assert.notDeepEqual(next.food, { x: 5, y: 8 });
});

test("stepGame ends game on wall collision", () => {
  const next = stepGame({
    snake: [{ x: GRID_SIZE - 1, y: 0 }],
    direction: "right",
    nextDirection: "right",
    food: { x: 0, y: 0 },
    score: 0,
    status: "running",
  });

  assert.equal(next.status, "game-over");
});

test("stepGame ends game on self collision", () => {
  const next = stepGame({
    snake: [
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ],
    direction: "up",
    nextDirection: "left",
    food: { x: 0, y: 0 },
    score: 0,
    status: "running",
  });

  assert.equal(next.status, "game-over");
});

test("stepGame allows moving into the tail cell when the tail advances", () => {
  const next = stepGame({
    snake: [
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
    ],
    direction: "up",
    nextDirection: "left",
    food: { x: 0, y: 0 },
    score: 0,
    status: "running",
  });

  assert.equal(next.status, "running");
  assert.deepEqual(next.snake, [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ]);
});

test("placeFood avoids occupied cells", () => {
  const snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];

  const food = placeFood(snake, 2, () => 0);
  assert.deepEqual(food, { x: 1, y: 1 });
});
