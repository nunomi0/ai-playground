export const SCORE_RULES = Object.freeze({
  breakoutBrick: 120,
  dodgePerSecond: 100,
  stackDrop: 420,
  stackCleanBonus: 420,
  suikaMergeBase: 18,
});

export function scoreBreakoutBrick() {
  return SCORE_RULES.breakoutBrick;
}

export function scoreDodgeSurvival(currentScore, dt) {
  return currentScore + dt * SCORE_RULES.dodgePerSecond;
}

export function scoreStackDrop({ clean }) {
  return SCORE_RULES.stackDrop + (clean ? SCORE_RULES.stackCleanBonus : 0);
}

export function scoreSuikaMerge(level) {
  return (level + 1) * SCORE_RULES.suikaMergeBase;
}
