export const GRID_WIDTH = 34;
export const GRID_HEIGHT = 22;

export const TOOLS = Object.freeze({
  anchor: {
    name: "Anchor",
    cost: 4,
    symbol: "A",
    tone: "#7df0bd",
  },
  prism: {
    name: "Prism",
    cost: 3,
    symbol: "P",
    tone: "#86a8ff",
  },
  siphon: {
    name: "Siphon",
    cost: 3,
    symbol: "S",
    tone: "#ffd166",
  },
  bloom: {
    name: "Bloom",
    cost: 5,
    symbol: "B",
    tone: "#ff8f70",
  },
  veil: {
    name: "Veil",
    cost: 4,
    symbol: "V",
    tone: "#c8a6ff",
  },
});

const DIRECTIONS = Object.freeze([
  { dx: 0, dy: -1, flow: 0 },
  { dx: 1, dy: 0, flow: 1 },
  { dx: 0, dy: 1, flow: 2 },
  { dx: -1, dy: 0, flow: 3 },
]);

const CORNERS = Object.freeze([
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: 1, dy: 1 },
  { dx: -1, dy: 1 },
]);

const PASSABLE_KINDS = new Set(["channel", "core", "memory", "fracture", "archive"]);
const MAX_EVENTS = 8;

export function keyOf(x, y) {
  return `${x},${y}`;
}

export function parseKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function indexOf(state, x, y) {
  return y * state.width + x;
}

export function inBounds(state, x, y) {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

export function cellAt(state, x, y) {
  if (!inBounds(state, x, y)) {
    return { kind: "void", flow: 0, variant: 0 };
  }
  return state.cells[indexOf(state, x, y)];
}

export function isPassable(state, x, y) {
  return PASSABLE_KINDS.has(cellAt(state, x, y).kind);
}

export function neighborsOf(state, x, y) {
  return DIRECTIONS.map((direction) => ({
    x: x + direction.dx,
    y: y + direction.dy,
    flow: direction.flow,
  })).filter((cell) => inBounds(state, cell.x, cell.y));
}

export function hashSeed(seed) {
  const text = String(seed || "lattice-oracle");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed) {
  let value = hashSeed(seed);
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function createGame(seed = makeRunSeed()) {
  const generated = generateLattice(seed);
  const length = generated.width * generated.height;
  const signal = Array(length).fill(0);
  const noise = Array(length).fill(0);
  const pressure = Array(length).fill(0);

  signal[indexFrom(generated.width, generated.core.x, generated.core.y)] = 1.15;
  for (const fracture of generated.fractures) {
    const index = indexFrom(generated.width, fracture.x, fracture.y);
    noise[index] = 0.7 + fracture.pulse * 0.16;
  }

  const state = {
    seed: String(seed),
    width: generated.width,
    height: generated.height,
    cells: generated.cells,
    core: generated.core,
    memories: generated.memories,
    fractures: generated.fractures,
    signal,
    noise,
    pressure,
    tick: 0,
    budget: 11,
    maxBudget: 22,
    collapse: 11,
    stableTicks: 0,
    toolCells: {},
    gameOver: false,
    victory: false,
    message: "The lattice is listening.",
    events: ["The lattice is listening."],
    lastAction: null,
  };

  return updateDerived(state);
}

export function applyAction(inputState, action, options = {}) {
  if (!action || typeof action.type !== "string") {
    return withMessage(inputState, "No action.");
  }

  if (action.type === "step") {
    return advance(inputState, Number(action.steps) || 1);
  }

  if (inputState.gameOver || inputState.victory) {
    return withMessage(inputState, "Start another lattice.");
  }

  if (action.type === "place") {
    return placeTool(inputState, action, options);
  }

  if (action.type === "scrub") {
    return scrubCell(inputState, action, options);
  }

  if (action.type === "remove") {
    return removeTool(inputState, action);
  }

  return withMessage(inputState, "Unknown action.");
}

export function advance(inputState, steps = 1) {
  const state = cloneState(inputState);
  const totalSteps = clamp(Math.floor(steps), 1, 240);

  for (let i = 0; i < totalSteps; i += 1) {
    if (state.gameOver || state.victory) {
      break;
    }
    stepState(state);
  }

  return updateDerived(state);
}

export function canPlaceTool(state, toolType, x, y, options = {}) {
  const tool = TOOLS[toolType];
  if (!tool) {
    return { ok: false, message: "Unknown tool." };
  }
  if (!inBounds(state, x, y)) {
    return { ok: false, message: "Outside the lattice." };
  }
  const key = keyOf(x, y);
  const cell = cellAt(state, x, y);
  if (cell.kind !== "channel") {
    return { ok: false, message: "Tools need an open channel." };
  }
  if (state.toolCells[key]) {
    return { ok: false, message: "A tool is already there." };
  }
  if (!options.force && state.budget < tool.cost) {
    return { ok: false, message: "Not enough charge." };
  }
  return { ok: true, message: "Ready." };
}

export function forecastRisk(inputState, horizon = 36) {
  const state = cloneState(inputState);
  const length = state.width * state.height;
  const risk = Array(length).fill(0);
  let collapsePeak = state.collapse;
  let lowMemory = 100;

  for (let step = 0; step < horizon; step += 1) {
    if (!state.gameOver && !state.victory) {
      stepState(state, { forecast: true });
    }
    collapsePeak = Math.max(collapsePeak, state.collapse);
    lowMemory = Math.min(lowMemory, ...state.memories.map((memory) => memory.coherence));

    for (let i = 0; i < length; i += 1) {
      const cell = state.cells[i];
      if (!PASSABLE_KINDS.has(cell.kind)) {
        continue;
      }
      const memoryPenalty = cell.kind === "memory" ? (100 - getMemory(state, cell.memoryId).coherence) / 100 : 0;
      const pressureStress = Math.max(0, -state.pressure[i]) * 0.18;
      const value = clamp01(state.noise[i] * 0.68 + pressureStress + memoryPenalty * 0.55);
      risk[i] = Math.max(risk[i], value);
    }
  }

  return {
    horizon,
    cells: risk,
    collapsePeak,
    finalCollapse: state.collapse,
    lowMemory,
    score: scoreForecast({ collapsePeak, lowMemory, cells: risk }),
  };
}

export function rankInterventions(inputState, toolType = "anchor", limit = 5) {
  if (!TOOLS[toolType]) {
    return [];
  }

  const baseline = forecastRisk(inputState, 24);
  const candidates = candidateCells(inputState, baseline.cells);
  const ranked = [];

  for (const candidate of candidates) {
    if (!canPlaceTool(inputState, toolType, candidate.x, candidate.y, { force: true }).ok) {
      continue;
    }
    const placed = placeTool(inputState, {
      type: "place",
      tool: toolType,
      x: candidate.x,
      y: candidate.y,
    }, { force: true, silent: true });
    const future = forecastRisk(placed, 20);
    const nearbyMemory = nearestMemoryDistance(inputState, candidate.x, candidate.y);
    const score =
      baseline.score -
      future.score +
      baseline.cells[indexOf(inputState, candidate.x, candidate.y)] * 0.55 +
      Math.max(0, 6 - nearbyMemory) * 0.025;

    ranked.push({
      x: candidate.x,
      y: candidate.y,
      tool: toolType,
      score,
      before: baseline.score,
      after: future.score,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

export function findPath(state, start, goal) {
  if (!inBounds(state, start.x, start.y) || !inBounds(state, goal.x, goal.y)) {
    return [];
  }
  if (!isPassable(state, start.x, start.y) || !isPassable(state, goal.x, goal.y)) {
    return [];
  }

  const startKey = keyOf(start.x, start.y);
  const goalKey = keyOf(goal.x, goal.y);
  const queue = [{ x: start.x, y: start.y }];
  const cameFrom = new Map([[startKey, null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (keyOf(current.x, current.y) === goalKey) {
      break;
    }

    for (const neighbor of neighborsOf(state, current.x, current.y)) {
      const neighborKey = keyOf(neighbor.x, neighbor.y);
      if (cameFrom.has(neighborKey) || !isPassable(state, neighbor.x, neighbor.y)) {
        continue;
      }
      cameFrom.set(neighborKey, keyOf(current.x, current.y));
      queue.push({ x: neighbor.x, y: neighbor.y });
    }
  }

  if (!cameFrom.has(goalKey)) {
    return [];
  }

  const path = [];
  let cursor = goalKey;
  while (cursor) {
    const point = parseKey(cursor);
    path.push(point);
    cursor = cameFrom.get(cursor);
  }
  return path.reverse();
}

function generateLattice(seed) {
  const rng = createRng(seed);
  const width = GRID_WIDTH;
  const height = GRID_HEIGHT;
  const cells = Array.from({ length: width * height }, () => makeCell("void"));
  const stateStub = { width, height, cells };
  const core = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const memories = [];
  const memoryTargets = makeMemoryTargets(width, height, core, rng);

  carveDisk(stateStub, core.x, core.y, 2, rng);
  for (let index = 0; index < memoryTargets.length; index += 1) {
    const target = memoryTargets[index];
    carvePath(stateStub, core, target, rng, 1);
    carveDisk(stateStub, target.x, target.y, 1, rng);
    memories.push({
      id: `m${index + 1}`,
      x: target.x,
      y: target.y,
      coherence: 68 + Math.round(rng() * 12),
      stable: 0,
      name: MEMORY_NAMES[index],
    });
  }

  for (let index = 0; index < memoryTargets.length; index += 1) {
    const from = memoryTargets[index];
    const to = memoryTargets[(index + 2) % memoryTargets.length];
    if (rng() > 0.28) {
      carvePath(stateStub, from, to, rng, rng() > 0.62 ? 1 : 0);
    }
  }

  for (let i = 0; i < 30; i += 1) {
    const anchor = rng() > 0.5 ? core : memoryTargets[randomInt(rng, 0, memoryTargets.length - 1)];
    const target = {
      x: clamp(Math.round(anchor.x + randomFloat(rng, -8, 8)), 2, width - 3),
      y: clamp(Math.round(anchor.y + randomFloat(rng, -5, 5)), 2, height - 3),
    };
    carvePath(stateStub, anchor, target, rng, rng() > 0.7 ? 1 : 0);
  }

  thickenLattice(stateStub, rng);
  erodeDeadEnds(stateStub, core, memoryTargets, rng);
  assignFlow(stateStub, rng);

  setCell(stateStub, core.x, core.y, makeCell("core", { flow: 0, variant: 0 }));
  for (const memory of memories) {
    setCell(stateStub, memory.x, memory.y, makeCell("memory", {
      memoryId: memory.id,
      flow: randomInt(rng, 0, 3),
      variant: randomInt(rng, 0, 4),
    }));
  }

  const reserved = new Set([keyOf(core.x, core.y), ...memories.map((memory) => keyOf(memory.x, memory.y))]);
  const archiveCells = pickSpread(
    passableCells(stateStub).filter((cell) => distance(cell, core) > 5),
    7,
    reserved,
    4,
    rng,
  );
  for (const cell of archiveCells) {
    setCell(stateStub, cell.x, cell.y, makeCell("archive", {
      flow: randomInt(rng, 0, 3),
      variant: randomInt(rng, 0, 4),
    }));
  }

  const fractureCells = pickSpread(
    passableCells(stateStub).filter((cell) => {
      if (reserved.has(keyOf(cell.x, cell.y))) {
        return false;
      }
      return distance(cell, core) > 5 && memories.every((memory) => distance(cell, memory) > 3);
    }),
    8,
    reserved,
    4,
    rng,
  );
  const fractures = fractureCells.map((cell, index) => {
    const pulse = randomFloat(rng, 0.2, 0.95);
    setCell(stateStub, cell.x, cell.y, makeCell("fracture", {
      flow: randomInt(rng, 0, 3),
      pulse,
      variant: index % 5,
    }));
    return { id: `f${index + 1}`, x: cell.x, y: cell.y, pulse };
  });

  markEdges(stateStub);

  return {
    width,
    height,
    cells: stateStub.cells,
    core,
    memories,
    fractures,
  };
}

function makeRunSeed() {
  return `oracle-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
}

const MEMORY_NAMES = Object.freeze(["North", "Lyric", "Umber", "Glass", "Tide", "Cinder"]);

function makeMemoryTargets(width, height, core, rng) {
  const radiusX = Math.floor(width * 0.38);
  const radiusY = Math.floor(height * 0.35);
  const angles = [-0.15, 1.04, 2.08, 3.21, 4.17, 5.32];
  return angles.map((angle) => ({
    x: clamp(Math.round(core.x + Math.cos(angle) * radiusX + randomFloat(rng, -2, 2)), 3, width - 4),
    y: clamp(Math.round(core.y + Math.sin(angle) * radiusY + randomFloat(rng, -2, 2)), 3, height - 4),
  }));
}

function makeCell(kind, extra = {}) {
  return {
    kind,
    flow: 0,
    variant: 0,
    edge: 0,
    ...extra,
  };
}

function setCell(state, x, y, cell) {
  if (inBounds(state, x, y)) {
    state.cells[indexOf(state, x, y)] = cell;
  }
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomFloat(rng, min, max) {
  return min + rng() * (max - min);
}

function carveDisk(state, x, y, radius, rng) {
  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (!inBounds(state, xx, yy)) {
        continue;
      }
      if (Math.hypot(xx - x, yy - y) <= radius + 0.3) {
        setCell(state, xx, yy, makeCell("channel", {
          flow: randomInt(rng, 0, 3),
          variant: randomInt(rng, 0, 5),
        }));
      }
    }
  }
}

function carvePath(state, from, to, rng, radius = 0) {
  let x = from.x;
  let y = from.y;
  const limit = state.width * state.height;

  for (let step = 0; step < limit && !(x === to.x && y === to.y); step += 1) {
    carveDisk(state, x, y, radius, rng);
    setCell(state, x, y, makeCell("channel", {
      flow: randomInt(rng, 0, 3),
      variant: randomInt(rng, 0, 5),
    }));

    const dx = Math.sign(to.x - x);
    const dy = Math.sign(to.y - y);
    const horizontal = Math.abs(to.x - x) >= Math.abs(to.y - y);
    const wobble = rng();

    if (wobble < 0.16 && dy !== 0) {
      y += dy;
    } else if (wobble < 0.28 && dx !== 0) {
      x += dx;
    } else if (horizontal && dx !== 0) {
      x += dx;
    } else if (dy !== 0) {
      y += dy;
    } else if (dx !== 0) {
      x += dx;
    }

    if (rng() < 0.18) {
      const side = DIRECTIONS[randomInt(rng, 0, DIRECTIONS.length - 1)];
      const sx = x + side.dx;
      const sy = y + side.dy;
      if (inBounds(state, sx, sy)) {
        setCell(state, sx, sy, makeCell("channel", {
          flow: side.flow,
          variant: randomInt(rng, 0, 5),
        }));
      }
    }
  }

  carveDisk(state, to.x, to.y, radius, rng);
  setCell(state, to.x, to.y, makeCell("channel", {
    flow: randomInt(rng, 0, 3),
    variant: randomInt(rng, 0, 5),
  }));
}

function thickenLattice(state, rng) {
  const next = state.cells.map((cell) => ({ ...cell }));
  for (let y = 1; y < state.height - 1; y += 1) {
    for (let x = 1; x < state.width - 1; x += 1) {
      const index = indexOf(state, x, y);
      if (state.cells[index].kind !== "void") {
        continue;
      }
      const adjacent = DIRECTIONS.filter((direction) => {
        const cell = cellAt(state, x + direction.dx, y + direction.dy);
        return PASSABLE_KINDS.has(cell.kind) || cell.kind === "channel";
      }).length;
      const corner = CORNERS.filter((direction) => {
        const cell = cellAt(state, x + direction.dx, y + direction.dy);
        return PASSABLE_KINDS.has(cell.kind) || cell.kind === "channel";
      }).length;
      if (adjacent >= 2 && rng() < 0.52) {
        next[index] = makeCell("channel", { flow: randomInt(rng, 0, 3), variant: randomInt(rng, 0, 5) });
      } else if (adjacent + corner >= 4 && rng() < 0.18) {
        next[index] = makeCell("channel", { flow: randomInt(rng, 0, 3), variant: randomInt(rng, 0, 5) });
      }
    }
  }
  state.cells = next;
}

function erodeDeadEnds(state, core, memoryTargets, rng) {
  const protectedKeys = new Set([keyOf(core.x, core.y), ...memoryTargets.map((target) => keyOf(target.x, target.y))]);
  for (let pass = 0; pass < 2; pass += 1) {
    const next = state.cells.map((cell) => ({ ...cell }));
    for (let y = 1; y < state.height - 1; y += 1) {
      for (let x = 1; x < state.width - 1; x += 1) {
        const index = indexOf(state, x, y);
        if (state.cells[index].kind !== "channel" || protectedKeys.has(keyOf(x, y))) {
          continue;
        }
        const exits = DIRECTIONS.filter((direction) => isPassable(state, x + direction.dx, y + direction.dy)).length;
        if (exits <= 1 && rng() < 0.55) {
          next[index] = makeCell("void");
        }
      }
    }
    state.cells = next;
  }
}

function assignFlow(state, rng) {
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const cell = cellAt(state, x, y);
      if (!PASSABLE_KINDS.has(cell.kind) && cell.kind !== "channel") {
        continue;
      }
      const directionalBias = Math.sin(x * 0.51) + Math.cos(y * 0.73) + randomFloat(rng, -0.7, 0.7);
      cell.flow = ((Math.round(directionalBias) % 4) + 4) % 4;
      cell.variant = randomInt(rng, 0, 5);
    }
  }
}

function markEdges(state) {
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const cell = cellAt(state, x, y);
      if (!PASSABLE_KINDS.has(cell.kind)) {
        continue;
      }
      let edge = 0;
      for (const direction of DIRECTIONS) {
        if (!isPassable(state, x + direction.dx, y + direction.dy)) {
          edge += 1;
        }
      }
      cell.edge = edge;
    }
  }
}

function passableCells(state) {
  const cells = [];
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (isPassable(state, x, y)) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function pickSpread(candidates, count, reserved, minDistance, rng) {
  const picked = [];
  const ordered = [...candidates].sort((a, b) => {
    const scoreA = a.x * 1.7 + a.y * 1.13 + rng() * 9;
    const scoreB = b.x * 1.7 + b.y * 1.13 + rng() * 9;
    return scoreB - scoreA;
  });

  for (const candidate of ordered) {
    if (picked.length >= count) {
      break;
    }
    if (reserved.has(keyOf(candidate.x, candidate.y))) {
      continue;
    }
    if (!picked.every((cell) => distance(cell, candidate) >= minDistance)) {
      continue;
    }
    picked.push(candidate);
    reserved.add(keyOf(candidate.x, candidate.y));
  }

  for (const candidate of ordered) {
    if (picked.length >= count) {
      break;
    }
    if (!reserved.has(keyOf(candidate.x, candidate.y))) {
      picked.push(candidate);
      reserved.add(keyOf(candidate.x, candidate.y));
    }
  }

  return picked;
}

function placeTool(inputState, action, options) {
  const x = Math.round(Number(action.x));
  const y = Math.round(Number(action.y));
  const toolType = action.tool;
  const validation = canPlaceTool(inputState, toolType, x, y, options);
  if (!validation.ok) {
    return withMessage(inputState, validation.message);
  }

  const state = cloneState(inputState);
  const tool = TOOLS[toolType];
  const key = keyOf(x, y);
  state.toolCells[key] = {
    type: toolType,
    x,
    y,
    born: state.tick,
    charge: toolType === "bloom" ? 5 : toolType === "veil" ? 48 : 0,
  };
  if (!options.force) {
    state.budget = roundStat(state.budget - tool.cost);
  }

  if (toolType === "prism") {
    rotateFlow(state, x, y);
  }
  if (toolType === "anchor") {
    addToRadius(state, state.signal, x, y, 2, 0.18);
    scaleRadius(state, state.noise, x, y, 2, 0.78);
  }
  if (toolType === "bloom") {
    bloomFrom(state, state.toolCells[key]);
  }

  state.lastAction = { type: "place", tool: toolType, x, y };
  if (!options.silent) {
    pushEvent(state, `${tool.name} placed at ${x}:${y}.`);
  }
  return updateDerived(state);
}

function scrubCell(inputState, action, options) {
  const x = Math.round(Number(action.x));
  const y = Math.round(Number(action.y));
  const cost = 2;
  if (!inBounds(inputState, x, y) || !isPassable(inputState, x, y)) {
    return withMessage(inputState, "Nothing to scrub.");
  }
  if (!options.force && inputState.budget < cost) {
    return withMessage(inputState, "Not enough charge.");
  }

  const state = cloneState(inputState);
  scaleRadius(state, state.noise, x, y, 2, 0.42);
  addToRadius(state, state.signal, x, y, 1, 0.08);
  if (!options.force) {
    state.budget = roundStat(state.budget - cost);
  }
  state.lastAction = { type: "scrub", x, y };
  if (!options.silent) {
    pushEvent(state, `Scrubbed ${x}:${y}.`);
  }
  return updateDerived(state);
}

function removeTool(inputState, action) {
  const x = Math.round(Number(action.x));
  const y = Math.round(Number(action.y));
  const key = keyOf(x, y);
  if (!inputState.toolCells[key]) {
    return withMessage(inputState, "No tool there.");
  }

  const state = cloneState(inputState);
  delete state.toolCells[key];
  state.budget = Math.min(state.maxBudget, roundStat(state.budget + 1));
  state.lastAction = { type: "remove", x, y };
  pushEvent(state, `Recovered tool at ${x}:${y}.`);
  return updateDerived(state);
}

function stepState(state, options = {}) {
  const length = state.width * state.height;
  const nextSignal = Array(length).fill(0);
  const nextNoise = Array(length).fill(0);
  const nextPressure = Array(length).fill(0);
  const toolByKey = state.toolCells;
  const veilMap = computeVeilMap(state);

  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const index = indexOf(state, x, y);
      const cell = state.cells[index];
      if (!PASSABLE_KINDS.has(cell.kind)) {
        continue;
      }

      const tool = toolByKey[keyOf(x, y)];
      const sources = fieldSources(state, cell, x, y, tool, veilMap[index]);
      const signalBase = state.signal[index] * 0.55 + sources.signal;
      const noiseBase = state.noise[index] * 0.58 + sources.noise;
      const pressureBase = state.pressure[index] * 0.78 + (state.signal[index] - state.noise[index]) * 0.22;

      nextSignal[index] += signalBase * 0.35;
      nextNoise[index] += noiseBase * 0.43;
      nextPressure[index] += pressureBase * 0.62;

      for (const neighbor of neighborsOf(state, x, y)) {
        if (!isPassable(state, neighbor.x, neighbor.y)) {
          continue;
        }
        const neighborIndex = indexOf(state, neighbor.x, neighbor.y);
        const followsFlow = cell.flow === neighbor.flow ? 1 : 0;
        const hasPrism = tool?.type === "prism" || toolByKey[keyOf(neighbor.x, neighbor.y)]?.type === "prism";
        const edgeLeak = cell.edge > 2 ? 0.02 : 0;
        const signalWeight = 0.115 + followsFlow * 0.075 + (hasPrism ? 0.035 : 0);
        const noiseWeight = 0.094 + (followsFlow ? 0.018 : 0) + edgeLeak;
        nextSignal[neighborIndex] += signalBase * signalWeight;
        nextNoise[neighborIndex] += noiseBase * noiseWeight;
        nextPressure[neighborIndex] += pressureBase * 0.08;
      }
    }
  }

  let siphonGain = 0;
  for (const tool of Object.values(state.toolCells)) {
    if (tool.type === "anchor") {
      addToRadius(state, nextSignal, tool.x, tool.y, 2, 0.1);
      scaleRadius(state, nextNoise, tool.x, tool.y, 2, 0.6);
    } else if (tool.type === "siphon") {
      siphonGain += drainRadius(state, nextNoise, tool.x, tool.y, 2, 0.32);
      scaleRadius(state, nextPressure, tool.x, tool.y, 2, 0.65);
    } else if (tool.type === "prism") {
      addDirectionalSignal(state, nextSignal, tool);
    } else if (tool.type === "bloom") {
      addToRadius(state, nextSignal, tool.x, tool.y, 2, 0.05);
      if (state.tick % 6 === 0 && tool.charge > 0) {
        bloomFrom(state, tool);
        tool.charge -= 1;
      }
    } else if (tool.type === "veil") {
      scaleRadius(state, nextNoise, tool.x, tool.y, 3, 0.58);
      tool.charge -= 1;
    }
  }

  removeExpiredTools(state);

  for (let i = 0; i < length; i += 1) {
    const cell = state.cells[i];
    if (!PASSABLE_KINDS.has(cell.kind)) {
      state.signal[i] = 0;
      state.noise[i] = 0;
      state.pressure[i] = 0;
      continue;
    }
    state.signal[i] = clamp(nextSignal[i], 0, 1.35);
    state.noise[i] = clamp(nextNoise[i], 0, 1.45);
    state.pressure[i] = clamp(nextPressure[i], -1.25, 1.25);
  }

  updateMemories(state, options);
  updateCollapse(state);
  state.budget = roundStat(clamp(
    state.budget + 0.07 + stableMemoryCount(state) * 0.025 + Math.min(0.38, siphonGain * 0.07),
    0,
    state.maxBudget,
  ));
  state.tick += 1;
  checkEndState(state, options);
}

function fieldSources(state, cell, x, y, tool, veilFactor) {
  let signal = 0;
  let noise = 0;

  if (cell.kind === "core") {
    signal += 1.08;
  } else if (cell.kind === "memory") {
    const memory = getMemory(state, cell.memoryId);
    signal += 0.16 + memory.coherence / 260;
  } else if (cell.kind === "archive") {
    signal += 0.16;
  } else if (cell.kind === "fracture") {
    const beat = 0.78 + Math.sin((state.tick + cell.pulse * 7) * 0.42) * 0.12;
    noise += beat * (0.65 + cell.pulse * 0.28) * veilFactor;
  }

  if (tool?.type === "anchor") {
    signal += 0.64;
    noise -= 0.08;
  } else if (tool?.type === "prism") {
    signal += 0.16;
  } else if (tool?.type === "siphon") {
    noise -= 0.12;
  } else if (tool?.type === "bloom") {
    signal += 0.22;
    noise += 0.025;
  } else if (tool?.type === "veil") {
    noise -= 0.16;
  }

  if (nearTool(state, x, y, "anchor", 2)) {
    signal += 0.07;
    noise -= 0.04;
  }

  return {
    signal: Math.max(0, signal),
    noise: Math.max(0, noise),
  };
}

function computeVeilMap(state) {
  const veilMap = Array(state.width * state.height).fill(1);
  for (const tool of Object.values(state.toolCells)) {
    if (tool.type !== "veil") {
      continue;
    }
    forEachRadius(state, tool.x, tool.y, 4, (x, y, distanceToTool) => {
      const index = indexOf(state, x, y);
      veilMap[index] *= 0.42 + Math.min(0.32, distanceToTool * 0.08);
    });
  }
  return veilMap;
}

function updateMemories(state, options) {
  let drops = 0;
  for (const memory of state.memories) {
    const index = indexOf(state, memory.x, memory.y);
    const signal = state.signal[index];
    const noise = state.noise[index];
    const shielded = state.toolCells[keyOf(memory.x, memory.y)] ? 0.12 : 0;
    const archiveSupport = nearbyKind(state, memory.x, memory.y, "archive", 4) * 0.018;
    const delta = signal * 3.15 - noise * 3.55 + shielded + archiveSupport - 0.045;
    const before = memory.coherence;
    memory.coherence = clamp(memory.coherence + delta, 0, 100);
    if (memory.coherence > 84 && signal > noise * 0.86) {
      memory.stable += 1;
    } else {
      memory.stable = Math.max(0, memory.stable - 1);
    }
    if (before >= 55 && memory.coherence < 55) {
      drops += 1;
    }
  }

  if (drops > 0 && !options.forecast) {
    pushEvent(state, `${drops} memory ${drops === 1 ? "fell" : "fell"} below quorum.`);
  }
}

function updateCollapse(state) {
  const passableIndexes = [];
  let noiseSum = 0;
  let pressureDebt = 0;
  let hotCells = 0;

  for (let i = 0; i < state.cells.length; i += 1) {
    if (!PASSABLE_KINDS.has(state.cells[i].kind)) {
      continue;
    }
    passableIndexes.push(i);
    noiseSum += state.noise[i];
    pressureDebt += Math.max(0, -state.pressure[i]);
    if (state.noise[i] > 0.98) {
      hotCells += 1;
    }
  }

  const avgNoise = noiseSum / Math.max(1, passableIndexes.length);
  const avgDebt = pressureDebt / Math.max(1, passableIndexes.length);
  const memoryRisk =
    state.memories.reduce((total, memory) => total + (100 - memory.coherence) / 100, 0) /
    Math.max(1, state.memories.length);
  const stableRelief = stableMemoryCount(state) * 0.018;
  const risk = avgNoise * 0.5 + avgDebt * 0.22 + memoryRisk * 0.46 + hotCells * 0.002 - stableRelief;
  state.collapse = roundStat(clamp(state.collapse + (risk - 0.34) * 2.8, 0, 100));
}

function checkEndState(state, options) {
  if (state.collapse >= 100) {
    state.gameOver = true;
    state.message = "The lattice collapsed.";
    if (!options.forecast) {
      pushEvent(state, state.message);
    }
    return;
  }

  const allStable = state.memories.every((memory) => memory.coherence >= 92 && memory.stable >= 12);
  if (allStable && state.collapse < 72) {
    state.stableTicks += 1;
  } else {
    state.stableTicks = Math.max(0, state.stableTicks - 1);
  }

  if (state.stableTicks >= 18) {
    state.victory = true;
    state.message = "The oracle resolved the lattice.";
    if (!options.forecast) {
      pushEvent(state, state.message);
    }
  }
}

function updateDerived(state) {
  const coherent = Math.round(
    state.memories.reduce((total, memory) => total + memory.coherence, 0) / state.memories.length,
  );
  if (!state.gameOver && !state.victory) {
    state.message = `Coherence ${coherent}% / collapse ${Math.round(state.collapse)}%`;
  }
  return state;
}

function rotateFlow(state, x, y) {
  forEachRadius(state, x, y, 2, (xx, yy, distanceToTool) => {
    const cell = cellAt(state, xx, yy);
    if (PASSABLE_KINDS.has(cell.kind)) {
      cell.flow = (cell.flow + (distanceToTool <= 1 ? 1 : 3)) % 4;
    }
  });
}

function bloomFrom(state, tool) {
  const candidates = [];
  forEachRadius(state, tool.x, tool.y, 2, (x, y) => {
    if (cellAt(state, x, y).kind !== "void") {
      return;
    }
    const adjacent = neighborsOf(state, x, y).filter((neighbor) => isPassable(state, neighbor.x, neighbor.y)).length;
    if (adjacent > 0) {
      candidates.push({ x, y, adjacent });
    }
  });
  candidates.sort((a, b) => b.adjacent - a.adjacent || a.y - b.y || a.x - b.x);
  const target = candidates[0];
  if (!target) {
    return false;
  }
  setCell(state, target.x, target.y, makeCell("channel", {
    flow: (target.x + target.y + state.tick) % 4,
    variant: (target.x * 3 + target.y * 5) % 6,
  }));
  state.signal[indexOf(state, target.x, target.y)] = Math.max(state.signal[indexOf(state, target.x, target.y)], 0.24);
  return true;
}

function addDirectionalSignal(state, field, tool) {
  const center = cellAt(state, tool.x, tool.y);
  const direction = DIRECTIONS[center.flow] ?? DIRECTIONS[0];
  for (let step = 1; step <= 4; step += 1) {
    const x = tool.x + direction.dx * step;
    const y = tool.y + direction.dy * step;
    if (!isPassable(state, x, y)) {
      break;
    }
    field[indexOf(state, x, y)] += 0.08 / step;
  }
}

function removeExpiredTools(state) {
  for (const [key, tool] of Object.entries(state.toolCells)) {
    if (tool.type === "veil" && tool.charge <= 0) {
      delete state.toolCells[key];
      pushEvent(state, `Veil faded at ${tool.x}:${tool.y}.`);
    }
  }
}

function addToRadius(state, field, x, y, radius, amount) {
  forEachRadius(state, x, y, radius, (xx, yy, distanceToCenter) => {
    if (isPassable(state, xx, yy)) {
      field[indexOf(state, xx, yy)] += amount * (1 - distanceToCenter / (radius + 1));
    }
  });
}

function scaleRadius(state, field, x, y, radius, scale) {
  forEachRadius(state, x, y, radius, (xx, yy, distanceToCenter) => {
    if (isPassable(state, xx, yy)) {
      const localScale = scale + (1 - scale) * (distanceToCenter / (radius + 1));
      field[indexOf(state, xx, yy)] *= localScale;
    }
  });
}

function drainRadius(state, field, x, y, radius, strength) {
  let drained = 0;
  forEachRadius(state, x, y, radius, (xx, yy, distanceToCenter) => {
    if (!isPassable(state, xx, yy)) {
      return;
    }
    const index = indexOf(state, xx, yy);
    const factor = strength * (1 - distanceToCenter / (radius + 1));
    const amount = field[index] * factor;
    field[index] -= amount;
    drained += amount;
  });
  return drained;
}

function forEachRadius(state, x, y, radius, visitor) {
  for (let yy = y - radius; yy <= y + radius; yy += 1) {
    for (let xx = x - radius; xx <= x + radius; xx += 1) {
      if (!inBounds(state, xx, yy)) {
        continue;
      }
      const distanceToCenter = Math.hypot(xx - x, yy - y);
      if (distanceToCenter <= radius + 0.001) {
        visitor(xx, yy, distanceToCenter);
      }
    }
  }
}

function nearTool(state, x, y, type, radius) {
  return Object.values(state.toolCells).some((tool) => tool.type === type && distance(tool, { x, y }) <= radius);
}

function nearbyKind(state, x, y, kind, radius) {
  let count = 0;
  forEachRadius(state, x, y, radius, (xx, yy) => {
    if (cellAt(state, xx, yy).kind === kind) {
      count += 1;
    }
  });
  return count;
}

function getMemory(state, id) {
  return state.memories.find((memory) => memory.id === id) ?? state.memories[0];
}

function stableMemoryCount(state) {
  return state.memories.filter((memory) => memory.coherence >= 84).length;
}

function candidateCells(state, riskCells) {
  const candidates = [];
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      if (cellAt(state, x, y).kind !== "channel" || state.toolCells[keyOf(x, y)]) {
        continue;
      }
      const index = indexOf(state, x, y);
      const nearSpecial =
        nearestMemoryDistance(state, x, y) <= 5 ||
        state.fractures.some((fracture) => distance(fracture, { x, y }) <= 5);
      if (riskCells[index] > 0.22 || nearSpecial) {
        candidates.push({ x, y });
      }
    }
  }
  return candidates.length > 0 ? candidates : passableCells(state);
}

function nearestMemoryDistance(state, x, y) {
  return Math.min(...state.memories.map((memory) => distance(memory, { x, y })));
}

function scoreForecast(forecast) {
  const cellRisk = forecast.cells.reduce((sum, value) => sum + value, 0) / Math.max(1, forecast.cells.length);
  return forecast.collapsePeak * 0.68 + (100 - forecast.lowMemory) * 0.45 + cellRisk * 35;
}

function withMessage(inputState, message) {
  const state = cloneState(inputState);
  state.message = message;
  pushEvent(state, message);
  return state;
}

function pushEvent(state, event) {
  state.events = [event, ...(state.events || [])].slice(0, MAX_EVENTS);
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function indexFrom(width, x, y) {
  return y * width + x;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function roundStat(value) {
  return Math.round(value * 100) / 100;
}
