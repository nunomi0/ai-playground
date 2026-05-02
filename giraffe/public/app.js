import {
  applySegmentImpulse,
  createSimulationState,
  hitTestGiraffe,
  renderStateToText,
  setPointerTarget,
  stepSimulation,
  getGiraffeSegments,
} from "/giraffe/src/simulation.js";

const canvas = document.querySelector("#scene");
const context = canvas.getContext("2d");

let viewport = { width: window.innerWidth, height: window.innerHeight };
let pointer = {
  x: viewport.width * 0.72,
  y: viewport.height * 0.38,
};
let state = setPointerTarget(createSimulationState(), pointer, viewport);
let lastFrameTime = 0;

function resizeCanvas() {
  viewport = { width: window.innerWidth, height: window.innerHeight };
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
  canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  state = setPointerTarget(state, pointer, viewport);
  render();
}

function updatePointer(clientX, clientY) {
  pointer = { x: clientX, y: clientY };
  state = setPointerTarget(state, pointer, viewport);
  canvas.style.cursor = hitTestGiraffe(state, viewport, pointer, 20) ? "pointer" : "default";
}

function pointerPositionFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, viewport.height);
  gradient.addColorStop(0, "#efefef");
  gradient.addColorStop(1, "#e6e6e6");
  context.fillStyle = gradient;
  context.fillRect(0, 0, viewport.width, viewport.height);

  const glowA = context.createRadialGradient(
    viewport.width * 0.18,
    viewport.height * 0.2,
    0,
    viewport.width * 0.18,
    viewport.height * 0.2,
    viewport.width * 0.22,
  );
  glowA.addColorStop(0, "rgba(255,255,255,0.46)");
  glowA.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glowA;
  context.fillRect(0, 0, viewport.width, viewport.height);

  const glowB = context.createRadialGradient(
    viewport.width * 0.84,
    viewport.height * 0.12,
    0,
    viewport.width * 0.84,
    viewport.height * 0.12,
    viewport.width * 0.18,
  );
  glowB.addColorStop(0, "rgba(255,255,255,0.14)");
  glowB.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glowB;
  context.fillRect(0, 0, viewport.width, viewport.height);
}

function drawGiraffe(segments) {
  drawGroundGuide(segments);

  const baseWidth = Math.max(5.6, Math.min(viewport.width, viewport.height) * 0.0088);
  const passes = [
    { width: baseWidth, alpha: 0.96, offset: 0 },
    { width: baseWidth * 0.78, alpha: 0.62, offset: 1.4 },
  ];
  const orderedSegments = [...segments].sort((left, right) => left.layer - right.layer);

  for (const [index, segment] of orderedSegments.entries()) {
    for (const pass of passes) {
      const stroke = buildStrokeGeometry(segment, index, pass.offset);
      context.beginPath();
      traceStrokePath(stroke);
      context.strokeStyle = withAlpha(segment.ink, pass.alpha);
      context.lineWidth = pass.width;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();
    }
  }
}

function drawGroundGuide(segments) {
  const legs = segments.filter((segment) => segment.id.startsWith("leg-"));
  if (legs.length === 0) {
    return;
  }

  const groundedLegs = legs.filter((segment) => segment.contact);
  const hoofs = (groundedLegs.length > 0 ? groundedLegs : legs).map((segment) => segment.points[1]);
  const minX = Math.min(...hoofs.map((point) => point.x));
  const maxX = Math.max(...hoofs.map((point) => point.x));
  const avgY = hoofs.reduce((sum, point) => sum + point.y, 0) / hoofs.length;

  context.beginPath();
  context.moveTo(minX - 12, avgY + 4);
  context.lineTo(maxX + 12, avgY + 4);
  context.strokeStyle = "rgba(180, 180, 180, 0.48)";
  context.lineWidth = Math.max(7, Math.min(viewport.width, viewport.height) * 0.012);
  context.lineCap = "round";
  context.stroke();
}

function buildStrokeGeometry(segment, strokeIndex, passOffset) {
  const start = segment.points[0];
  const end = segment.points[segment.points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const seed = (strokeIndex + 1) * 1.31 + passOffset;
  const wobble =
    Math.sin(state.elapsed * 0.22 + seed) * 0.95 +
    Math.cos(state.elapsed * 0.13 + seed * 1.4) * 0.35;
  const baseControl = segment.control ?? {
    x: (start.x + end.x) / 2 + normalX * (segment.bend ?? 0),
    y: (start.y + end.y) / 2 + normalY * (segment.bend ?? 0),
  };

  const control = segment.control
    ? {
        x: baseControl.x + (segment.contact ? wobble * 0.35 : normalX * wobble * 0.55),
        y: segment.contact ? baseControl.y : baseControl.y + normalY * wobble * 0.55,
      }
    : {
        x: baseControl.x + normalX * wobble,
        y: baseControl.y + normalY * wobble,
      };

  return {
    start,
    end,
    control,
  };
}

function traceStrokePath(stroke) {
  context.moveTo(stroke.start.x, stroke.start.y);
  context.quadraticCurveTo(stroke.control.x, stroke.control.y, stroke.end.x, stroke.end.y);
}

function withAlpha(color, alpha) {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const normalized = hex.length === 3 ? hex.split("").map((part) => `${part}${part}`).join("") : hex;
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  return color;
}

function render() {
  drawBackground();
  const segments = getGiraffeSegments(state, viewport);
  drawGiraffe(segments);
}

function tick(now) {
  if (!lastFrameTime) {
    lastFrameTime = now;
  }
  const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  state = stepSimulation(state, dt);
  render();
  requestAnimationFrame(tick);
}

function advanceByMilliseconds(ms) {
  const frameSeconds = 1 / 60;
  let remaining = Math.max(0, ms) / 1000;
  while (remaining > 0) {
    const step = Math.min(frameSeconds, remaining);
    state = stepSimulation(state, step);
    remaining -= step;
  }
  render();
}

canvas.addEventListener("pointermove", (event) => {
  const point = pointerPositionFromEvent(event);
  updatePointer(point.x, point.y);
});

canvas.addEventListener("pointerdown", (event) => {
  const point = pointerPositionFromEvent(event);
  updatePointer(point.x, point.y);
  const hit = hitTestGiraffe(state, viewport, point, 22);
  if (hit) {
    state = applySegmentImpulse(state, hit, 1);
    render();
  }
});

window.addEventListener("resize", resizeCanvas);

window.render_game_to_text = () => renderStateToText(state, viewport);
window.advanceTime = (ms) => {
  advanceByMilliseconds(ms);
};

resizeCanvas();
render();
requestAnimationFrame(tick);
