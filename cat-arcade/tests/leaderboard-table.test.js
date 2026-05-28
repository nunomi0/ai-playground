import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../supabase/migrations/20260528090000_cat_arcade_scores.sql", import.meta.url),
  "utf8",
);

test("cat arcade leaderboard uses its own Supabase table", () => {
  assert.match(app, /LEADERBOARD_TABLE\s*=\s*"cat_arcade_scores"/);
  assert.doesNotMatch(app, /LEADERBOARD_TABLE\s*=\s*"prism_trio_scores"/);
  assert.match(html, /\/cat-arcade\/runtime-config\.js/);
});

test("cat arcade migration moves old prism trio rows into the new table", () => {
  assert.match(migration, /create table if not exists public\.cat_arcade_scores/);
  assert.match(migration, /insert into public\.cat_arcade_scores/);
  assert.match(migration, /from public\.prism_trio_scores/);
  assert.match(migration, /delete from public\.prism_trio_scores/);
  assert.match(migration, /client_id like 'cat-arcade:%'/);
});
