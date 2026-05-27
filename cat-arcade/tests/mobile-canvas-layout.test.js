import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

function gameCanvasBitmapAspect() {
  const match = html.match(/<canvas[^>]*id="gameCanvas"[^>]*>/);
  assert.ok(match, "game canvas should exist");

  const width = Number(match[0].match(/width="(\d+)"/)?.[1]);
  const height = Number(match[0].match(/height="(\d+)"/)?.[1]);
  assert.ok(width > 0 && height > 0, "game canvas should declare bitmap dimensions");

  return `${width / 60} / ${height / 60}`;
}

test("mobile layout keeps the game canvas aspect ratio aligned with the bitmap", () => {
  const expectedAspect = gameCanvasBitmapAspect();
  const mobileRule = css.match(/@media \(max-width: 760px\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  const canvasRule = mobileRule.match(/#gameCanvas\s*\{[^}]*\}/)?.[0] ?? "";

  assert.ok(canvasRule, "mobile styles should include a game canvas rule");
  assert.match(canvasRule, new RegExp(`aspect-ratio:\\s*${expectedAspect.replace("/", "\\/")}`));
});
