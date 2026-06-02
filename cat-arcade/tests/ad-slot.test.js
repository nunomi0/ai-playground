import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

test("cat arcade does not load Google-served ads during AdSense review", () => {
  assert.doesNotMatch(html, /pagead2\.googlesyndication\.com/);
  assert.doesNotMatch(html, /ca-pub-1027069732528266/);
  assert.doesNotMatch(html, /adsbygoogle/);
  assert.doesNotMatch(html, /aria-label="Advertisement"/);
  assert.doesNotMatch(html, /class="ad-slot"/);
});

test("cat arcade keeps crawlable update notes as publisher content", () => {
  assert.match(html, /Fixed the arcade handoff/);
  assert.match(html, /Added per-game score tabs/);
  assert.match(html, /Adjusted falling speed curves/);
  assert.doesNotMatch(html, /\?[^\s<]*[寃蹂섎컯]/);
});

test("cat arcade removes obsolete ad slot styling", () => {
  assert.doesNotMatch(css, /\.ad-footer\s*{/);
  assert.doesNotMatch(css, /\.ad-slot\s*{/);
});
