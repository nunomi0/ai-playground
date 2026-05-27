import assert from "node:assert/strict";
import test from "node:test";

import { createBreakoutBricks } from "../public/breakout.js";

test("breakout rounds generate a fresh brick set with a different layout", () => {
  const firstRound = createBreakoutBricks(1);
  const secondRound = createBreakoutBricks(2);

  assert.ok(firstRound.length > 0);
  assert.ok(secondRound.length > 0);
  assert.ok(firstRound.every((brick) => brick.alive));
  assert.ok(secondRound.every((brick) => brick.alive));
  assert.notDeepEqual(
    secondRound.map(({ x, y, w, h }) => ({ x, y, w, h })),
    firstRound.map(({ x, y, w, h }) => ({ x, y, w, h })),
  );
});
