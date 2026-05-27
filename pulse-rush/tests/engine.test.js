import test from "node:test";
import assert from "node:assert/strict";
import { clamp, classifyPace, scoreCityPulse, trendLabel } from "../public/engine.js";

test("clamp keeps values inside the expected range", () => {
  assert.equal(clamp(120), 100);
  assert.equal(clamp(-12), 0);
  assert.equal(clamp(Number.NaN), 0);
});

test("scoreCityPulse weights traffic and attention signals", () => {
  const quiet = scoreCityPulse({ traffic: 10, weather: 10, news: 10, social: 10, crowd: 10 });
  const busy = scoreCityPulse({ traffic: 90, weather: 60, news: 90, social: 90, crowd: 80 });

  assert.ok(busy > quiet);
  assert.equal(scoreCityPulse({ traffic: 200, weather: 200, news: 200, social: 200, crowd: 200 }), 100);
});

test("classifyPace maps motion speed to layout density", () => {
  assert.equal(classifyPace(100).key, "settled");
  assert.equal(classifyPace(900).key, "flow");
  assert.equal(classifyPace(2200).key, "sprint");
});

test("trendLabel names pulse bands", () => {
  assert.equal(trendLabel(82), "Surging");
  assert.equal(trendLabel(60), "Moving");
  assert.equal(trendLabel(42), "Breathing");
  assert.equal(trendLabel(12), "Quiet");
});
