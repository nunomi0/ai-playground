import {
  MATERIAL_INFO,
  MATERIALS,
  createWorld,
  paintCircle,
  setCell,
  stepWorld,
  summarizeWorld,
} from "/sand/src/simulation.js";

const WORLD_WIDTH = 160;
const WORLD_HEIGHT = 100;
const STEP_MS = 1000 / 30;
const MATERIAL_ORDER = [
  MATERIALS.SAND,
  MATERIALS.WATER,
  MATERIALS.STONE,
  MATERIALS.FIRE,
  MATERIALS.SMOKE,
  MATERIALS.EMPTY,
];

const canvas = document.querySelector("#sim-canvas");
const ctx = canvas.getContext("2d");
const materialsEl = document.querySelector("#materials");
const statsEl = document.querySelector("#stats");
const brushSizeEl = document.querySelector("#brush-size");
const brushSizeValueEl = document.querySelector("#brush-size-value");
const pauseButton = document.querySelector("#pause-button");
const clearButton = document.querySelector("#clear-button");

const buffer = document.createElement("canvas");
buffer.width = WORLD_WIDTH;
buffer.height = WORLD_HEIGHT;
const bufferCtx = buffer.getContext("2d");
const imageData = bufferCtx.createImageData(WORLD_WIDTH, WORLD_HEIGHT);

const state = {
  world: createLabWorld(),
  selectedMaterial: MATERIALS.SAND,
  brushSize: Number(brushSizeEl.value),
  paused: false,
  pointerDown: false,
  accumulator: 0,
  lastTimestamp: performance.now(),
};

function createLabWorld() {
  const world = createWorld(WORLD_WIDTH, WORLD_HEIGHT);

  for (let x = 0; x < WORLD_WIDTH; x += 1) {
    setCell(world, x, WORLD_HEIGHT - 1, MATERIALS.STONE);
  }

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    setCell(world, 0, y, MATERIALS.STONE);
    setCell(world, WORLD_WIDTH - 1, y, MATERIALS.STONE);
  }

  for (let x = 30; x < 130; x += 1) {
    setCell(world, x, 62, MATERIALS.STONE);
  }

  for (let x = 52; x < 108; x += 1) {
    setCell(world, x, 44, MATERIALS.STONE);
  }

  paintCircle(world, 42, 14, 7, MATERIALS.SAND);
  paintCircle(world, 72, 12, 6, MATERIALS.SAND);
  paintCircle(world, 108, 16, 6, MATERIALS.WATER);
  paintCircle(world, 85, 18, 3, MATERIALS.FIRE);
  paintCircle(world, 88, 8, 4, MATERIALS.SMOKE);

  return world;
}

function buildMaterials() {
  materialsEl.innerHTML = "";

  for (const material of MATERIAL_ORDER) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "material-chip";
    button.style.setProperty("--chip", MATERIAL_INFO[material].color);
    button.textContent = MATERIAL_INFO[material].label;
    button.dataset.material = String(material);
    button.addEventListener("click", () => {
      state.selectedMaterial = material;
      renderMaterials();
    });
    materialsEl.append(button);
  }
}

function renderMaterials() {
  for (const button of materialsEl.querySelectorAll(".material-chip")) {
    const active = Number(button.dataset.material) === state.selectedMaterial;
    button.classList.toggle("active", active);
  }
}

function renderStats() {
  const counts = summarizeWorld(state.world);
  const items = [
    ["Sand", counts.sand],
    ["Water", counts.water],
    ["Fire", counts.fire],
    ["Smoke", counts.smoke],
    ["Brush", state.brushSize],
    ["Mode", state.paused ? "Paused" : "Live"],
  ];

  statsEl.innerHTML = "";

  for (const [label, value] of items) {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `
      <span class="stat-label">${label}</span>
      <span class="stat-value">${value}</span>
    `;
    statsEl.append(card);
  }
}

function getPointerCell(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT;

  return {
    x: Math.max(0, Math.min(WORLD_WIDTH - 1, Math.floor(x))),
    y: Math.max(0, Math.min(WORLD_HEIGHT - 1, Math.floor(y))),
  };
}

function paintAtEvent(event) {
  const { x, y } = getPointerCell(event);
  paintCircle(state.world, x, y, state.brushSize, state.selectedMaterial);
  render();
  renderStats();
}

function updateWorld(stepMs) {
  state.accumulator += stepMs;
  while (state.accumulator >= STEP_MS) {
    state.world = stepWorld(state.world);
    state.accumulator -= STEP_MS;
  }
}

function fillPixel(data, offset, color, alpha = 255) {
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = alpha;
}

function getColor(material, tick, x, y) {
  switch (material) {
    case MATERIALS.EMPTY:
      return [10, 15, 29];
    case MATERIALS.STONE:
      return (x + y + tick) % 5 === 0 ? [129, 136, 154] : [108, 117, 138];
    case MATERIALS.SAND:
      return y % 3 === 0 ? [246, 205, 117] : [238, 187, 98];
    case MATERIALS.WATER:
      return x % 2 === 0 ? [74, 164, 255] : [56, 129, 227];
    case MATERIALS.FIRE:
      return x % 2 === 0 ? [255, 132, 72] : [255, 194, 86];
    case MATERIALS.SMOKE:
      return y % 2 === 0 ? [198, 205, 216] : [158, 168, 184];
    default:
      return [255, 0, 255];
  }
}

function render() {
  const { data } = imageData;
  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const material = state.world.cells[y * WORLD_WIDTH + x];
      const color = getColor(material, state.world.tick, x, y);
      fillPixel(data, (y * WORLD_WIDTH + x) * 4, color);
    }
  }

  bufferCtx.putImageData(imageData, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
}

function frame(timestamp) {
  const delta = Math.min(32, timestamp - state.lastTimestamp);
  state.lastTimestamp = timestamp;

  if (!state.paused) {
    updateWorld(delta);
    render();
    renderStats();
  }

  requestAnimationFrame(frame);
}

function resetWorld() {
  state.world = createLabWorld();
  state.accumulator = 0;
  render();
  renderStats();
}

function renderGameToText() {
  return JSON.stringify({
    mode: state.paused ? "paused" : "running",
    selectedMaterial: MATERIAL_INFO[state.selectedMaterial].label,
    brushSize: state.brushSize,
    world: summarizeWorld(state.world),
    coordinateSystem: {
      origin: "top-left",
      x: "right",
      y: "down",
    },
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  if (!state.paused) {
    updateWorld(ms);
  }
  render();
  renderStats();
};

canvas.addEventListener("pointerdown", (event) => {
  state.pointerDown = true;
  paintAtEvent(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.pointerDown) return;
  paintAtEvent(event);
});

window.addEventListener("pointerup", () => {
  state.pointerDown = false;
});

brushSizeEl.addEventListener("input", () => {
  state.brushSize = Number(brushSizeEl.value);
  brushSizeValueEl.textContent = String(state.brushSize);
  renderStats();
});

pauseButton.addEventListener("click", () => {
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
  renderStats();
});

clearButton.addEventListener("click", resetWorld);

buildMaterials();
renderMaterials();
brushSizeValueEl.textContent = String(state.brushSize);
render();
renderStats();
requestAnimationFrame(frame);
