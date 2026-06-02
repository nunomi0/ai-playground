import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

test("cat arcade shows dated update notes", () => {
  assert.match(html, /<section class="update-panel" aria-labelledby="updateTitle">/);
  assert.match(html, /<h2 id="updateTitle">updates<\/h2>/);
  assert.match(html, /<time datetime="2026-06-02T11:30:00\+09:00">2026-06-02 11:30 KST<\/time>/);
  assert.match(html, /Added 1v1 duel rooms with WebRTC rival streaming, chat, lobby-ready starts, and a cleaner solo\/duel layout/);
  assert.match(html, /<time datetime="2026-05-28T09:57:00\+09:00">2026-05-28 09:57 KST<\/time>/);
  assert.match(html, /Added per-game score tabs/);
  assert.match(html, /Removed the old 9999 point cap/);
  assert.match(html, /Added a three-second countdown/);
  assert.doesNotMatch(html, /寃뚯엫|섎컯|釉붾줉|踰쎈룎/);
});

test("cat arcade update notes have stable panel styles", () => {
  assert.match(css, /\.update-panel\s*\{/);
  assert.match(css, /\.update-list\s*\{/);
  assert.match(css, /\.update-item time\s*\{/);
});
