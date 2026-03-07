import {
  createGameState,
  GAME_TICK_MS,
  GRID_SIZE,
  queueDirection,
  stepGame,
} from "/game.js";

const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const statusTextElement = document.querySelector("#status-text");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const controlButtons = document.querySelectorAll("[data-direction]");

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
let intervalId = null;

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

function render() {
  for (const cell of boardElement.children) {
    cell.className = "cell";
  }

  state.snake.forEach((segment, index) => {
    const cell = getCell(segment.x, segment.y);
    cell.classList.add("snake");
    if (index === 0) {
      cell.classList.add("head");
    }
  });

  if (state.food) {
    getCell(state.food.x, state.food.y).classList.add("food");
  }

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
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

function tick() {
  state = stepGame(state);
  render();

  if (state.status === "game-over") {
    stopLoop();
  }
}

function startLoop() {
  stopLoop();
  state = {
    ...state,
    status: "running",
  };
  intervalId = window.setInterval(tick, GAME_TICK_MS);
  render();
}

function togglePause() {
  if (state.status === "running") {
    state = { ...state, status: "paused" };
    stopLoop();
    render();
    return;
  }

  if (state.status === "paused" || state.status === "idle" || state.status === "game-over") {
    startLoop();
  }
}

function restart() {
  stopLoop();
  state = createGameState();
  render();
}

function updateDirection(direction) {
  state = {
    ...state,
    nextDirection: queueDirection(state.direction, direction),
  };
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
controlButtons.forEach((button) => {
  button.addEventListener("click", () => {
    updateDirection(button.dataset.direction);
  });
});

createBoard();
render();
