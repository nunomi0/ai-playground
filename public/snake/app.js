import {
  createGameState,
  GAME_TICK_MS,
  GRID_SIZE,
  resolvePendingDirection,
  stepGame,
} from "./game.js";

const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const statusTextElement = document.querySelector("#status-text");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");

const keyDirections = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
};

let state = createGameState();
let pendingDirection = null;
let animationFrameId = null;
let lastFrameTime = 0;
let accumulatedTime = 0;
let previousSnakeSegments = [];
let previousFood = null;

function createBoard() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < GRID_SIZE * GRID_SIZE; index += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    fragment.append(cell);
  }
  boardElement.append(fragment);
}

function getCell(x, y) {
  return boardElement.children[y * GRID_SIZE + x];
}

function clearBoard() {
  for (const cell of boardElement.children) {
    cell.className = "cell";
  }
}

function render() {
  previousSnakeSegments.forEach((segment) => {
    getCell(segment.x, segment.y).className = "cell";
  });

  if (previousFood) {
    getCell(previousFood.x, previousFood.y).classList.remove("food");
  }

  state.snake.forEach((segment, index) => {
    const cell = getCell(segment.x, segment.y);
    cell.classList.add("snake");
    if (index === 0) {
      cell.classList.add("head");
    } else {
      cell.classList.remove("head");
    }
  });

  if (state.food) {
    getCell(state.food.x, state.food.y).classList.add("food");
  }

  previousSnakeSegments = state.snake.map((segment) => ({ ...segment }));
  previousFood = state.food ? { ...state.food } : null;

  scoreElement.textContent = String(state.score);

  if (state.status === "idle") {
    statusTextElement.textContent = "Press Start, then use arrow keys or WASD.";
    pauseButton.textContent = "Start";
    return;
  }

  if (state.status === "paused") {
    statusTextElement.textContent = "Paused.";
    pauseButton.textContent = "Resume";
    return;
  }

  if (state.status === "game-over") {
    statusTextElement.textContent = "Game over. Restart to play again.";
    pauseButton.textContent = "Start";
    return;
  }

  statusTextElement.textContent = "Running.";
  pauseButton.textContent = "Pause";
}

function stopLoop() {
  if (animationFrameId !== null) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  lastFrameTime = 0;
  accumulatedTime = 0;
}

function tick() {
  const nextDirection = pendingDirection ?? state.direction;
  pendingDirection = null;
  state = {
    ...state,
    nextDirection,
  };
  state = stepGame(state);
  render();

  if (state.status === "game-over") {
    pendingDirection = null;
    stopLoop();
  }
}

function frame(timestamp) {
  if (state.status !== "running") {
    animationFrameId = null;
    return;
  }

  if (lastFrameTime === 0) {
    lastFrameTime = timestamp;
  }

  accumulatedTime += timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  while (accumulatedTime >= GAME_TICK_MS && state.status === "running") {
    tick();
    accumulatedTime -= GAME_TICK_MS;
  }

  if (state.status === "running") {
    animationFrameId = window.requestAnimationFrame(frame);
  } else {
    animationFrameId = null;
  }
}

function startLoop() {
  stopLoop();
  state = {
    ...state,
    status: "running",
  };
  pendingDirection = null;
  render();
  animationFrameId = window.requestAnimationFrame(frame);
}

function togglePause() {
  if (state.status === "running") {
    state = { ...state, status: "paused" };
    stopLoop();
    render();
    return;
  }

  if (state.status === "paused" || state.status === "idle" || state.status === "game-over") {
    if (state.status === "game-over") {
      restart();
    }
    startLoop();
  }
}

function restart() {
  stopLoop();
  clearBoard();
  state = createGameState();
  pendingDirection = null;
  previousSnakeSegments = [];
  previousFood = null;
  render();
}

function updateDirection(direction) {
  const nextDirection = resolvePendingDirection(state.direction, direction);
  if (nextDirection) {
    pendingDirection = nextDirection;
  }
}

document.addEventListener("keydown", (event) => {
  const direction = keyDirections[event.key] ?? keyDirections[event.key.toLowerCase?.()];
  if (!direction) {
    return;
  }

  event.preventDefault();
  updateDirection(direction);
});

pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", restart);

createBoard();
clearBoard();
render();
