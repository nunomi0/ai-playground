export const GAME_WIDTH = 960;
export const SUIKA_WALL_MARGIN = 20;
export const SUIKA_LIMIT_Y = 58;
export const SUIKA_LIMIT_GRACE_SECONDS = 3;

function safeProgress(value) {
  return Math.max(0, Number(value) || 0);
}

export function breakoutInitialVelocity() {
  return { vx: 310, vy: -380 };
}

export function breakoutResetVelocity(direction = 1) {
  return { vx: 290 * (direction < 0 ? -1 : 1), vy: -380 };
}

export function breakoutRoundVelocity(round) {
  const safeRound = Math.max(1, Math.trunc(Number(round)) || 1);
  const direction = safeRound % 2 === 0 ? -1 : 1;
  return {
    vx: (310 + safeRound * 22) * direction,
    vy: -390 - safeRound * 14,
  };
}

export function breakoutPaddleBounceVelocity(hit, currentVy) {
  return {
    vx: hit * 430,
    vy: -Math.max(370, Math.abs(currentVy) + 16),
  };
}

export function dodgeObstacleSpeed(survivalTime, random = Math.random()) {
  const ramp = Math.min(300, safeProgress(survivalTime) * 9);
  return 200 + Math.max(0, Math.min(1, random)) * 115 + ramp;
}

export function dodgeSpawnInterval(survivalTime) {
  return Math.max(0.36, 0.82 - safeProgress(survivalTime) * 0.016);
}

export function clampSuikaPieceX(x, radius, gameWidth = GAME_WIDTH) {
  return Math.max(
    SUIKA_WALL_MARGIN + radius,
    Math.min(gameWidth - SUIKA_WALL_MARGIN - radius, x),
  );
}

export function droppedSuikaVelocity() {
  return { vx: 0, vy: 24 };
}

export function isOverSuikaLimit(piece) {
  return piece.y - piece.r < SUIKA_LIMIT_Y;
}

export function hasClearedSuikaLimit(piece) {
  return !isOverSuikaLimit(piece);
}

export function isSuikaLimitThreat(piece) {
  return Boolean(piece.limitArmed) && isOverSuikaLimit(piece);
}

export function suikaLimitElapsedSeconds(startedAt, now) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) {
    return 0;
  }

  return Math.max(0, (now - startedAt) / 1000);
}

export function shouldFinishSuikaLimit(startedAt, now) {
  return suikaLimitElapsedSeconds(startedAt, now) >= SUIKA_LIMIT_GRACE_SECONDS;
}

export function isSuikaLimitBlinkVisible(elapsedSeconds) {
  return Math.floor(safeProgress(elapsedSeconds) * 6) % 2 === 0;
}

export function suikaBalancedStackPush(a, b, overlap) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > 1.5 || Math.abs(dy) < 1 || overlap < -2) {
    return 0;
  }

  const topPieceDirection = dy < 0 ? 1 : -1;
  return topPieceDirection * Math.min(22, 6 + Math.max(0, overlap) * 2);
}

export function stackProgressForNextBlock(blockCount) {
  return Math.max(0, Math.trunc(Number(blockCount)) - 1);
}

export function stackBlockSpeed(progress) {
  return 235 + safeProgress(progress) * 24;
}

export function stackBlockWidth(progress, startWidth = 270, minWidth = 70) {
  return Math.max(minWidth, startWidth - safeProgress(progress) * 11);
}
