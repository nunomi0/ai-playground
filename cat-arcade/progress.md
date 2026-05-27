Original prompt: 모바일에서 수박게임 비율 약간깨지는데 확인해서 고쳐.

## 2026-05-28

- Investigating mobile aspect distortion in Bad Cat Arcade, especially suika mode.
- Root cause found: mobile CSS overrides `#gameCanvas` to `aspect-ratio: 4 / 3` while the canvas bitmap is `960x600` (`16 / 10`), so all canvas drawings become vertically stretched on narrow screens.
- Added a regression test for mobile canvas aspect alignment and changed the mobile canvas rule to `16 / 10`.
- Committed the ad slot and mobile canvas fix as `2b19874`.
- Rebalanced non-suika scoring through `public/scoring.js`: breakout bricks now award 120, dodge awards 100 points per second, and blocks awards 420 per stack plus 420 for clean stacks. Suika merge scoring remains unchanged.
- Updated breakout so clearing all bricks starts the next brick set instead of ending the run. `public/breakout.js` generates varied round layouts and `tests/breakout.test.js` covers the layout refresh.
