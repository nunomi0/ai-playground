import test from "node:test";
import assert from "node:assert/strict";

import {
  INTERACTIVE_SEGMENT_IDS,
  SEGMENT_IDS,
  applySegmentImpulse,
  createSimulationState,
  getGiraffeSegments,
  setPointerTarget,
  stepSimulation,
} from "../src/simulation.js";

const VIEWPORT = { width: 960, height: 640 };

test("initial pose resolves to seven single-stroke segments", () => {
  const state = createSimulationState();
  const segments = getGiraffeSegments(state, VIEWPORT);

  assert.equal(segments.length, 7);
  assert.deepEqual(
    segments.map((segment) => segment.id),
    SEGMENT_IDS,
  );
  for (const segment of segments) {
    assert.ok(Array.isArray(segment.points));
    assert.equal(segment.points.length, 2);
    for (const point of segment.points) {
      assert.ok(Number.isFinite(point.x));
      assert.ok(Number.isFinite(point.y));
    }
  }
});

test("interactive segment list excludes the head", () => {
  assert.ok(INTERACTIVE_SEGMENT_IDS.includes("body"));
  assert.ok(INTERACTIVE_SEGMENT_IDS.includes("neck"));
  assert.ok(INTERACTIVE_SEGMENT_IDS.includes("leg-front-left"));
  assert.ok(!INTERACTIVE_SEGMENT_IDS.includes("head"));
});

test("mouse movement does not steer any part of the giraffe", () => {
  let state = createSimulationState();
  state = setPointerTarget(state, { x: 860, y: 120 }, VIEWPORT);
  state = stepSimulation(state, 0.12);

  assert.equal(state.targetLookAngle, 0, "pointer input should not change the target look angle");
  assert.equal(state.neckAngle, 0, "neck should not chase the cursor");
  assert.equal(state.bodyAngle, 0, "body should not follow the cursor");
  assert.equal(state.headAngle, 0, "head should not follow the cursor");
});

test("legs are single strokes that can bend without using visible joints", () => {
  const state = createSimulationState();
  const segments = getGiraffeSegments(state, VIEWPORT);
  const legIds = new Set([
    "leg-back-left",
    "leg-front-left",
    "leg-back-right",
    "leg-front-right",
  ]);

  for (const segment of segments) {
    if (legIds.has(segment.id)) {
      assert.equal(segment.points.length, 2, `${segment.id} should stay a single stroke`);
      assert.equal(typeof segment.bend, "number");
    } else {
      assert.equal(segment.bend ?? 0, 0, `${segment.id} should stay visually straight at rest`);
    }
  }
});

test("every leg stays attached to the body throughout the gait", () => {
  let state = createSimulationState();

  for (let index = 0; index < 16; index += 1) {
    state = stepSimulation(state, 1 / 12);
    const segments = getGiraffeSegments(state, VIEWPORT);
    const byId = Object.fromEntries(segments.map((segment) => [segment.id, segment]));
    const body = byId.body;

    for (const legId of [
      "leg-back-left",
      "leg-front-left",
      "leg-back-right",
      "leg-front-right",
    ]) {
      const leg = byId[legId];
      assert.ok(
        pointToSegmentDistance(leg.start, body.start, body.end) < 14,
        `${legId} should stay anchored to the body stroke`,
      );
    }
  }
});

test("body, neck, and head match the reference proportions", () => {
  const segments = getGiraffeSegments(createSimulationState(), VIEWPORT);
  const byId = Object.fromEntries(segments.map((segment) => [segment.id, segment]));
  const body = byId.body;
  const neck = byId.neck;
  const head = byId.head;

  assert.ok(body.end.x > body.start.x, "body should rise toward the right");
  assert.ok(body.end.y < body.start.y, "body should tilt upward");
  assert.ok(Math.abs(neck.end.x - neck.start.x) < Math.abs(neck.end.y - neck.start.y) * 0.35);
  assert.ok(neck.end.y < neck.start.y, "neck should go upward");
  assert.ok(head.end.x > head.start.x, "head stroke should point right");
  assert.ok(Math.abs(head.end.y - head.start.y) < Math.abs(head.end.x - head.start.x) * 0.3);
});

test("left legs are lighter and render behind the right legs", () => {
  const segments = getGiraffeSegments(createSimulationState(), VIEWPORT);
  const byId = Object.fromEntries(segments.map((segment) => [segment.id, segment]));

  assert.equal(byId["leg-back-left"].ink, "#9a978f");
  assert.equal(byId["leg-front-left"].ink, "#9a978f");
  assert.equal(byId["leg-back-right"].ink, "#171513");
  assert.equal(byId["leg-front-right"].ink, "#171513");
  assert.ok(byId["leg-back-left"].layer < byId["leg-back-right"].layer);
  assert.ok(byId["leg-front-left"].layer < byId["leg-front-right"].layer);
});

test("grounded feet share a level ground line and flatten at contact", () => {
  let state = createSimulationState();

  for (let index = 0; index < 12; index += 1) {
    state = stepSimulation(state, 1 / 10);
    const legs = getGiraffeSegments(state, VIEWPORT).filter((segment) => segment.id.startsWith("leg-"));
    const grounded = legs.filter((segment) => segment.contact);

    assert.ok(grounded.length >= 2, "at least two feet should be supporting the body");

    const hoofYs = grounded.map((segment) => segment.points[1].y);
    assert.ok(
      Math.max(...hoofYs) - Math.min(...hoofYs) < 2,
      "supporting feet should land on the same horizontal ground line",
    );

    for (const leg of grounded) {
      assert.ok(leg.control, `${leg.id} should expose a single curve control point`);
    }
  }
});

test("legs use a single low-curvature bend biased toward the knee", () => {
  let state = createSimulationState();

  for (let index = 0; index < 18; index += 1) {
    state = stepSimulation(state, 1 / 12);
    const legs = getGiraffeSegments(state, VIEWPORT).filter((segment) => segment.id.startsWith("leg-"));

    for (const leg of legs) {
      assert.ok(leg.control, `${leg.id} should expose a single control point`);
      assert.equal(leg.curveStart ?? null, null, `${leg.id} should no longer split into a line-curve-line path`);
      assert.equal(leg.curveEnd ?? null, null, `${leg.id} should no longer split into a line-curve-line path`);

      const kneeProgress = pointProgressOnSegment(leg.control, leg.start, leg.end);
      const curvature = pointToSegmentDistance(leg.control, leg.start, leg.end);
      const length = pointDistance(leg.start, leg.end);

      assert.ok(kneeProgress > 0.35 && kneeProgress < 0.82, `${leg.id} should bend around the knee zone`);
      assert.ok(
        curvature / length < 0.16,
        `${leg.id} should keep a low overall curvature`,
      );
    }
  }
});

test("segment impulses decay over time", () => {
  let state = createSimulationState();
  state = applySegmentImpulse(state, "neck", 1);

  assert.ok(state.impulses.neck > 0.9);

  state = stepSimulation(state, 0.2);
  const mid = state.impulses.neck;
  assert.ok(mid < 0.9 && mid > 0.2, "impulse should start decaying but still be visible");

  state = stepSimulation(state, 0.8);
  assert.ok(state.impulses.neck < mid, "impulse should continue decaying");
  assert.ok(state.impulses.neck < 0.08, "impulse should nearly settle after one second");
});

test("leg impulses increase curvature for that leg", () => {
  const before = Object.fromEntries(
    getGiraffeSegments(createSimulationState(), VIEWPORT).map((segment) => [segment.id, segment]),
  );

  let state = createSimulationState();
  state = applySegmentImpulse(state, "leg-front-right", 1);
  state = stepSimulation(state, 0.08);

  const after = Object.fromEntries(getGiraffeSegments(state, VIEWPORT).map((segment) => [segment.id, segment]));
  assert.ok(Math.abs(after["leg-front-right"].bend) > Math.abs(before["leg-front-right"].bend));
});

test("impulses briefly disturb gait timing", () => {
  const baseline = stepSimulation(createSimulationState(), 0.16);

  let state = createSimulationState();
  state = applySegmentImpulse(state, "body", 1);
  state = stepSimulation(state, 0.16);

  assert.ok(
    Math.abs(state.gaitPhase - baseline.gaitPhase) > 0.01,
    "impulse should nudge the gait phase",
  );
  assert.ok(state.gaitJolt > 0, "impulse should leave a short-lived gait disturbance");
});

test("walk cycle stays slow and measured", () => {
  const state = stepSimulation(createSimulationState(), 0.5);

  assert.ok(state.gaitPhase < 1.3, "gait phase should advance slowly over half a second");
});

test("legs alternate between planted support and lifted recovery instead of flailing", () => {
  let state = createSimulationState();
  const samples = [];

  for (let index = 0; index < 180; index += 1) {
    state = stepSimulation(state, 1 / 30);
    const byId = Object.fromEntries(getGiraffeSegments(state, VIEWPORT).map((segment) => [segment.id, segment]));
    const leg = byId["leg-front-right"];
    samples.push({
      contact: Boolean(leg.contact),
      x: leg.points[1].x,
      y: leg.points[1].y,
      lift: leg.lift ?? 0,
    });
  }

  const stanceRun = longestRun(samples, (sample) => sample.contact);
  const swingRun = longestRun(samples, (sample) => !sample.contact);

  assert.ok(stanceRun.length >= 8, "front leg should spend a visible interval in stance");
  assert.ok(swingRun.length >= 6, "front leg should spend a visible interval in swing");
  assert.ok(
    stanceRun[stanceRun.length - 1].x < stanceRun[0].x - 8,
    "during stance the hoof should drift backward relative to the body",
  );
  assert.ok(
    swingRun[swingRun.length - 1].x > swingRun[0].x + 8,
    "during swing the hoof should recover forward",
  );
  assert.ok(
    Math.max(...swingRun.map((sample) => sample.lift)) > 8,
    "during swing the hoof should visibly lift off the ground",
  );
});

test("leg curvature changes smoothly through ground contact", () => {
  for (const legId of ["leg-back-left", "leg-front-left", "leg-back-right", "leg-front-right"]) {
    let state = createSimulationState();
    const samples = [];

    for (let index = 0; index < 260; index += 1) {
      state = stepSimulation(state, 1 / 120);
      const leg = Object.fromEntries(getGiraffeSegments(state, VIEWPORT).map((segment) => [segment.id, segment]))[legId];
      samples.push({
        contact: Boolean(leg.contact),
        bend: leg.bend,
      });
    }

    for (let index = 1; index < samples.length; index += 1) {
      if (samples[index].contact !== samples[index - 1].contact) {
        assert.ok(
          Math.abs(samples[index].bend - samples[index - 1].bend) < 3.2,
          `${legId} bend should not jump abruptly when the hoof touches or leaves the ground`,
        );
      }
    }
  }
});

test("rear legs bend in the same direction as the front legs", () => {
  let state = createSimulationState();

  for (let index = 0; index < 60; index += 1) {
    state = stepSimulation(state, 1 / 30);
    const byId = Object.fromEntries(getGiraffeSegments(state, VIEWPORT).map((segment) => [segment.id, segment]));

    assert.equal(
      Math.sign(byId["leg-back-left"].bend),
      Math.sign(byId["leg-front-left"].bend),
      "left rear and left front legs should curve the same way",
    );
    assert.equal(
      Math.sign(byId["leg-back-right"].bend),
      Math.sign(byId["leg-front-right"].bend),
      "right rear and right front legs should curve the same way",
    );
  }
});

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.min(
    1,
    Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
  );
  const projection = {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function longestRun(samples, predicate) {
  let best = [];
  let current = [];

  for (const sample of samples) {
    if (predicate(sample)) {
      current.push(sample);
      if (current.length > best.length) {
        best = [...current];
      }
    } else {
      current = [];
    }
  }

  return best;
}

function pointDistance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function pointProgressOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return 0;
  }

  return ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
}
