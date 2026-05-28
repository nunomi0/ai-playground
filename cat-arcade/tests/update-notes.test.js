import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

test("cat arcade shows dated update notes", () => {
  assert.match(html, /<section class="update-panel" aria-labelledby="updateTitle">/);
  assert.match(html, /<h2 id="updateTitle">updates<\/h2>/);
  assert.match(html, /<time datetime="2026-05-28T09:57:00\+09:00">2026-05-28 09:57 KST<\/time>/);
  assert.match(html, /게임별 랭킹 탭 추가/);
  assert.match(html, /9999점 제한 해제/);
  assert.match(html, /수박게임 마지노선 3초 지속 판정/);
});

test("cat arcade update notes have stable panel styles", () => {
  assert.match(css, /\.update-panel\s*\{/);
  assert.match(css, /\.update-list\s*\{/);
  assert.match(css, /\.update-item time\s*\{/);
});
