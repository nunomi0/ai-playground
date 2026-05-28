import assert from "node:assert/strict";
import test from "node:test";

import {
  SUIKA_LIMIT_GRACE_SECONDS,
  SUIKA_WALL_MARGIN,
  breakoutInitialVelocity,
  breakoutPaddleBounceVelocity,
  breakoutResetVelocity,
  breakoutRoundVelocity,
  clampSuikaPieceX,
  dodgeObstacleSpeed,
  dodgeSpawnInterval,
  droppedSuikaVelocity,
  isOverSuikaLimit,
  isSuikaLimitBlinkVisible,
  shouldFinishSuikaLimit,
  stackBlockSpeed,
  stackBlockWidth,
  stackProgressForNextBlock,
  suikaLimitElapsedSeconds,
} from "../public/game-rules.js";

test("breakout ball tuning starts faster and ramps by round", () => {
  assert.deepEqual(breakoutInitialVelocity(), { vx: 310, vy: -380 });
  assert.deepEqual(breakoutResetVelocity(-1), { vx: -290, vy: -380 });
  assert.deepEqual(breakoutRoundVelocity(2), { vx: -354, vy: -418 });
  assert.deepEqual(breakoutPaddleBounceVelocity(0.5, 390), { vx: 215, vy: -406 });
  assert.deepEqual(breakoutPaddleBounceVelocity(0, 100), { vx: 0, vy: -370 });
});

test("dodge difficulty ramps quickly from survival time", () => {
  assert.equal(dodgeObstacleSpeed(0, 0), 200);
  assert.equal(dodgeObstacleSpeed(0, 1), 315);
  assert.equal(dodgeObstacleSpeed(30, 0), 470);
  assert.equal(dodgeObstacleSpeed(90, 1), 615);
  assert.equal(dodgeSpawnInterval(0), 0.82);
  assert.equal(dodgeSpawnInterval(30), 0.36);
  assert.equal(dodgeSpawnInterval(90), 0.36);
});

test("stacking difficulty advances by placed block count instead of score", () => {
  const firstMovingBlock = stackProgressForNextBlock(1);
  const secondMovingBlock = stackProgressForNextBlock(2);

  assert.equal(firstMovingBlock, 0);
  assert.equal(stackBlockSpeed(firstMovingBlock), 235);
  assert.equal(stackBlockWidth(firstMovingBlock), 270);
  assert.equal(secondMovingBlock, 1);
  assert.equal(stackBlockSpeed(secondMovingBlock), 259);
  assert.equal(stackBlockWidth(secondMovingBlock), 259);
});

test("suika cursor reaches the same side walls used by physics", () => {
  const radius = 36;

  assert.equal(clampSuikaPieceX(-100, radius), SUIKA_WALL_MARGIN + radius);
  assert.equal(clampSuikaPieceX(2000, radius), 960 - SUIKA_WALL_MARGIN - radius);
});

test("suika drops straight down and uses a three second limit grace period", () => {
  assert.deepEqual(droppedSuikaVelocity(), { vx: 0, vy: 24 });
  assert.equal(SUIKA_LIMIT_GRACE_SECONDS, 3);
  assert.equal(isOverSuikaLimit({ y: 52, r: 36 }), true);
  assert.equal(isOverSuikaLimit({ y: 93, r: 36 }), true);
  assert.equal(isOverSuikaLimit({ y: 94, r: 36 }), false);
  assert.equal(suikaLimitElapsedSeconds(1000, 3999), 2.999);
  assert.equal(shouldFinishSuikaLimit(1000, 3999), false);
  assert.equal(shouldFinishSuikaLimit(1000, 4000), true);
  assert.equal(shouldFinishSuikaLimit(null, 4000), false);
  assert.equal(isSuikaLimitBlinkVisible(0), true);
  assert.equal(isSuikaLimitBlinkVisible(0.17), false);
  assert.equal(isSuikaLimitBlinkVisible(0.34), true);
});
