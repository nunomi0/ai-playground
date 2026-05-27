import {
  createGame,
  entityAt,
  getEnemies,
  getPlayer,
  indexOf,
  keyOf,
  manhattan,
  performAction,
  stormActive,
  terrainAt,
} from "/singularity/engine.js";

const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");

const elements = {
  turn: document.querySelector("#turn"),
  fragments: document.querySelector("#fragments"),
  relays: document.querySelector("#relays"),
  hpText: document.querySelector("#hp-text"),
  hpFill: document.querySelector("#hp-fill"),
  energyText: document.querySelector("#energy-text"),
  energyFill: document.querySelector("#energy-fill"),
  flux: document.querySelector("#flux"),
  status: document.querySelector("#status"),
  log: document.querySelector("#log"),
  blinkButton: document.querySelector("#blink-button"),
};

const keyDirections = new Map([
  ["ArrowUp", { dx: 0, dy: -1 }],
  ["w", { dx: 0, dy: -1 }],
  ["W", { dx: 0, dy: -1 }],
  ["ArrowRight", { dx: 1, dy: 0 }],
  ["d", { dx: 1, dy: 0 }],
  ["D", { dx: 1, dy: 0 }],
  ["ArrowDown", { dx: 0, dy: 1 }],
  ["s", { dx: 0, dy: 1 }],
  ["S", { dx: 0, dy: 1 }],
  ["ArrowLeft", { dx: -1, dy: 0 }],
  ["a", { dx: -1, dy: 0 }],
  ["A", { dx: -1, dy: 0 }],
]);

let state = createGame(localStorage.getItem("singularity-seed") || "first-contact");
let inputMode = "move";
let boardLayout = { cell: 32, x: 0, y: 0, width: 0, height: 0 };
let lastCanvasWidth = 0;
let lastCanvasHeight = 0;

function command(action) {
  state = performAction(state, action);
  if (action.type === "blink") {
    inputMode = "move";
  }
  updateHud();
}

function newRun() {
  const seed = `siege-${Date.now().toString(36)}`;
  localStorage.setItem("singularity-seed", seed);
  state = createGame(seed);
  inputMode = "move";
  updateHud();
}

function updateHud() {
  const player = getPlayer(state);
  elements.turn.textContent = String(state.turn);
  elements.fragments.textContent = `${player.fragments}/${state.totalFragments}`;
  elements.relays.textContent = String(state.capturedRelays.length);
  elements.hpText.textContent = `${Math.max(0, player.hp)}/${player.maxHp}`;
  elements.energyText.textContent = `${player.energy}/${player.maxEnergy}`;
  elements.flux.textContent = String(player.flux);
  elements.hpFill.style.width = `${clamp((Math.max(0, player.hp) / player.maxHp) * 100, 0, 100)}%`;
  elements.energyFill.style.width = `${clamp((player.energy / player.maxEnergy) * 100, 0, 100)}%`;
  elements.status.textContent = state.message;
  elements.blinkButton.classList.toggle("is-active", inputMode === "blink");

  const html = state.log.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
  elements.log.innerHTML = html;

  document.querySelector('[data-action="pulse"]').disabled = player.energy < 3 || state.gameOver || state.victory;
  document.querySelector('[data-mode="blink"]').disabled = player.energy < 2 || state.gameOver || state.victory;
  document.querySelector('[data-action="rewind"]').disabled =
    player.flux <= 0 || state.history.length === 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (width !== lastCanvasWidth || height !== lastCanvasHeight) {
    canvas.width = width;
    canvas.height = height;
    lastCanvasWidth = width;
    lastCanvasHeight = height;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cssWidth = rect.width;
  const cssHeight = rect.height;
  const margin = Math.max(14, Math.min(cssWidth, cssHeight) * 0.035);
  const cell = Math.floor(
    Math.min((cssWidth - margin * 2) / state.width, (cssHeight - margin * 2) / state.height),
  );
  const boardWidth = cell * state.width;
  const boardHeight = cell * state.height;
  boardLayout = {
    cell,
    x: Math.floor((cssWidth - boardWidth) / 2),
    y: Math.floor((cssHeight - boardHeight) / 2),
    width: boardWidth,
    height: boardHeight,
  };
  return { width: cssWidth, height: cssHeight };
}

function render(now = performance.now()) {
  const size = resizeCanvas();
  context.clearRect(0, 0, size.width, size.height);
  drawBackdrop(size.width, size.height, now);
  drawBoard(now);
  requestAnimationFrame(render);
}

function drawBackdrop(width, height, now) {
  const glow = context.createRadialGradient(
    width * 0.28,
    height * 0.22,
    0,
    width * 0.28,
    height * 0.22,
    width * 0.72,
  );
  glow.addColorStop(0, "rgba(86,216,176,0.11)");
  glow.addColorStop(0.5, "rgba(102,166,255,0.06)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.08;
  context.strokeStyle = "#edf3ef";
  context.lineWidth = 1;
  const shift = (now / 90) % 34;
  for (let x = -34 + shift; x < width + 34; x += 34) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + height * 0.2, height);
    context.stroke();
  }
  context.restore();
}

function drawBoard(now) {
  const { x, y, width, height, cell } = boardLayout;
  drawRoundRect(context, x - 10, y - 10, width + 20, height + 20, 8, "rgba(4,7,9,0.5)");

  for (let row = 0; row < state.height; row += 1) {
    for (let col = 0; col < state.width; col += 1) {
      drawTile(col, row, now);
    }
  }

  drawPoweredLines();
  drawIntents();
  drawItems(now);
  for (const enemy of getEnemies(state)) {
    drawEnemy(enemy, now);
  }
  drawPlayer(now);
  drawEffects(now);

  if (state.victory || state.gameOver) {
    context.save();
    context.fillStyle = "rgba(5,8,10,0.56)";
    context.fillRect(x, y, width, height);
    context.fillStyle = state.victory ? "#56d8b0" : "#e45f67";
    context.font = `900 ${Math.max(22, cell * 0.62)}px Inter, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(state.victory ? "SINGULARITY SEALED" : "CORE COLLAPSED", x + width / 2, y + height / 2);
    context.restore();
  }
}

function drawTile(col, row, now) {
  const { cell } = boardLayout;
  const px = boardLayout.x + col * cell;
  const py = boardLayout.y + row * cell;
  const tile = terrainAt(state, col, row);
  const index = indexOf(state, col, row);
  const visible = state.visible[index];
  const explored = state.explored[index];

  if (!explored) {
    drawRoundRect(context, px + 1, py + 1, cell - 2, cell - 2, 5, "#0a0d10");
    return;
  }

  let fill = "#202a2f";
  if (tile.kind === "wall") fill = "#11171b";
  if (tile.kind === "core") fill = "#1b4d47";
  if (tile.kind === "relay") fill = state.capturedRelays.includes(keyOf(col, row)) ? "#5a4a20" : "#3f315e";
  if (tile.kind === "exit") fill = "#2f3e4f";
  if (tile.kind === "rift") fill = stormActive(tile, state.turn) ? "#75313e" : "#2d2746";

  drawRoundRect(context, px + 1, py + 1, cell - 2, cell - 2, 5, fill);

  if (state.powered[index]) {
    context.save();
    context.globalAlpha = visible ? 0.18 : 0.08;
    drawRoundRect(context, px + 3, py + 3, cell - 6, cell - 6, 5, "#56d8b0");
    context.restore();
  }

  if (tile.kind === "wall") {
    context.save();
    context.strokeStyle = "rgba(237,243,239,0.08)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(px + cell * 0.25, py + cell * 0.72);
    context.lineTo(px + cell * 0.76, py + cell * 0.28);
    context.stroke();
    context.restore();
  }

  if (tile.kind === "relay") {
    const captured = state.capturedRelays.includes(keyOf(col, row));
    context.save();
    context.strokeStyle = captured ? "#e7be54" : "#9a74ff";
    context.lineWidth = Math.max(2, cell * 0.06);
    context.beginPath();
    context.arc(px + cell / 2, py + cell / 2, cell * 0.22, 0, Math.PI * 2);
    context.stroke();
    if (captured) {
      context.fillStyle = "#e7be54";
      context.beginPath();
      context.arc(px + cell / 2, py + cell / 2, cell * 0.07, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  if (tile.kind === "core" || tile.kind === "exit") {
    context.save();
    context.strokeStyle = tile.kind === "core" ? "#56d8b0" : "#edf3ef";
    context.lineWidth = Math.max(2, cell * 0.055);
    context.rotate(0);
    context.beginPath();
    context.rect(px + cell * 0.29, py + cell * 0.29, cell * 0.42, cell * 0.42);
    context.stroke();
    context.restore();
  }

  if (tile.kind === "rift") {
    const pulse = 0.5 + Math.sin(now / 180 + tile.phase) * 0.5;
    context.save();
    context.strokeStyle = stormActive(tile, state.turn) ? "#e45f67" : "#9a74ff";
    context.globalAlpha = 0.45 + pulse * 0.35;
    context.lineWidth = Math.max(1.4, cell * 0.04);
    context.beginPath();
    context.moveTo(px + cell * 0.25, py + cell * 0.3);
    context.bezierCurveTo(px + cell * 0.65, py + cell * 0.08, px + cell * 0.28, py + cell * 0.78, px + cell * 0.75, py + cell * 0.7);
    context.stroke();
    context.restore();
  }

  if (!visible) {
    drawRoundRect(context, px + 1, py + 1, cell - 2, cell - 2, 5, "rgba(2,4,6,0.56)");
  }
}

function drawPoweredLines() {
  const { cell } = boardLayout;
  context.save();
  context.strokeStyle = "rgba(86,216,176,0.17)";
  context.lineWidth = Math.max(1, cell * 0.035);
  for (let row = 0; row < state.height; row += 1) {
    for (let col = 0; col < state.width; col += 1) {
      const index = indexOf(state, col, row);
      if (!state.visible[index] || !state.powered[index]) {
        continue;
      }
      for (const direction of [
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
      ]) {
        const nx = col + direction.dx;
        const ny = row + direction.dy;
        if (
          nx >= state.width ||
          ny >= state.height ||
          !state.powered[indexOf(state, nx, ny)] ||
          !state.visible[indexOf(state, nx, ny)]
        ) {
          continue;
        }
        const from = cellCenter(col, row);
        const to = cellCenter(nx, ny);
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      }
    }
  }
  context.restore();
}

function drawIntents() {
  const { cell } = boardLayout;
  context.save();
  context.lineWidth = Math.max(2, cell * 0.045);
  for (const intent of state.intents) {
    if (!state.visible[indexOf(state, intent.from.x, intent.from.y)]) {
      continue;
    }
    const from = cellCenter(intent.from.x, intent.from.y);
    const to = intent.attack && intent.target ? cellCenter(intent.target.x, intent.target.y) : cellCenter(intent.to.x, intent.to.y);
    context.strokeStyle = intent.attack ? "rgba(228,95,103,0.86)" : "rgba(231,190,84,0.68)";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.fillStyle = intent.attack ? "#e45f67" : "#e7be54";
    context.beginPath();
    context.arc(to.x, to.y, cell * 0.08, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawItems(now) {
  const { cell } = boardLayout;
  for (const [key, item] of Object.entries(state.items)) {
    if (item.type !== "fragment") {
      continue;
    }
    const point = key.split(",").map(Number);
    const x = point[0];
    const y = point[1];
    const index = indexOf(state, x, y);
    if (!state.explored[index]) {
      continue;
    }
    const center = cellCenter(x, y);
    const bob = Math.sin(now / 240 + x * 0.7) * cell * 0.04;
    context.save();
    context.globalAlpha = state.visible[index] ? 1 : 0.38;
    context.fillStyle = "#66a6ff";
    context.strokeStyle = "#edf3ef";
    context.lineWidth = Math.max(1.2, cell * 0.035);
    context.beginPath();
    context.moveTo(center.x, center.y - cell * 0.22 + bob);
    context.lineTo(center.x + cell * 0.18, center.y + bob);
    context.lineTo(center.x, center.y + cell * 0.22 + bob);
    context.lineTo(center.x - cell * 0.18, center.y + bob);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }
}

function drawEnemy(enemy, now) {
  const { cell } = boardLayout;
  const index = indexOf(state, enemy.x, enemy.y);
  if (!state.visible[index]) {
    return;
  }
  const center = cellCenter(enemy.x, enemy.y);
  const pulse = Math.sin(now / 170 + enemy.x) * cell * 0.025;
  context.save();
  context.translate(center.x, center.y);
  context.fillStyle = enemy.kind === "sentinel" ? "#e7be54" : enemy.kind === "wraith" ? "#9a74ff" : "#e45f67";
  context.strokeStyle = "rgba(237,243,239,0.7)";
  context.lineWidth = Math.max(1, cell * 0.035);

  if (enemy.kind === "sentinel") {
    context.beginPath();
    context.rect(-cell * 0.22, -cell * 0.22, cell * 0.44, cell * 0.44);
    context.fill();
    context.stroke();
  } else if (enemy.kind === "wraith") {
    context.beginPath();
    context.ellipse(0, pulse, cell * 0.22, cell * 0.3, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    context.beginPath();
    context.moveTo(0, -cell * 0.28);
    context.lineTo(cell * 0.26, cell * 0.2);
    context.lineTo(-cell * 0.26, cell * 0.2);
    context.closePath();
    context.fill();
    context.stroke();
  }

  const barWidth = cell * 0.48;
  context.fillStyle = "rgba(0,0,0,0.5)";
  context.fillRect(-barWidth / 2, cell * 0.32, barWidth, Math.max(3, cell * 0.07));
  context.fillStyle = "#edf3ef";
  context.fillRect(
    -barWidth / 2,
    cell * 0.32,
    barWidth * clamp(enemy.hp / enemy.maxHp, 0, 1),
    Math.max(3, cell * 0.07),
  );
  context.restore();
}

function drawPlayer(now) {
  const { cell } = boardLayout;
  const player = getPlayer(state);
  const center = cellCenter(player.x, player.y);
  const shield = Math.sin(now / 210) * cell * 0.025;
  context.save();
  context.translate(center.x, center.y);
  context.strokeStyle = "#56d8b0";
  context.lineWidth = Math.max(2, cell * 0.055);
  context.beginPath();
  context.arc(0, 0, cell * 0.34 + shield, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#edf3ef";
  context.beginPath();
  context.moveTo(0, -cell * 0.24);
  context.lineTo(cell * 0.24, 0);
  context.lineTo(0, cell * 0.24);
  context.lineTo(-cell * 0.24, 0);
  context.closePath();
  context.fill();

  context.fillStyle = "#101418";
  context.beginPath();
  context.arc(0, 0, cell * 0.08, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawEffects(now) {
  const { cell } = boardLayout;
  const phase = (now % 700) / 700;
  for (const effect of state.effects || []) {
    if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y)) {
      continue;
    }
    const center = cellCenter(effect.x, effect.y);
    context.save();
    context.globalAlpha = 0.8 * (1 - phase);
    context.strokeStyle =
      effect.type === "attack" || effect.type === "rift"
        ? "#e45f67"
        : effect.type === "fragment"
          ? "#66a6ff"
          : "#56d8b0";
    context.lineWidth = Math.max(2, cell * 0.05);
    context.beginPath();
    context.arc(center.x, center.y, cell * (0.18 + phase * (effect.radius ? effect.radius : 0.8)), 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

function cellCenter(col, row) {
  return {
    x: boardLayout.x + col * boardLayout.cell + boardLayout.cell / 2,
    y: boardLayout.y + row * boardLayout.cell + boardLayout.cell / 2,
  };
}

function drawRoundRect(ctx, x, y, width, height, radius, fillStyle) {
  ctx.save();
  ctx.fillStyle = fillStyle;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, width, height);
  }
  ctx.restore();
}

function cellFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const col = Math.floor((x - boardLayout.x) / boardLayout.cell);
  const row = Math.floor((y - boardLayout.y) / boardLayout.cell);
  if (col < 0 || row < 0 || col >= state.width || row >= state.height) {
    return null;
  }
  return { x: col, y: row };
}

function actionFromCell(cell) {
  const player = getPlayer(state);
  const dx = cell.x - player.x;
  const dy = cell.y - player.y;
  if (inputMode === "blink") {
    if (dx !== 0 && dy !== 0) {
      return null;
    }
    return { type: "blink", dx: Math.sign(dx), dy: Math.sign(dy) };
  }
  if (Math.abs(dx) + Math.abs(dy) === 1) {
    return { type: "move", dx, dy };
  }
  if (cell.x === player.x && cell.y === player.y) {
    return { type: "wait" };
  }
  return null;
}

canvas.addEventListener("click", (event) => {
  const cell = cellFromEvent(event);
  if (!cell) {
    return;
  }
  const action = actionFromCell(cell);
  if (action) {
    command(action);
  }
});

document.querySelector(".actions").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) {
    return;
  }
  const action = button.dataset.action;
  if (button.dataset.mode === "blink") {
    inputMode = inputMode === "blink" ? "move" : "blink";
    updateHud();
    return;
  }
  if (action === "new") {
    newRun();
    return;
  }
  if (action) {
    command({ type: action });
  }
});

window.addEventListener("keydown", (event) => {
  const direction = keyDirections.get(event.key);
  if (direction) {
    event.preventDefault();
    const type = inputMode === "blink" || event.shiftKey ? "blink" : "move";
    command({ type, ...direction });
    return;
  }

  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    command({ type: "wait" });
  }
  if (event.key === "p" || event.key === "P") {
    command({ type: "pulse" });
  }
  if (event.key === "e" || event.key === "E") {
    command({ type: "sync" });
  }
  if (event.key === "r" || event.key === "R") {
    command({ type: "rewind" });
  }
  if (event.key === "b" || event.key === "B") {
    inputMode = inputMode === "blink" ? "move" : "blink";
    updateHud();
  }
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.__singularityDebug = {
  getState: () => state,
  setState: (nextState) => {
    state = nextState;
    updateHud();
  },
  createGame,
  performAction,
  terrainAt,
  entityAt,
  keyOf,
  manhattan,
};

updateHud();
requestAnimationFrame(render);
