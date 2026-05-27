export const GAME_WIDTH = 15;
export const GAME_HEIGHT = 11;

const MAX_HISTORY = 18;
const VISION_RADIUS = 6;

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const ENEMY_BLUEPRINTS = {
  hunter: {
    name: "Hunter",
    maxHp: 4,
    damage: 1,
    range: 1,
    vision: 8,
    avoidPower: true,
  },
  sentinel: {
    name: "Sentinel",
    maxHp: 3,
    damage: 2,
    range: 4,
    vision: 9,
    avoidPower: false,
    immobile: true,
  },
  wraith: {
    name: "Wraith",
    maxHp: 2,
    damage: 1,
    range: 1,
    vision: 7,
    avoidPower: false,
    riftWalker: true,
  },
};

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

export function hashSeed(seed) {
  const text = String(seed || "singularity");
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

export function getPlayer(state) {
  return state.entities.find((entity) => entity.kind === "player");
}

export function getEnemies(state) {
  return state.entities.filter((entity) => entity.team === "enemy" && entity.hp > 0);
}

export function terrainAt(state, x, y) {
  if (!inBounds(state, x, y)) {
    return { kind: "wall" };
  }
  return state.terrain[indexOf(state, x, y)];
}

export function inBounds(state, x, y) {
  return x >= 0 && y >= 0 && x < state.width && y < state.height;
}

export function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isPassable(state, x, y, options = {}) {
  const tile = terrainAt(state, x, y);
  if (tile.kind === "wall") {
    return false;
  }
  if (tile.kind === "sealed" && !options.riftWalker) {
    return false;
  }
  return true;
}

export function stormActive(tile, turn) {
  if (tile.kind !== "rift") {
    return false;
  }
  if (typeof tile.stableUntil === "number" && turn <= tile.stableUntil) {
    return false;
  }
  return (turn + tile.phase) % 4 === 0;
}

export function entityAt(state, x, y, options = {}) {
  return state.entities.find((entity) => {
    if (entity.hp <= 0) {
      return false;
    }
    if (entity.id === options.ignoreId) {
      return false;
    }
    return entity.x === x && entity.y === y;
  });
}

export function createGame(seed = makeRunSeed()) {
  const generated = generateWorld(seed);
  const player = {
    id: "player",
    kind: "player",
    team: "player",
    x: generated.start.x,
    y: generated.start.y,
    hp: 12,
    maxHp: 12,
    energy: 5,
    maxEnergy: 8,
    flux: 3,
    fragments: 0,
  };

  const state = {
    seed: String(seed),
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    terrain: generated.terrain,
    items: generated.items,
    totalFragments: generated.totalFragments,
    capturedRelays: [keyOf(generated.start.x, generated.start.y)],
    entities: [player, ...generated.enemies],
    turn: 0,
    gameOver: false,
    victory: false,
    history: [],
    visible: Array(GAME_WIDTH * GAME_HEIGHT).fill(false),
    explored: Array(GAME_WIDTH * GAME_HEIGHT).fill(false),
    powered: Array(GAME_WIDTH * GAME_HEIGHT).fill(false),
    intents: [],
    effects: [],
    log: ["The core is online."],
    message: "The core is online.",
  };

  updateDerived(state);
  return state;
}

export function performAction(inputState, action) {
  if (!action || typeof action.type !== "string") {
    return withInvalid(inputState, "No command.");
  }

  if (action.type === "rewind") {
    return rewind(inputState);
  }

  if (inputState.gameOver || inputState.victory) {
    return withInvalid(inputState, "Start a new run.");
  }

  const state = cloneState(inputState);
  state.effects = [];
  const player = getPlayer(state);
  const result = applyPlayerAction(state, player, action);

  if (!result.ok) {
    return withInvalid(inputState, result.message);
  }

  state.history = [...inputState.history, makeSnapshot(inputState)].slice(-MAX_HISTORY);
  cleanupDead(state);
  resolvePlayerTile(state);
  checkEndState(state);

  if (!state.victory && !state.gameOver) {
    state.powered = computePowered(state);
    advanceEnemies(state);
    cleanupDead(state);
    state.turn += 1;
    state.powered = computePowered(state);
    applyHazards(state);
    rechargePlayer(state);
    checkEndState(state);
  }

  updateDerived(state);
  return state;
}

export function getLegalMoves(state) {
  const player = getPlayer(state);
  return DIRECTIONS.map((direction) => ({
    ...direction,
    valid: isMoveLegal(state, player, direction.x, direction.y),
  }));
}

export function findPath(state, start, goal, options = {}) {
  if (!inBounds(state, goal.x, goal.y)) {
    return [];
  }

  const startKey = keyOf(start.x, start.y);
  const goalKey = keyOf(goal.x, goal.y);
  const frontier = [{ x: start.x, y: start.y, priority: 0 }];
  const cameFrom = new Map([[startKey, null]]);
  const costSoFar = new Map([[startKey, 0]]);

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.priority - b.priority);
    const current = frontier.shift();
    const currentKey = keyOf(current.x, current.y);

    if (currentKey === goalKey) {
      break;
    }

    for (const direction of DIRECTIONS) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const nextKey = keyOf(next.x, next.y);
      const isGoal = nextKey === goalKey;
      if (!isPassable(state, next.x, next.y, options)) {
        continue;
      }
      const occupant = entityAt(state, next.x, next.y, { ignoreId: options.ignoreId });
      if (occupant && !(isGoal && options.goalCanBeOccupied)) {
        continue;
      }
      const tile = terrainAt(state, next.x, next.y);
      const poweredPenalty =
        options.avoidPower && state.powered?.[indexOf(state, next.x, next.y)] ? 2 : 0;
      const stormPenalty = stormActive(tile, state.turn + 1) ? 4 : 0;
      const newCost = costSoFar.get(currentKey) + 1 + poweredPenalty + stormPenalty;
      if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
        costSoFar.set(nextKey, newCost);
        cameFrom.set(nextKey, currentKey);
        frontier.push({
          x: next.x,
          y: next.y,
          priority: newCost + manhattan(next, goal),
        });
      }
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

export function lineOfSight(state, x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepY = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    if (!(x === x0 && y === y0) && !(x === x1 && y === y1)) {
      if (terrainAt(state, x, y).kind === "wall") {
        return false;
      }
    }
    if (x === x1 && y === y1) {
      return true;
    }
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      error += dx;
      y += stepY;
    }
  }
}

function makeRunSeed() {
  return `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function makeTile(kind, extra = {}) {
  return { kind, variant: 0, ...extra };
}

function generateWorld(seed) {
  const rng = createRng(seed);
  const width = GAME_WIDTH;
  const height = GAME_HEIGHT;
  const stateStub = { width, height };
  const terrain = Array.from({ length: width * height }, () => makeTile("wall"));

  const roomSpecs = [
    { x: 1, y: 1, w: 4, h: 3 },
    { x: 6, y: 1, w: 3, h: 3 },
    { x: 10, y: 1, w: 4, h: 3 },
    { x: 2, y: 5, w: 4, h: 4 },
    { x: 7, y: 5, w: 3, h: 4 },
    { x: 11, y: 6, w: 3, h: 3 },
    { x: 5, y: 8, w: 5, h: 2 },
  ].map((room, index) => ({
    ...room,
    x: clamp(room.x + (index % 2 === 0 ? randomInt(rng, 0, 1) : 0), 1, width - room.w - 1),
    y: clamp(room.y + (index % 3 === 0 ? randomInt(rng, 0, 1) : 0), 1, height - room.h - 1),
  }));

  for (const room of roomSpecs) {
    carveRect(stateStub, terrain, room.x, room.y, room.w, room.h, rng);
  }

  for (let i = 1; i < roomSpecs.length; i += 1) {
    const previous = roomCenter(roomSpecs[i - 1]);
    const next = roomCenter(roomSpecs[i]);
    if (rng() > 0.5) {
      carveLine(stateStub, terrain, previous.x, previous.y, next.x, previous.y, rng);
      carveLine(stateStub, terrain, next.x, previous.y, next.x, next.y, rng);
    } else {
      carveLine(stateStub, terrain, previous.x, previous.y, previous.x, next.y, rng);
      carveLine(stateStub, terrain, previous.x, next.y, next.x, next.y, rng);
    }
  }

  addRubble(stateStub, terrain, rng);
  reinforceRoomLinks(stateStub, terrain, roomSpecs, rng);

  const start = roomCenter(roomSpecs[0]);
  const distances = terrainDistances(stateStub, terrain, start);
  const floors = terrain
    .map((tile, index) => ({ tile, x: index % width, y: Math.floor(index / width) }))
    .filter(({ tile, x, y }) => tile.kind === "floor" && distances[indexFrom(width, x, y)] >= 0);
  const exit =
    floors
    .filter((cell) => manhattan(cell, start) >= 12)
      .sort((a, b) => distances[indexFrom(width, b.x, b.y)] - distances[indexFrom(width, a.x, a.y)])[0] ??
    floors.sort((a, b) => distances[indexFrom(width, b.x, b.y)] - distances[indexFrom(width, a.x, a.y)])[0];

  const reserved = new Set([keyOf(start.x, start.y), keyOf(exit.x, exit.y)]);
  const fragmentCells = pickSpread(
    floors.filter((cell) => distances[indexFrom(width, cell.x, cell.y)] > 6),
    4,
    reserved,
    4,
    rng,
  );
  const relayCells = pickSpread(
    floors.filter((cell) => distances[indexFrom(width, cell.x, cell.y)] > 3),
    4,
    reserved,
    3,
    rng,
  );

  for (const cell of relayCells) {
    terrain[indexFrom(width, cell.x, cell.y)] = makeTile("relay", {
      variant: randomInt(rng, 0, 3),
    });
    reserved.add(keyOf(cell.x, cell.y));
  }

  terrain[indexFrom(width, start.x, start.y)] = makeTile("core", { variant: 0 });
  terrain[indexFrom(width, exit.x, exit.y)] = makeTile("exit", { variant: 0 });

  const items = {};
  for (const cell of fragmentCells) {
    items[keyOf(cell.x, cell.y)] = { type: "fragment" };
    reserved.add(keyOf(cell.x, cell.y));
  }

  const riftCells = pickSpread(
    floors.filter((cell) => !reserved.has(keyOf(cell.x, cell.y)) && manhattan(cell, start) > 4),
    9,
    reserved,
    2,
    rng,
  );
  for (const cell of riftCells) {
    terrain[indexFrom(width, cell.x, cell.y)] = makeTile("rift", {
      phase: randomInt(rng, 0, 3),
      variant: randomInt(rng, 0, 2),
    });
    reserved.add(keyOf(cell.x, cell.y));
  }

  const enemyCells = pickSpread(
    floors.filter((cell) => !reserved.has(keyOf(cell.x, cell.y)) && manhattan(cell, start) > 5),
    8,
    reserved,
    2,
    rng,
  );
  const enemyKinds = ["hunter", "hunter", "sentinel", "wraith", "hunter", "sentinel", "wraith", "hunter"];
  const enemies = enemyCells.map((cell, index) => {
    const kind = enemyKinds[index % enemyKinds.length];
    const blueprint = ENEMY_BLUEPRINTS[kind];
    return {
      id: `${kind}-${index + 1}`,
      kind,
      team: "enemy",
      x: cell.x,
      y: cell.y,
      hp: blueprint.maxHp,
      maxHp: blueprint.maxHp,
      stun: 0,
      memory: null,
    };
  });

  return {
    terrain,
    items,
    enemies,
    start,
    totalFragments: fragmentCells.length,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function indexFrom(width, x, y) {
  return y * width + x;
}

function carveRect(state, terrain, x, y, width, height, rng) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      terrain[indexOf(state, xx, yy)] = makeTile("floor", {
        variant: randomInt(rng, 0, 4),
      });
    }
  }
}

function carveLine(state, terrain, x0, y0, x1, y1, rng) {
  let x = x0;
  let y = y0;
  while (x !== x1 || y !== y1) {
    terrain[indexOf(state, x, y)] = makeTile("floor", { variant: randomInt(rng, 0, 4) });
    if (x !== x1) {
      x += x < x1 ? 1 : -1;
    } else if (y !== y1) {
      y += y < y1 ? 1 : -1;
    }
  }
  terrain[indexOf(state, x1, y1)] = makeTile("floor", { variant: randomInt(rng, 0, 4) });
}

function addRubble(state, terrain, rng) {
  for (let y = 2; y < state.height - 2; y += 1) {
    for (let x = 2; x < state.width - 2; x += 1) {
      const index = indexOf(state, x, y);
      if (terrain[index].kind !== "floor" || rng() > 0.1) {
        continue;
      }
      const openNeighbors = DIRECTIONS.filter((direction) => {
        const tile = terrain[indexOf(state, x + direction.x, y + direction.y)];
        return tile.kind === "floor";
      }).length;
      if (openNeighbors >= 3) {
        terrain[index] = makeTile("wall", { variant: 1 });
      }
    }
  }
}

function reinforceRoomLinks(state, terrain, rooms, rng) {
  for (const room of rooms) {
    const center = roomCenter(room);
    terrain[indexOf(state, center.x, center.y)] = makeTile("floor", { variant: randomInt(rng, 0, 4) });
  }

  for (let i = 1; i < rooms.length; i += 1) {
    const previous = roomCenter(rooms[i - 1]);
    const next = roomCenter(rooms[i]);
    carveLine(state, terrain, previous.x, previous.y, next.x, previous.y, rng);
    carveLine(state, terrain, next.x, previous.y, next.x, next.y, rng);
  }
}

function roomCenter(room) {
  return {
    x: Math.floor(room.x + room.w / 2),
    y: Math.floor(room.y + room.h / 2),
  };
}

function terrainDistances(state, terrain, start) {
  const distances = Array(state.width * state.height).fill(-1);
  const queue = [{ ...start }];
  distances[indexOf(state, start.x, start.y)] = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    for (const direction of DIRECTIONS) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      if (!inBounds(state, next.x, next.y)) {
        continue;
      }
      const index = indexOf(state, next.x, next.y);
      if (distances[index] !== -1 || terrain[index].kind === "wall") {
        continue;
      }
      distances[index] = distances[indexOf(state, current.x, current.y)] + 1;
      queue.push(next);
    }
  }

  return distances;
}

function pickSpread(candidates, count, reserved, minDistance, rng) {
  const picked = [];
  const weighted = [...candidates].sort((a, b) => {
    const scoreA = a.x + a.y * 2 + rng();
    const scoreB = b.x + b.y * 2 + rng();
    return scoreB - scoreA;
  });

  for (const candidate of weighted) {
    if (picked.length >= count) {
      break;
    }
    if (reserved.has(keyOf(candidate.x, candidate.y))) {
      continue;
    }
    const farEnough = picked.every((cell) => manhattan(cell, candidate) >= minDistance);
    if (!farEnough) {
      continue;
    }
    picked.push({ x: candidate.x, y: candidate.y });
    reserved.add(keyOf(candidate.x, candidate.y));
  }

  if (picked.length < count) {
    for (const candidate of weighted) {
      if (picked.length >= count) {
        break;
      }
      if (!reserved.has(keyOf(candidate.x, candidate.y))) {
        picked.push({ x: candidate.x, y: candidate.y });
        reserved.add(keyOf(candidate.x, candidate.y));
      }
    }
  }

  return picked;
}

function applyPlayerAction(state, player, action) {
  if (action.type === "move") {
    return movePlayer(state, player, normalizeDirection(action));
  }
  if (action.type === "wait") {
    pushLog(state, "Held position.");
    return { ok: true };
  }
  if (action.type === "blink") {
    return blinkPlayer(state, player, normalizeDirection(action));
  }
  if (action.type === "pulse") {
    return pulse(state, player);
  }
  if (action.type === "sync") {
    return syncRelay(state, player);
  }
  return { ok: false, message: "Unknown command." };
}

function normalizeDirection(action) {
  const dx = Math.sign(Number(action.dx || 0));
  const dy = Math.sign(Number(action.dy || 0));
  if (Math.abs(dx) + Math.abs(dy) !== 1) {
    return { dx: 0, dy: 0 };
  }
  return { dx, dy };
}

function movePlayer(state, player, direction) {
  if (Math.abs(direction.dx) + Math.abs(direction.dy) !== 1) {
    return { ok: false, message: "Choose a direction." };
  }

  const target = { x: player.x + direction.dx, y: player.y + direction.dy };
  if (!isPassable(state, target.x, target.y)) {
    return { ok: false, message: "Blocked." };
  }

  const occupant = entityAt(state, target.x, target.y);
  if (occupant?.team === "enemy") {
    damageEnemy(state, occupant, 2, "Struck an intruder.");
    player.energy = Math.min(player.maxEnergy, player.energy + 1);
    return { ok: true };
  }

  if (occupant) {
    return { ok: false, message: "Occupied." };
  }

  player.x = target.x;
  player.y = target.y;
  pushLog(state, "Advanced.");
  return { ok: true };
}

function blinkPlayer(state, player, direction) {
  if (Math.abs(direction.dx) + Math.abs(direction.dy) !== 1) {
    return { ok: false, message: "Choose a blink lane." };
  }
  if (player.energy < 2) {
    return { ok: false, message: "Not enough energy." };
  }

  let destination = { x: player.x, y: player.y };
  for (let distance = 1; distance <= 3; distance += 1) {
    const next = {
      x: player.x + direction.dx * distance,
      y: player.y + direction.dy * distance,
    };
    if (!isPassable(state, next.x, next.y)) {
      break;
    }
    if (entityAt(state, next.x, next.y)) {
      break;
    }
    destination = next;
  }

  if (destination.x === player.x && destination.y === player.y) {
    return { ok: false, message: "No blink path." };
  }

  player.x = destination.x;
  player.y = destination.y;
  player.energy -= 2;
  state.effects.push({ type: "blink", x: player.x, y: player.y });
  pushLog(state, "Blinked through the lattice.");
  return { ok: true };
}

function pulse(state, player) {
  if (player.energy < 3) {
    return { ok: false, message: "Not enough energy." };
  }

  player.energy -= 3;
  let hits = 0;
  for (const enemy of getEnemies(state)) {
    const distance = manhattan(player, enemy);
    if (distance <= 2) {
      hits += 1;
      enemy.stun = Math.max(enemy.stun, 1);
      damageEnemy(state, enemy, distance === 1 ? 3 : 2, "Pulse hit.");
      pushEnemyAway(state, player, enemy);
    }
  }

  let stabilized = 0;
  let captured = 0;
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const tile = terrainAt(state, x, y);
      if (manhattan(player, { x, y }) > 2) {
        continue;
      }
      if (tile.kind === "rift") {
        tile.stableUntil = state.turn + 4;
        stabilized += 1;
      }
      if (tile.kind === "relay" && !state.capturedRelays.includes(keyOf(x, y))) {
        state.capturedRelays.push(keyOf(x, y));
        captured += 1;
      }
    }
  }

  const parts = [];
  if (hits > 0) {
    parts.push(`${hits} intruder${hits > 1 ? "s" : ""} staggered`);
  }
  if (captured > 0) {
    parts.push(`${captured} relay${captured > 1 ? "s" : ""} synced`);
  }
  if (stabilized > 0) {
    parts.push(`${stabilized} rift${stabilized > 1 ? "s" : ""} stabilized`);
  }
  pushLog(state, parts.length > 0 ? parts.join(", ") + "." : "Pulse discharged.");
  state.effects.push({ type: "pulse", x: player.x, y: player.y, radius: 2 });
  return { ok: true };
}

function syncRelay(state, player) {
  const relay = nearestRelayInReach(state, player);
  if (!relay) {
    return { ok: false, message: "No relay in reach." };
  }
  state.capturedRelays.push(keyOf(relay.x, relay.y));
  player.energy = player.maxEnergy;
  pushLog(state, "Relay synced.");
  state.effects.push({ type: "sync", x: relay.x, y: relay.y });
  return { ok: true };
}

function nearestRelayInReach(state, player) {
  let nearest = null;
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const tile = terrainAt(state, x, y);
      if (tile.kind !== "relay" || state.capturedRelays.includes(keyOf(x, y))) {
        continue;
      }
      const distance = manhattan(player, { x, y });
      if (distance <= 1 && (!nearest || distance < nearest.distance)) {
        nearest = { x, y, distance };
      }
    }
  }
  return nearest;
}

function pushEnemyAway(state, origin, enemy) {
  if (enemy.hp <= 0) {
    return;
  }
  const dx = Math.sign(enemy.x - origin.x);
  const dy = Math.sign(enemy.y - origin.y);
  const options = [
    { x: enemy.x + dx, y: enemy.y + dy },
    { x: enemy.x + dx, y: enemy.y },
    { x: enemy.x, y: enemy.y + dy },
  ];
  for (const target of options) {
    if (
      isPassable(state, target.x, target.y, ENEMY_BLUEPRINTS[enemy.kind]) &&
      !entityAt(state, target.x, target.y, { ignoreId: enemy.id })
    ) {
      enemy.x = target.x;
      enemy.y = target.y;
      return;
    }
  }
}

function isMoveLegal(state, player, dx, dy) {
  const target = { x: player.x + dx, y: player.y + dy };
  if (!isPassable(state, target.x, target.y)) {
    return false;
  }
  const occupant = entityAt(state, target.x, target.y);
  return !occupant || occupant.team === "enemy";
}

function resolvePlayerTile(state) {
  const player = getPlayer(state);
  const key = keyOf(player.x, player.y);
  const item = state.items[key];
  if (item?.type === "fragment") {
    delete state.items[key];
    player.fragments += 1;
    player.energy = Math.min(player.maxEnergy, player.energy + 2);
    pushLog(state, "Fragment recovered.");
    state.effects.push({ type: "fragment", x: player.x, y: player.y });
  }

  const tile = terrainAt(state, player.x, player.y);
  if (tile.kind === "exit" && player.fragments < state.totalFragments) {
    pushLog(state, "Exit locked.");
  }
}

function advanceEnemies(state) {
  const player = getPlayer(state);
  for (const enemy of getEnemies(state)) {
    if (player.hp <= 0) {
      return;
    }

    const blueprint = ENEMY_BLUEPRINTS[enemy.kind];
    if (enemy.stun > 0) {
      enemy.stun -= 1;
      state.effects.push({ type: "stun", x: enemy.x, y: enemy.y });
      continue;
    }

    if (enemyCanAttack(state, enemy, player, blueprint)) {
      attackPlayer(state, enemy, blueprint);
      continue;
    }

    if (blueprint.immobile) {
      continue;
    }

    const canSee = enemyCanSeePlayer(state, enemy, player, blueprint);
    if (canSee) {
      enemy.memory = { x: player.x, y: player.y, expires: state.turn + 5 };
    }

    const target = canSee
      ? { x: player.x, y: player.y }
      : enemy.memory && enemy.memory.expires >= state.turn
        ? { x: enemy.memory.x, y: enemy.memory.y }
        : patrolTarget(state, enemy);

    if (!target) {
      continue;
    }

    const path = findPath(state, enemy, target, {
      ignoreId: enemy.id,
      goalCanBeOccupied: target.x === player.x && target.y === player.y,
      avoidPower: blueprint.avoidPower,
      riftWalker: blueprint.riftWalker,
    });

    if (path.length > 1) {
      const step = path[1];
      if (!entityAt(state, step.x, step.y, { ignoreId: enemy.id })) {
        enemy.x = step.x;
        enemy.y = step.y;
        state.effects.push({ type: "move", x: enemy.x, y: enemy.y });
      }
    }

    if (enemyCanAttack(state, enemy, player, blueprint)) {
      attackPlayer(state, enemy, blueprint);
    }
  }
}

function enemyCanSeePlayer(state, enemy, player, blueprint) {
  return manhattan(enemy, player) <= blueprint.vision && lineOfSight(state, enemy.x, enemy.y, player.x, player.y);
}

function enemyCanAttack(state, enemy, player, blueprint) {
  const distance = manhattan(enemy, player);
  if (distance > blueprint.range) {
    return false;
  }
  if (blueprint.range > 1) {
    return lineOfSight(state, enemy.x, enemy.y, player.x, player.y);
  }
  return distance === 1;
}

function attackPlayer(state, enemy, blueprint) {
  const player = getPlayer(state);
  const tile = terrainAt(state, player.x, player.y);
  const poweredShield = state.powered[indexOf(state, player.x, player.y)] ? 1 : 0;
  const damage = Math.max(1, blueprint.damage - poweredShield);
  player.hp -= damage;
  state.effects.push({ type: "attack", x: player.x, y: player.y, from: enemy.id });
  pushLog(state, `${blueprint.name} hit the core.`);
  if (stormActive(tile, state.turn)) {
    player.hp -= 1;
  }
}

function patrolTarget(state, enemy) {
  const targets = [];
  for (const key of Object.keys(state.items)) {
    const item = state.items[key];
    if (item.type === "fragment") {
      targets.push(parseKey(key));
    }
  }
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const tile = terrainAt(state, x, y);
      if (tile.kind === "relay" && !state.capturedRelays.includes(keyOf(x, y))) {
        targets.push({ x, y });
      }
    }
  }
  targets.sort((a, b) => manhattan(enemy, a) - manhattan(enemy, b));
  return targets[0] || null;
}

function damageEnemy(state, enemy, amount, label) {
  enemy.hp -= amount;
  state.effects.push({ type: "damage", x: enemy.x, y: enemy.y, amount });
  pushLog(state, label);
}

function cleanupDead(state) {
  const before = state.entities.length;
  state.entities = state.entities.filter((entity) => entity.kind === "player" || entity.hp > 0);
  if (state.entities.length < before) {
    pushLog(state, "Intruder dissolved.");
  }
}

function applyHazards(state) {
  const player = getPlayer(state);
  const playerTile = terrainAt(state, player.x, player.y);
  if (stormActive(playerTile, state.turn)) {
    player.hp -= 2;
    pushLog(state, "Rift surge hit the core.");
    state.effects.push({ type: "rift", x: player.x, y: player.y });
  }

  for (const enemy of getEnemies(state)) {
    const tile = terrainAt(state, enemy.x, enemy.y);
    if (stormActive(tile, state.turn) && enemy.kind !== "wraith") {
      enemy.hp -= 1;
      state.effects.push({ type: "rift", x: enemy.x, y: enemy.y });
    }
  }
  cleanupDead(state);
}

function rechargePlayer(state) {
  const player = getPlayer(state);
  const tile = terrainAt(state, player.x, player.y);
  const powered = state.powered[indexOf(state, player.x, player.y)];
  if (powered) {
    player.energy = Math.min(player.maxEnergy, player.energy + 1);
  }
  if (tile.kind === "core" || state.capturedRelays.includes(keyOf(player.x, player.y))) {
    player.energy = Math.min(player.maxEnergy, player.energy + 1);
  }
}

function checkEndState(state) {
  const player = getPlayer(state);
  if (player.hp <= 0) {
    state.gameOver = true;
    state.message = "The singularity collapsed.";
    pushLog(state, state.message);
    return;
  }

  const tile = terrainAt(state, player.x, player.y);
  if (tile.kind === "exit" && player.fragments >= state.totalFragments) {
    state.victory = true;
    state.message = "Singularity sealed.";
    pushLog(state, state.message);
  }
}

function rewind(inputState) {
  const player = getPlayer(inputState);
  if (player.flux <= 0) {
    return withInvalid(inputState, "No flux left.");
  }
  if (inputState.history.length === 0) {
    return withInvalid(inputState, "No turn to rewind.");
  }

  const previous = cloneState(inputState.history[inputState.history.length - 1]);
  previous.history = inputState.history.slice(0, -1);
  const restoredPlayer = getPlayer(previous);
  restoredPlayer.flux = player.flux - 1;
  previous.effects = [{ type: "rewind", x: restoredPlayer.x, y: restoredPlayer.y }];
  previous.gameOver = false;
  previous.victory = false;
  pushLog(previous, "Turn rewound.");
  updateDerived(previous);
  return previous;
}

function withInvalid(inputState, message) {
  const state = cloneState(inputState);
  state.message = message;
  state.effects = [];
  updateDerived(state);
  return state;
}

function makeSnapshot(state) {
  const snapshot = cloneState(state);
  snapshot.history = [];
  snapshot.effects = [];
  snapshot.intents = [];
  return snapshot;
}

function pushLog(state, message) {
  state.message = message;
  state.log = [message, ...(state.log || [])].slice(0, 6);
}

function updateDerived(state) {
  state.powered = computePowered(state);
  const visibility = computeVisibility(state);
  state.visible = visibility.visible;
  state.explored = state.explored.map((wasExplored, index) => wasExplored || visibility.visible[index]);
  state.intents = computeEnemyIntents(state);
  return state;
}

function computePowered(state) {
  const powered = Array(state.width * state.height).fill(false);
  const queue = [];
  const range = Math.min(8, 4 + state.capturedRelays.length);
  for (const relayKey of state.capturedRelays) {
    const source = parseKey(relayKey);
    if (!inBounds(state, source.x, source.y)) {
      continue;
    }
    powered[indexOf(state, source.x, source.y)] = true;
    queue.push({ ...source, depth: 0 });
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.depth >= range) {
      continue;
    }
    for (const direction of DIRECTIONS) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      if (!isPassable(state, next.x, next.y, { riftWalker: true })) {
        continue;
      }
      const index = indexOf(state, next.x, next.y);
      if (powered[index]) {
        continue;
      }
      powered[index] = true;
      queue.push({ ...next, depth: current.depth + 1 });
    }
  }
  return powered;
}

function computeVisibility(state) {
  const visible = Array(state.width * state.height).fill(false);
  const sources = [];
  const player = getPlayer(state);
  sources.push({ x: player.x, y: player.y, radius: VISION_RADIUS });
  for (const relayKey of state.capturedRelays) {
    const source = parseKey(relayKey);
    sources.push({ ...source, radius: 3 });
  }

  for (const source of sources) {
    for (let y = source.y - source.radius; y <= source.y + source.radius; y += 1) {
      for (let x = source.x - source.radius; x <= source.x + source.radius; x += 1) {
        if (!inBounds(state, x, y)) {
          continue;
        }
        const distance = Math.hypot(x - source.x, y - source.y);
        if (distance <= source.radius + 0.15 && lineOfSight(state, source.x, source.y, x, y)) {
          visible[indexOf(state, x, y)] = true;
        }
      }
    }
  }
  return { visible };
}

function computeEnemyIntents(state) {
  const player = getPlayer(state);
  const intents = [];
  for (const enemy of getEnemies(state)) {
    const blueprint = ENEMY_BLUEPRINTS[enemy.kind];
    if (enemy.stun > 0) {
      intents.push({ enemyId: enemy.id, kind: enemy.kind, from: { x: enemy.x, y: enemy.y }, stunned: true });
      continue;
    }
    if (enemyCanAttack(state, enemy, player, blueprint)) {
      intents.push({
        enemyId: enemy.id,
        kind: enemy.kind,
        from: { x: enemy.x, y: enemy.y },
        target: { x: player.x, y: player.y },
        attack: true,
      });
      continue;
    }
    if (blueprint.immobile) {
      continue;
    }
    const target =
      enemyCanSeePlayer(state, enemy, player, blueprint) || enemy.memory
        ? { x: player.x, y: player.y }
        : patrolTarget(state, enemy);
    if (!target) {
      continue;
    }
    const path = findPath(state, enemy, target, {
      ignoreId: enemy.id,
      goalCanBeOccupied: target.x === player.x && target.y === player.y,
      avoidPower: blueprint.avoidPower,
      riftWalker: blueprint.riftWalker,
    });
    if (path.length > 1) {
      intents.push({
        enemyId: enemy.id,
        kind: enemy.kind,
        from: { x: enemy.x, y: enemy.y },
        to: path[1],
      });
    }
  }
  return intents;
}
