import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

function cssRule(selector) {
  const escaped = selector.replace(".", "\\.");
  return css.match(new RegExp(`${escaped}\\s*{[^}]*}`))?.[0] ?? "";
}

test("cat arcade renders a labeled footer ad slot below the game", () => {
  const footerIndex = html.indexOf('<footer class="ad-footer"');
  const gamePanelIndex = html.indexOf('<section class="game-panel"');
  const scriptIndex = html.indexOf('<script type="module"');

  assert.ok(footerIndex > gamePanelIndex, "ad footer should appear after the game panel");
  assert.ok(footerIndex < scriptIndex, "ad footer should be part of the visible page");
  assert.match(html, /aria-label="Advertisement"/);
  assert.match(html, /Advertisement/);
  assert.match(html, /class="ad-slot"/);
});

test("cat arcade ad slot stays low priority without being hidden", () => {
  const adFooterRule = cssRule(".ad-footer");
  const adSlotRule = cssRule(".ad-slot");

  assert.ok(adFooterRule, "ad footer styles should exist");
  assert.ok(adSlotRule, "ad slot styles should exist");
  assert.doesNotMatch(`${adFooterRule}\n${adSlotRule}`, /display:\s*none/);
  assert.doesNotMatch(`${adFooterRule}\n${adSlotRule}`, /visibility:\s*hidden/);
  assert.doesNotMatch(`${adFooterRule}\n${adSlotRule}`, /opacity:\s*0(?:[;}\s])/);
});
