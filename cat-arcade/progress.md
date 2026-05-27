Original prompt: 모바일에서 수박게임 비율 약간깨지는데 확인해서 고쳐.

## 2026-05-28

- Investigating mobile aspect distortion in Bad Cat Arcade, especially suika mode.
- Root cause found: mobile CSS overrides `#gameCanvas` to `aspect-ratio: 4 / 3` while the canvas bitmap is `960x600` (`16 / 10`), so all canvas drawings become vertically stretched on narrow screens.
- Added a regression test for mobile canvas aspect alignment and changed the mobile canvas rule to `16 / 10`.
