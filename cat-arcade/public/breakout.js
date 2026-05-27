const GAME_WIDTH = 960;

export function createBreakoutBricks(round = 1) {
  const safeRound = Math.max(1, Math.trunc(Number(round)) || 1);
  const cols = safeRound % 2 === 0 ? 8 : 10;
  const rows = Math.min(7, 4 + safeRound);
  const gap = 8;
  const sideMargin = safeRound % 2 === 0 ? 62 : 40;
  const brickWidth = (GAME_WIDTH - sideMargin * 2 - gap * (cols - 1)) / cols;
  const stagger = safeRound % 3 === 0 ? brickWidth * 0.34 : 0;
  const bricks = [];

  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 === 1 ? stagger : 0;
    for (let col = 0; col < cols; col += 1) {
      const x = sideMargin + col * (brickWidth + gap) + offset;
      if (x + brickWidth > GAME_WIDTH - sideMargin / 2) {
        continue;
      }

      bricks.push({
        x,
        y: 56 + row * 34,
        w: brickWidth,
        h: 22,
        alive: true,
      });
    }
  }

  return bricks;
}
