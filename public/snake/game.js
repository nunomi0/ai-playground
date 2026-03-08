export const GRID_SIZE = 16;
export const INITIAL_DIRECTION = "right";
export const GAME_TICK_MS = 140;

const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTIONS = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function createInitialSnake() {
  return [
    { x: 4, y: 8 },
    { x: 3, y: 8 },
    { x: 2, y: 8 },
  ];
}

export function createGameState(rng = Math.random) {
  const snake = createInitialSnake();
  return {
    snake,
    direction: INITIAL_DIRECTION,
    nextDirection: INITIAL_DIRECTION,
    food: placeFood(snake, GRID_SIZE, rng),
    score: 0,
    status: "idle",
  };
}

export function queueDirection(currentDirection, requestedDirection) {
  if (!DIRECTION_VECTORS[requestedDirection]) {
    return currentDirection;
  }

  if (OPPOSITE_DIRECTIONS[currentDirection] === requestedDirection) {
    return currentDirection;
  }

  return requestedDirection;
}

export function resolvePendingDirection(currentDirection, requestedDirection) {
  const nextDirection = queueDirection(currentDirection, requestedDirection);
  return nextDirection === currentDirection ? null : nextDirection;
}

export function getNextHead(head, direction) {
  const vector = DIRECTION_VECTORS[direction];
  return { x: head.x + vector.x, y: head.y + vector.y };
}

export function isOutOfBounds(segment, gridSize) {
  return (
    segment.x < 0 ||
    segment.y < 0 ||
    segment.x >= gridSize ||
    segment.y >= gridSize
  );
}

export function isSelfCollision(head, snake) {
  return snake.some((segment) => segment.x === head.x && segment.y === head.y);
}

export function placeFood(snake, gridSize, rng = Math.random) {
  const occupied = new Set(snake.map((segment) => `${segment.x},${segment.y}`));
  const availableCells = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const key = `${x},${y}`;
      if (!occupied.has(key)) {
        availableCells.push({ x, y });
      }
    }
  }

  if (availableCells.length === 0) {
    return null;
  }

  const index = Math.floor(rng() * availableCells.length);
  return availableCells[index];
}

export function stepGame(state, rng = Math.random) {
  if (state.status === "game-over") {
    return state;
  }

  const direction = state.nextDirection;
  const nextHead = getNextHead(state.snake[0], direction);
  const ateFood =
    state.food &&
    nextHead.x === state.food.x &&
    nextHead.y === state.food.y;
  const collisionBody = ateFood ? state.snake : state.snake.slice(0, -1);

  if (isOutOfBounds(nextHead, GRID_SIZE) || isSelfCollision(nextHead, collisionBody)) {
    return {
      ...state,
      direction,
      nextDirection: direction,
      status: "game-over",
    };
  }

  const nextSnake = [nextHead, ...state.snake];

  if (!ateFood) {
    nextSnake.pop();
  }

  const nextFood = ateFood ? placeFood(nextSnake, GRID_SIZE, rng) : state.food;
  const nextStatus = nextFood === null ? "game-over" : "running";

  return {
    ...state,
    snake: nextSnake,
    direction,
    nextDirection: direction,
    food: nextFood,
    score: ateFood ? state.score + 1 : state.score,
    status: nextStatus,
  };
}
