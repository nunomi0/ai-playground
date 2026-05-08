import test from "node:test";
import assert from "node:assert/strict";

import {
  MATERIALS,
  createWorld,
  getCell,
  paintCircle,
  setCell,
  stepWorld,
} from "../src/simulation.js";

test("paintCircle writes the chosen material into the grid", () => {
  const world = createWorld(5, 5);

  paintCircle(world, 2, 2, 1, MATERIALS.SAND);

  assert.equal(getCell(world, 2, 2), MATERIALS.SAND);
  assert.equal(getCell(world, 2, 1), MATERIALS.SAND);
  assert.equal(getCell(world, 0, 0), MATERIALS.EMPTY);
});

test("stepWorld drops sand into empty space", () => {
  const world = createWorld(3, 4);
  setCell(world, 1, 1, MATERIALS.SAND);

  const next = stepWorld(world, () => 0);

  assert.equal(getCell(next, 1, 2), MATERIALS.SAND);
  assert.equal(getCell(next, 1, 1), MATERIALS.EMPTY);
});

test("stepWorld lets water flow sideways when blocked below", () => {
  const world = createWorld(3, 3);
  setCell(world, 1, 1, MATERIALS.WATER);
  setCell(world, 1, 2, MATERIALS.STONE);

  const next = stepWorld(world, () => 0);

  assert.equal(getCell(next, 0, 1), MATERIALS.WATER);
  assert.equal(getCell(next, 1, 1), MATERIALS.EMPTY);
});

test("stepWorld ages fire into smoke", () => {
  const world = createWorld(3, 3);
  setCell(world, 1, 1, MATERIALS.FIRE, 1);

  const next = stepWorld(world, () => 0);

  assert.equal(getCell(next, 1, 1), MATERIALS.SMOKE);
});

test("stepWorld makes smoke rise", () => {
  const world = createWorld(3, 4);
  setCell(world, 1, 2, MATERIALS.SMOKE, 3);

  const next = stepWorld(world, () => 0);

  assert.equal(getCell(next, 1, 1), MATERIALS.SMOKE);
  assert.equal(getCell(next, 1, 2), MATERIALS.EMPTY);
});
