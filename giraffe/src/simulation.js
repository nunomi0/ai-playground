const BASE_GAIT_SPEED = 1.12;
const IMPULSE_DECAY_PER_SECOND = 4.6;
const TAU = Math.PI * 2;
const STANCE_RATIO = 0.64;

export const SEGMENT_IDS = [
  "leg-back-left",
  "leg-front-left",
  "leg-back-right",
  "leg-front-right",
  "body",
  "neck",
  "head",
];

export const INTERACTIVE_SEGMENT_IDS = SEGMENT_IDS.filter((id) => id !== "head");

const LEG_DEFINITIONS = [
  {
    id: "leg-back-left",
    anchorT: 0.16,
    phaseOffset: Math.PI,
    ink: "#9a978f",
    layer: 0,
    forwardReach: 0.42,
    backReach: 0.58,
    liftScale: 0.9,
    curveBias: -1,
  },
  {
    id: "leg-front-left",
    anchorT: 0.78,
    phaseOffset: Math.PI + TAU * 0.1,
    ink: "#9a978f",
    layer: 0,
    forwardReach: 0.58,
    backReach: 0.42,
    liftScale: 1.02,
    curveBias: -1,
  },
  {
    id: "leg-back-right",
    anchorT: 0.08,
    phaseOffset: 0,
    ink: "#171513",
    layer: 2,
    forwardReach: 0.42,
    backReach: 0.58,
    liftScale: 0.92,
    curveBias: -1,
  },
  {
    id: "leg-front-right",
    anchorT: 0.88,
    phaseOffset: TAU * 0.1,
    ink: "#171513",
    layer: 2,
    forwardReach: 0.58,
    backReach: 0.42,
    liftScale: 1.05,
    curveBias: -1,
  },
];

export function createSimulationState() {
  return {
    elapsed: 0,
    gaitPhase: 0,
    gaitJolt: 0,
    targetLookAngle: 0,
    bodyAngle: 0,
    neckAngle: 0,
    headAngle: 0,
    impulses: createImpulseMap(),
  };
}

export function setPointerTarget(state, point, viewport) {
  return {
    ...state,
    targetLookAngle: 0,
  };
}

export function applySegmentImpulse(state, segmentId, magnitude = 1) {
  if (!INTERACTIVE_SEGMENT_IDS.includes(segmentId)) {
    return state;
  }

  const strength = clamp(magnitude, 0, 1.6);
  return {
    ...state,
    gaitJolt: Math.max(state.gaitJolt, 0.24 * strength),
    impulses: {
      ...state.impulses,
      [segmentId]: Math.max(state.impulses[segmentId], strength),
    },
  };
}

export function stepSimulation(state, dt) {
  const delta = Math.max(0, dt);
  const gaitJolt = decayTowardZero(state.gaitJolt, 2.6, delta);
  const gaitPhase = state.gaitPhase + delta * (BASE_GAIT_SPEED + gaitJolt * 0.45);

  return {
    ...state,
    elapsed: state.elapsed + delta,
    gaitPhase,
    gaitJolt,
    targetLookAngle: 0,
    bodyAngle: 0,
    neckAngle: 0,
    headAngle: 0,
    impulses: stepImpulses(state.impulses, delta),
  };
}

export function getGiraffeSegments(state, viewport) {
  const stage = getStageMetrics(viewport);
  const center = getStageCenter(viewport);
  const bodyBob = Math.sin(state.gaitPhase * 1.4 + 0.2) * stage.bodyBob;
  const bodySway = Math.sin(state.gaitPhase * 0.7 - 0.35) * stage.bodySway + state.impulses.body * stage.bodyImpulseSway;
  const bodyLean = Math.sin(state.gaitPhase * 0.42 + 0.4) * 0.012 + state.impulses.body * 0.012;

  const hip = {
    x: center.x - stage.bodyLength * 0.5 + bodySway,
    y: stage.groundY - stage.bodyHeight + bodyBob,
  };
  const shoulder = pointLocal(hip, bodyLean, stage.bodyLength, -stage.bodyRise);

  const legs = LEG_DEFINITIONS.map((definition) => {
    const anchor = lerpPoint(hip, shoulder, definition.anchorT);
    const impulse = state.impulses[definition.id];
    return createLegStroke(definition, anchor, state.gaitPhase, stage, impulse);
  });

  const neckBase = shoulder;
  const neckTip = pointLocal(
    neckBase,
    0,
    stage.neckLean + state.impulses.neck * stage.neckImpulseX,
    -stage.neckLength,
  );
  const headTip = {
    x: neckTip.x + stage.headLength,
    y: neckTip.y + state.impulses.neck * stage.headImpulseY,
  };

  return [
    ...legs,
    makeStroke("body", [hip, shoulder], {
      ink: "#171513",
      layer: 1,
      bend: state.impulses.body * stage.bodyBend,
    }),
    makeStroke("neck", [neckBase, neckTip], {
      ink: "#171513",
      layer: 1,
      bend: state.impulses.neck * stage.neckBend,
    }),
    makeStroke("head", [neckTip, headTip], { ink: "#171513", layer: 1, bend: 0 }),
  ];
}

export function hitTestGiraffe(state, viewport, point, radius = 18) {
  const segments = getGiraffeSegments(state, viewport);
  let closest = null;

  for (const segment of segments) {
    if (!INTERACTIVE_SEGMENT_IDS.includes(segment.id)) {
      continue;
    }
    const distance = pointToStrokeDistance(point, segment);
    if (distance <= radius && (!closest || distance < closest.distance)) {
      closest = { id: segment.id, distance };
    }
  }

  return closest?.id ?? null;
}

export function renderStateToText(state, viewport) {
  const segments = getGiraffeSegments(state, viewport).map((segment) => ({
    id: segment.id,
    ink: segment.ink,
    layer: segment.layer,
    bend: Number((segment.bend ?? 0).toFixed(2)),
    contact: Boolean(segment.contact),
    lift: Number((segment.lift ?? 0).toFixed(2)),
    control: segment.control ? roundPoint(segment.control) : null,
    points: segment.points.map(roundPoint),
  }));

  return JSON.stringify({
    coordinateSystem: "origin at top-left, x increases right, y increases down",
    gaitPhase: Number(state.gaitPhase.toFixed(3)),
    gaitJolt: Number(state.gaitJolt.toFixed(3)),
    targetLookAngle: Number(state.targetLookAngle.toFixed(3)),
    bodyAngle: Number(state.bodyAngle.toFixed(3)),
    neckAngle: Number(state.neckAngle.toFixed(3)),
    headAngle: Number(state.headAngle.toFixed(3)),
    segments,
  });
}

function createLegStroke(definition, anchor, gaitPhase, stage, impulse) {
  const cycle = wrap01((gaitPhase + definition.phaseOffset) / TAU);
  const inStance = cycle < STANCE_RATIO;
  const phase = inStance
    ? easeInOutSine(cycle / STANCE_RATIO)
    : easeInOutSine((cycle - STANCE_RATIO) / (1 - STANCE_RATIO));
  const forwardReach = stage.stepLength * definition.forwardReach;
  const backReach = stage.stepLength * definition.backReach;

  let footOffsetX;
  let footY = stage.groundY;
  let lift = 0;

  if (inStance) {
    footOffsetX = lerp(forwardReach, -backReach, phase);
  } else {
    footOffsetX = lerp(-backReach, forwardReach, phase);
    lift = Math.sin(phase * Math.PI) * stage.stepLift * definition.liftScale;
    footY -= lift;
  }

  const hoof = {
    x: anchor.x + footOffsetX,
    y: footY,
  };

  const swingBlend = getSwingCurveBlend(lift, stage.stepLift * definition.liftScale);
  const contactControl = createContactLegControl(anchor, hoof, definition, stage);
  const swingControl = createSwingLegControl(anchor, hoof, definition, stage, lift, impulse);
  const baseControl = lerpPoint(contactControl, swingControl, swingBlend);
  const baseBend = getControlPointBend(anchor, hoof, baseControl);
  const impulseDirection = Math.sign(baseBend || definition.curveBias || 1);
  const impulseAmount = lerp(stage.contactImpulseBend, stage.swingImpulseBend, swingBlend);
  const control = offsetControlAlongNormal(baseControl, anchor, hoof, impulseDirection * impulse * impulseAmount);

  return makeStroke(definition.id, [anchor, hoof], {
    ink: definition.ink,
    layer: definition.layer,
    control,
    bend: getControlPointBend(anchor, hoof, control),
    contact: inStance,
    lift,
    mode: inStance ? "stance" : "swing",
  });
}

function getSwingCurveBlend(lift, maxLift) {
  if (maxLift <= 0) {
    return 0;
  }

  const normalizedLift = clamp(lift / maxLift, 0, 1);
  return easeInOutSine(normalizedLift);
}

function createContactLegControl(anchor, hoof, definition, stage) {
  const kneePoint = lerpPoint(anchor, hoof, stage.stanceKneeT);
  const curved = offsetControlAlongNormal(kneePoint, anchor, hoof, definition.curveBias * stage.contactCurveBend);

  return {
    x: curved.x,
    y: lerp(curved.y, hoof.y, stage.contactFlattenMix),
  };
}

function createSwingLegControl(anchor, hoof, definition, stage, lift, impulse) {
  const kneePoint = lerpPoint(anchor, hoof, stage.swingKneeT);
  const curved = offsetControlAlongNormal(kneePoint, anchor, hoof, definition.curveBias * stage.swingCurveBend);

  return {
    x: curved.x,
    y: curved.y - stage.swingArc - lift * 0.52 - impulse * stage.swingImpulseLift,
  };
}

function makeStroke(id, points, style = {}) {
  return {
    id,
    ink: style.ink ?? "#171513",
    layer: style.layer ?? 1,
    bend: style.bend ?? 0,
    control: style.control ?? null,
    contact: style.contact ?? false,
    lift: style.lift ?? 0,
    mode: style.mode ?? null,
    points,
    start: points[0],
    end: points[points.length - 1],
  };
}

function createImpulseMap() {
  return Object.fromEntries(INTERACTIVE_SEGMENT_IDS.map((id) => [id, 0]));
}

function stepImpulses(impulses, dt) {
  return Object.fromEntries(
    Object.entries(impulses).map(([key, value]) => [
      key,
      decayTowardZero(value, IMPULSE_DECAY_PER_SECOND, dt),
    ]),
  );
}

function getStageCenter(viewport) {
  return {
    x: viewport.width / 2,
    y: viewport.height * 0.58,
  };
}

function getStageMetrics(viewport) {
  const unit = Math.min(viewport.width, viewport.height);
  return {
    unit,
    groundY: viewport.height * 0.835,
    bodyHeight: unit * 0.24,
    bodyLength: unit * 0.17,
    bodyRise: unit * 0.032,
    bodyBob: unit * 0.0052,
    bodySway: unit * 0.008,
    neckLength: unit * 0.238,
    neckLean: unit * 0.012,
    headLength: unit * 0.044,
    stepLength: unit * 0.058,
    stepLift: unit * 0.032,
    stanceKneeT: 0.6,
    swingKneeT: 0.58,
    contactFlattenMix: 0.36,
    contactCurveBend: unit * 0.012,
    swingCurveBend: unit * 0.018,
    swingArc: unit * 0.032,
    bodyBend: unit * 0.016,
    neckBend: unit * 0.026,
    neckImpulseX: unit * 0.007,
    headImpulseY: unit * 0.0035,
    bodyImpulseSway: unit * 0.005,
    contactImpulseBend: unit * 0.01,
    swingImpulseBend: unit * 0.014,
    swingImpulseLift: unit * 0.008,
  };
}

function pointLocal(origin, angle, along, down) {
  const forwardX = Math.cos(angle);
  const forwardY = -Math.sin(angle);
  const downX = Math.sin(angle);
  const downY = Math.cos(angle);

  return {
    x: origin.x + forwardX * along + downX * down,
    y: origin.y + forwardY * along + downY * down,
  };
}

function lerpPoint(start, end, t) {
  return {
    x: lerp(start.x, end.x, t),
    y: lerp(start.y, end.y, t),
  };
}

function pointToStrokeDistance(point, segment) {
  if (segment.control) {
    const curvePoints = approximateQuadratic(segment.points[0], segment.control, segment.points[1], 12);
    return pointToPolylineDistance(point, curvePoints);
  }
  if (segment.points.length === 2 && segment.bend) {
    const control = getCurveControlPoint(segment.points[0], segment.points[1], segment.bend);
    const curvePoints = approximateQuadratic(segment.points[0], control, segment.points[1], 12);
    return pointToPolylineDistance(point, curvePoints);
  }
  return pointToPolylineDistance(point, segment.points);
}

function pointToPolylineDistance(point, points) {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    best = Math.min(best, pointToSegmentDistance(point, points[index], points[index + 1]));
  }
  return best;
}

function approximateQuadratic(start, control, end, steps) {
  const result = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const mt = 1 - t;
    result.push({
      x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
      y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
    });
  }
  return result;
}

function getCurveControlPoint(start, end, bend) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;

  return {
    x: (start.x + end.x) / 2 + normalX * bend,
    y: (start.y + end.y) / 2 + normalY * bend,
  };
}

function getControlPointBend(start, end, control) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  return (control.x - midX) * normalX + (control.y - midY) * normalY;
}

function offsetControlAlongNormal(control, start, end, amount) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;

  return {
    x: control.x + normalX * amount,
    y: control.y + normalY * amount,
  };
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy),
    0,
    1,
  );
  const projection = {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function decayTowardZero(value, rate, dt) {
  return value * Math.exp(-rate * dt);
}

function easeInOutSine(value) {
  return 0.5 - Math.cos(Math.PI * clamp(value, 0, 1)) * 0.5;
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundPoint(point) {
  return {
    x: Number(point.x.toFixed(1)),
    y: Number(point.y.toFixed(1)),
  };
}
