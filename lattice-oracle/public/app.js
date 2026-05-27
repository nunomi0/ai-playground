import {
  TOOLS,
  applyAction,
  cellAt,
  createGame,
  forecastRisk,
  indexOf,
  isPassable,
  keyOf,
  rankInterventions,
} from "./engine.js";

const canvas = document.querySelector("#lattice");
const ctx = canvas.getContext("2d", { alpha: false });
const toolButtons = [...document.querySelectorAll("[data-tool]")];
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const runButton = document.querySelector("#runToggle");
const stepButton = document.querySelector("#stepOnce");
const oracleButton = document.querySelector("#oracleToggle");
const newButton = document.querySelector("#newSeed");
const guideButton = document.querySelector("#guideToggle");
const guideOverlay = document.querySelector("#guideOverlay");
const guideCloseButton = document.querySelector("#guideClose");
const guideRememberInput = document.querySelector("#guideRemember");
const tickEl = document.querySelector("#tick");
const budgetEl = document.querySelector("#budget");
const collapseEl = document.querySelector("#collapse");
const messageEl = document.querySelector("#message");
const memoriesEl = document.querySelector("#memories");
const eventsEl = document.querySelector("#events");
const hoverEl = document.querySelector("#hoverReadout");
const recommendationsEl = document.querySelector("#recommendations");
const GUIDE_SEEN_KEY = "lattice-oracle-guide-seen";
const shouldShowGuide = localStorage.getItem(GUIDE_SEEN_KEY) !== "true";

let state = createGame(loadSeed());
let selectedTool = "anchor";
let mode = "tool";
let running = !shouldShowGuide;
let showOracle = true;
let forecast = forecastRisk(state, 28);
let recommendations = rankInterventions(state, selectedTool, 4);
let hoverCell = null;
let lastFrame = performance.now();
let stepAccumulator = 0;
let oracleDirty = false;
let layout = makeLayout();

resizeCanvas();
syncUi();
if (shouldShowGuide) {
  openGuide();
}
requestAnimationFrame(frame);

window.addEventListener("resize", () => {
  resizeCanvas();
  draw();
});

canvas.addEventListener("pointermove", (event) => {
  hoverCell = pointerToCell(event);
  syncHover();
  draw();
});

canvas.addEventListener("pointerleave", () => {
  hoverCell = null;
  syncHover();
  draw();
});

canvas.addEventListener("click", (event) => {
  const cell = pointerToCell(event);
  if (!cell) {
    return;
  }
  if (mode === "scrub") {
    commit(applyAction(state, { type: "scrub", x: cell.x, y: cell.y }));
  } else if (mode === "remove") {
    commit(applyAction(state, { type: "remove", x: cell.x, y: cell.y }));
  } else {
    commit(applyAction(state, { type: "place", tool: selectedTool, x: cell.x, y: cell.y }));
  }
});

for (const button of toolButtons) {
  button.addEventListener("click", () => {
    selectedTool = button.dataset.tool;
    mode = "tool";
    oracleDirty = true;
    syncUi();
    draw();
  });
}

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    syncUi();
    draw();
  });
}

runButton.addEventListener("click", () => {
  running = !running;
  syncUi();
});

stepButton.addEventListener("click", () => {
  commit(applyAction(state, { type: "step" }));
});

oracleButton.addEventListener("click", () => {
  showOracle = !showOracle;
  if (showOracle) {
    refreshOracle();
  }
  syncUi();
  draw();
});

newButton.addEventListener("click", () => {
  const seed = `oracle-${Date.now().toString(36)}`;
  localStorage.setItem("lattice-oracle-seed", seed);
  state = createGame(seed);
  running = true;
  showOracle = true;
  refreshOracle();
  syncUi();
  draw();
});

guideButton.addEventListener("click", () => {
  openGuide();
});

guideCloseButton.addEventListener("click", () => {
  closeGuide();
});

guideOverlay.addEventListener("click", (event) => {
  if (event.target === guideOverlay) {
    closeGuide();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !guideOverlay.hidden) {
    closeGuide();
  }
});

recommendationsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-x]");
  if (!button) {
    return;
  }
  const x = Number(button.dataset.x);
  const y = Number(button.dataset.y);
  selectedTool = button.dataset.tool;
  mode = "tool";
  commit(applyAction(state, { type: "place", tool: selectedTool, x, y }));
});

function frame(now) {
  const delta = Math.min(120, now - lastFrame);
  lastFrame = now;

  if (running && !state.gameOver && !state.victory) {
    stepAccumulator += delta;
    while (stepAccumulator >= 330) {
      state = applyAction(state, { type: "step" });
      stepAccumulator -= 330;
      if (state.tick % 8 === 0) {
        oracleDirty = true;
      }
    }
    syncUi();
  }

  if (oracleDirty && showOracle && !state.gameOver && !state.victory) {
    refreshOracle();
  }

  draw(now);
  requestAnimationFrame(frame);
}

function commit(nextState) {
  const changed =
    nextState.tick !== state.tick ||
    nextState.message !== state.message ||
    Object.keys(nextState.toolCells).length !== Object.keys(state.toolCells).length ||
    nextState.budget !== state.budget;
  state = nextState;
  if (changed) {
    oracleDirty = true;
  }
  syncUi();
  draw();
}

function refreshOracle() {
  forecast = forecastRisk(state, 28);
  recommendations = rankInterventions(state, selectedTool, 4);
  oracleDirty = false;
}

function openGuide() {
  guideOverlay.hidden = false;
  document.body.classList.add("has-guide");
  guideCloseButton.focus();
}

function closeGuide() {
  guideOverlay.hidden = true;
  document.body.classList.remove("has-guide");
  if (guideRememberInput.checked) {
    localStorage.setItem(GUIDE_SEEN_KEY, "true");
  }
  running = true;
  syncUi();
}

function syncUi() {
  tickEl.textContent = String(state.tick);
  budgetEl.textContent = state.budget.toFixed(1);
  collapseEl.textContent = `${Math.round(state.collapse)}%`;
  messageEl.textContent = state.message;
  document.body.classList.toggle("is-ended", state.gameOver || state.victory);
  runButton.textContent = running ? "||" : ">";
  runButton.title = running ? "Pause" : "Run";
  oracleButton.classList.toggle("is-active", showOracle);

  for (const button of toolButtons) {
    const tool = TOOLS[button.dataset.tool];
    button.classList.toggle("is-active", mode === "tool" && selectedTool === button.dataset.tool);
    button.disabled = state.budget < tool.cost || state.gameOver || state.victory;
  }
  for (const button of modeButtons) {
    button.classList.toggle("is-active", mode === button.dataset.mode);
  }

  memoriesEl.replaceChildren(...state.memories.map(renderMemory));
  eventsEl.replaceChildren(...state.events.map(renderEvent));
  recommendationsEl.replaceChildren(...recommendations.map(renderRecommendation));
  syncHover();
}

function syncHover() {
  if (!hoverCell) {
    hoverEl.textContent = "No cell";
    return;
  }
  const index = indexOf(state, hoverCell.x, hoverCell.y);
  const cell = cellAt(state, hoverCell.x, hoverCell.y);
  const tool = state.toolCells[keyOf(hoverCell.x, hoverCell.y)];
  const parts = [
    `${hoverCell.x}:${hoverCell.y}`,
    cell.kind,
    `S ${state.signal[index].toFixed(2)}`,
    `N ${state.noise[index].toFixed(2)}`,
  ];
  if (tool) {
    parts.push(TOOLS[tool.type].name);
  }
  hoverEl.textContent = parts.join(" / ");
}

function renderMemory(memory) {
  const item = document.createElement("li");
  item.className = "memory-row";
  const label = document.createElement("span");
  label.textContent = memory.name;
  const meter = document.createElement("span");
  meter.className = "memory-meter";
  const fill = document.createElement("span");
  fill.style.width = `${Math.round(memory.coherence)}%`;
  fill.style.background = memory.coherence > 84 ? "#7df0bd" : memory.coherence > 56 ? "#ffd166" : "#ff6f61";
  meter.append(fill);
  const value = document.createElement("strong");
  value.textContent = `${Math.round(memory.coherence)}`;
  item.append(label, meter, value);
  return item;
}

function renderEvent(event) {
  const item = document.createElement("li");
  item.textContent = event;
  return item;
}

function renderRecommendation(recommendation, index) {
  const item = document.createElement("button");
  item.className = "recommendation";
  item.type = "button";
  item.dataset.x = recommendation.x;
  item.dataset.y = recommendation.y;
  item.dataset.tool = recommendation.tool;
  item.title = `${TOOLS[recommendation.tool].name} at ${recommendation.x}:${recommendation.y}`;
  item.innerHTML = `
    <span>${index + 1}</span>
    <strong>${TOOLS[recommendation.tool].symbol}</strong>
    <em>${recommendation.x}:${recommendation.y}</em>
    <b>${recommendation.score.toFixed(1)}</b>
  `;
  return item;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  layout = makeLayout();
}

function makeLayout() {
  const rect = canvas.getBoundingClientRect();
  const margin = rect.width < 720 ? 12 : 20;
  const cell = Math.floor(Math.min(
    (rect.width - margin * 2) / state.width,
    (rect.height - margin * 2) / state.height,
  ));
  const width = cell * state.width;
  const height = cell * state.height;
  return {
    cell,
    x: Math.floor((rect.width - width) / 2),
    y: Math.floor((rect.height - height) / 2),
    width,
    height,
  };
}

function pointerToCell(event) {
  const rect = canvas.getBoundingClientRect();
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;
  const x = Math.floor((px - layout.x) / layout.cell);
  const y = Math.floor((py - layout.y) / layout.cell);
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) {
    return null;
  }
  return { x, y };
}

function draw(now = performance.now()) {
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);
  const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
  gradient.addColorStop(0, "#101418");
  gradient.addColorStop(0.45, "#172222");
  gradient.addColorStop(1, "#241b21");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, rect.width, rect.height);

  drawGrid(now);
  drawLinks();
  drawForecast();
  drawTools(now);
  drawHighlights(now);
}

function drawGrid(now) {
  const cellSize = layout.cell;
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const index = indexOf(state, x, y);
      const cell = state.cells[index];
      const px = layout.x + x * cellSize;
      const py = layout.y + y * cellSize;
      const pad = Math.max(1, cellSize * 0.08);

      if (!isPassable(state, x, y)) {
        ctx.fillStyle = "rgba(7, 9, 12, 0.82)";
        ctx.fillRect(px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2);
        continue;
      }

      ctx.fillStyle = cellColor(index, cell, now);
      roundedRect(px + pad, py + pad, cellSize - pad * 2, cellSize - pad * 2, Math.max(2, cellSize * 0.18));
      ctx.fill();

      if (cell.edge > 0) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + cell.edge * 0.025})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (cell.kind === "core") {
        drawCore(px, py, cellSize, now);
      } else if (cell.kind === "memory") {
        drawMemoryGlyph(px, py, cellSize, cell.memoryId);
      } else if (cell.kind === "fracture") {
        drawFracture(px, py, cellSize, now, cell.pulse);
      } else if (cell.kind === "archive") {
        drawArchive(px, py, cellSize);
      } else if (cellSize > 15 && state.signal[index] > 0.24) {
        drawFlow(px, py, cellSize, cell.flow, state.signal[index]);
      }
    }
  }
}

function cellColor(index, cell, now) {
  const signal = state.signal[index];
  const noise = state.noise[index];
  const pressure = state.pressure[index];
  const flicker = Math.sin(now * 0.002 + index * 0.37) * 4;
  let base = [30 + flicker, 39 + flicker, 42 + flicker];

  if (cell.kind === "core") {
    base = [48, 88, 79];
  } else if (cell.kind === "memory") {
    base = [76, 62, 42];
  } else if (cell.kind === "fracture") {
    base = [80, 34, 45];
  } else if (cell.kind === "archive") {
    base = [38, 54, 82];
  }

  const mixed = mixColor(base, [72, 220, 175], clamp01(signal * 0.52));
  const noisy = mixColor(mixed, [255, 88, 91], clamp01(noise * 0.58));
  const pressured = pressure > 0
    ? mixColor(noisy, [255, 209, 102], clamp01(pressure * 0.18))
    : mixColor(noisy, [122, 155, 255], clamp01(-pressure * 0.18));
  return `rgb(${pressured.map((value) => Math.round(clamp(value, 0, 255))).join(",")})`;
}

function drawLinks() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = Math.max(1, layout.cell * 0.08);
  for (const memory of state.memories) {
    const strength = memory.coherence / 100;
    ctx.strokeStyle = `rgba(125, 240, 189, ${0.08 + strength * 0.12})`;
    lineBetween(state.core, memory);
  }
  ctx.restore();
}

function drawForecast() {
  if (!showOracle || !forecast) {
    return;
  }
  const cellSize = layout.cell;
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const index = indexOf(state, x, y);
      const risk = forecast.cells[index];
      if (risk < 0.22 || !isPassable(state, x, y)) {
        continue;
      }
      const px = layout.x + x * cellSize;
      const py = layout.y + y * cellSize;
      ctx.fillStyle = `rgba(255, ${Math.round(168 - risk * 80)}, 88, ${risk * 0.42})`;
      ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
    }
  }
}

function drawTools(now) {
  const cellSize = layout.cell;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.max(10, Math.floor(cellSize * 0.52))}px Arial, sans-serif`;
  for (const tool of Object.values(state.toolCells)) {
    const px = layout.x + tool.x * cellSize + cellSize / 2;
    const py = layout.y + tool.y * cellSize + cellSize / 2;
    const spec = TOOLS[tool.type];
    const pulse = 1 + Math.sin(now * 0.006 + tool.x) * 0.06;
    ctx.fillStyle = spec.tone;
    ctx.beginPath();
    ctx.arc(px, py, cellSize * 0.34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(7, 9, 12, 0.66)";
    ctx.lineWidth = Math.max(1, cellSize * 0.08);
    ctx.stroke();
    ctx.fillStyle = "#08100e";
    ctx.fillText(spec.symbol, px, py + 0.5);
  }
  ctx.restore();
}

function drawHighlights(now) {
  const cellSize = layout.cell;
  if (hoverCell) {
    strokeCell(hoverCell.x, hoverCell.y, "#f7f3df", 2);
  }

  recommendations.forEach((recommendation, index) => {
    const alpha = 0.42 + Math.sin(now * 0.004 + index) * 0.16;
    strokeCell(recommendation.x, recommendation.y, `rgba(255, 209, 102, ${alpha})`, Math.max(1, cellSize * 0.08));
  });
}

function drawCore(px, py, size, now) {
  const cx = px + size / 2;
  const cy = py + size / 2;
  const radius = size * (0.2 + Math.sin(now * 0.005) * 0.025);
  ctx.fillStyle = "#d8fff0";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawMemoryGlyph(px, py, size, id) {
  const memory = state.memories.find((item) => item.id === id);
  const coherence = (memory?.coherence ?? 0) / 100;
  ctx.strokeStyle = coherence > 0.84 ? "#7df0bd" : coherence > 0.56 ? "#ffd166" : "#ff6f61";
  ctx.lineWidth = Math.max(1.5, size * 0.1);
  ctx.beginPath();
  ctx.arc(px + size / 2, py + size / 2, size * 0.26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * coherence);
  ctx.stroke();
}

function drawFracture(px, py, size, now, pulse) {
  const cx = px + size / 2;
  const cy = py + size / 2;
  const wobble = Math.sin(now * 0.006 + pulse * 5) * size * 0.08;
  ctx.strokeStyle = "#ffd0c8";
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.22, cy - size * 0.24 + wobble);
  ctx.lineTo(cx + size * 0.02, cy - size * 0.05 - wobble);
  ctx.lineTo(cx - size * 0.05, cy + size * 0.03 + wobble);
  ctx.lineTo(cx + size * 0.24, cy + size * 0.25 - wobble);
  ctx.stroke();
}

function drawArchive(px, py, size) {
  ctx.strokeStyle = "#cfe0ff";
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.strokeRect(px + size * 0.3, py + size * 0.28, size * 0.4, size * 0.44);
  ctx.beginPath();
  ctx.moveTo(px + size * 0.36, py + size * 0.4);
  ctx.lineTo(px + size * 0.64, py + size * 0.4);
  ctx.moveTo(px + size * 0.36, py + size * 0.56);
  ctx.lineTo(px + size * 0.6, py + size * 0.56);
  ctx.stroke();
}

function drawFlow(px, py, size, flow, signal) {
  const direction = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ][flow];
  const cx = px + size / 2;
  const cy = py + size / 2;
  ctx.strokeStyle = `rgba(216, 255, 240, ${Math.min(0.35, signal * 0.22)})`;
  ctx.lineWidth = Math.max(1, size * 0.045);
  ctx.beginPath();
  ctx.moveTo(cx - direction.x * size * 0.12, cy - direction.y * size * 0.12);
  ctx.lineTo(cx + direction.x * size * 0.18, cy + direction.y * size * 0.18);
  ctx.stroke();
}

function lineBetween(a, b) {
  const ax = layout.x + a.x * layout.cell + layout.cell / 2;
  const ay = layout.y + a.y * layout.cell + layout.cell / 2;
  const bx = layout.x + b.x * layout.cell + layout.cell / 2;
  const by = layout.y + b.y * layout.cell + layout.cell / 2;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

function strokeCell(x, y, color, width) {
  const pad = Math.max(1, layout.cell * 0.08);
  const px = layout.x + x * layout.cell;
  const py = layout.y + y * layout.cell;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  roundedRect(px + pad, py + pad, layout.cell - pad * 2, layout.cell - pad * 2, Math.max(2, layout.cell * 0.18));
  ctx.stroke();
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function mixColor(a, b, amount) {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function loadSeed() {
  const stored = localStorage.getItem("lattice-oracle-seed");
  if (stored) {
    return stored;
  }
  const seed = "oracle-first-light";
  localStorage.setItem("lattice-oracle-seed", seed);
  return seed;
}
