import assert from "node:assert/strict";
import test from "node:test";

import {
  scoreBreakoutBrick,
  scoreDodgeSurvival,
  scoreStackDrop,
  scoreSuikaMerge,
} from "../public/scoring.js";

test("non-suika modes award scores in the same broad range as suika", () => {
  assert.equal(scoreBreakoutBrick(), 120);
  assert.equal(scoreDodgeSurvival(0, 1), 100);
  assert.equal(scoreStackDrop({ clean: false }), 420);
  assert.equal(scoreStackDrop({ clean: true }), 840);
});

test("suika merge scoring is preserved", () => {
  assert.equal(scoreSuikaMerge(1), 36);
  assert.equal(scoreSuikaMerge(4), 90);
});
