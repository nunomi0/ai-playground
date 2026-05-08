export const MATERIALS = Object.freeze({
  EMPTY: 0,
  STONE: 1,
  SAND: 2,
  WATER: 3,
  FIRE: 4,
  SMOKE: 5,
});

export const MATERIAL_KEYS = Object.freeze(
  Object.entries(MATERIALS).map(([name, id]) => ({
    id,
    key: name,
  })),
);

export const MATERIAL_INFO = Object.freeze({
  [MATERIALS.EMPTY]: { label: "Eraser", color: "#0b1020" },
  [MATERIALS.STONE]: { label: "Stone", color: "#717a90" },
  [MATERIALS.SAND]: { label: "Sand", color: "#f0c36c" },
  [MATERIALS.WATER]: { label: "Water", color: "#58a6ff" },
  [MATERIALS.FIRE]: { label: "Fire", color: "#ff7d4d" },
  [MATERIALS.SMOKE]: { label: "Smoke", color: "#bcc5d6" },
});

const FIRE_LIFETIME = 6;
const SMOKE_LIFETIME = 10;

function getDefaultLife(material) {
  if (material === MATERIALS.FIRE) return FIRE_LIFETIME;
  if (material === MATERIALS.SMOKE) return SMOKE_LIFETIME;
  return 0;
}

function getIndex(world, x, y) {
  return y * world.width + x;
}

function inBounds(world, x, y) {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

function clearCell(world, index) {
  world.cells[index] = MATERIALS.EMPTY;
  world.life[index] = 0;
}

function moveCell(world, processed, fromIndex, toX, toY) {
  const toIndex = getIndex(world, toX, toY);
  if (world.cells[toIndex] !== MATERIALS.EMPTY || processed[toIndex]) {
    return false;
  }

  world.cells[toIndex] = world.cells[fromIndex];
  world.life[toIndex] = world.life[fromIndex];
  clearCell(world, fromIndex);
  processed[toIndex] = 1;
  processed[fromIndex] = 1;
  return true;
}

function getDirections(random) {
  return random() < 0.5 ? [-1, 1] : [1, -1];
}

function cloneWorld(world) {
  return {
    width: world.width,
    height: world.height,
    cells: world.cells.slice(),
    life: world.life.slice(),
    tick: world.tick + 1,
  };
}

export function createWorld(width, height) {
  return {
    width,
    height,
    cells: new Uint8Array(width * height),
    life: new Uint8Array(width * height),
    tick: 0,
  };
}

export function getCell(world, x, y) {
  if (!inBounds(world, x, y)) return MATERIALS.STONE;
  return world.cells[getIndex(world, x, y)];
}

export function setCell(world, x, y, material, life = getDefaultLife(material)) {
  if (!inBounds(world, x, y)) return;
  const index = getIndex(world, x, y);
  world.cells[index] = material;
  world.life[index] = material === MATERIALS.EMPTY ? 0 : life;
}

export function paintCircle(world, centerX, centerY, radius, material) {
  const minX = Math.floor(centerX - radius);
  const maxX = Math.ceil(centerX + radius);
  const minY = Math.floor(centerY - radius);
  const maxY = Math.ceil(centerY + radius);
  const radiusSq = radius * radius;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!inBounds(world, x, y)) continue;
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy > radiusSq) continue;
      setCell(world, x, y, material);
    }
  }

  return world;
}

export function summarizeWorld(world) {
  const counts = {
    empty: 0,
    stone: 0,
    sand: 0,
    water: 0,
    fire: 0,
    smoke: 0,
  };

  for (const material of world.cells) {
    switch (material) {
      case MATERIALS.EMPTY:
        counts.empty += 1;
        break;
      case MATERIALS.STONE:
        counts.stone += 1;
        break;
      case MATERIALS.SAND:
        counts.sand += 1;
        break;
      case MATERIALS.WATER:
        counts.water += 1;
        break;
      case MATERIALS.FIRE:
        counts.fire += 1;
        break;
      case MATERIALS.SMOKE:
        counts.smoke += 1;
        break;
      default:
        break;
    }
  }

  return counts;
}

export function stepWorld(world, random = Math.random) {
  const next = cloneWorld(world);
  const processed = new Uint8Array(next.cells.length);

  for (let y = 0; y < next.height; y += 1) {
    for (let x = 0; x < next.width; x += 1) {
      const index = getIndex(next, x, y);
      if (next.cells[index] !== MATERIALS.FIRE || processed[index]) continue;

      const life = Math.max(0, next.life[index] - 1);
      if (life === 0) {
        next.cells[index] = MATERIALS.SMOKE;
        next.life[index] = SMOKE_LIFETIME;
      } else {
        next.life[index] = life;
      }

      processed[index] = 1;
    }
  }

  for (let y = 0; y < next.height; y += 1) {
    for (let x = 0; x < next.width; x += 1) {
      const index = getIndex(next, x, y);
      if (next.cells[index] !== MATERIALS.SMOKE || processed[index]) continue;

      const life = Math.max(0, next.life[index] - 1);
      if (life === 0) {
        clearCell(next, index);
        processed[index] = 1;
        continue;
      }

      next.life[index] = life;
      if (moveCell(next, processed, index, x, y - 1)) continue;

      for (const dx of getDirections(random)) {
        if (moveCell(next, processed, index, x + dx, y - 1)) {
          break;
        }
      }

      if (!processed[index]) {
        processed[index] = 1;
      }
    }
  }

  for (let y = next.height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < next.width; x += 1) {
      const index = getIndex(next, x, y);
      const material = next.cells[index];
      if (processed[index]) continue;

      if (material === MATERIALS.SAND) {
        if (moveCell(next, processed, index, x, y + 1)) continue;

        for (const dx of getDirections(random)) {
          if (moveCell(next, processed, index, x + dx, y + 1)) {
            break;
          }
        }

        if (!processed[index]) {
          processed[index] = 1;
        }

        continue;
      }

      if (material === MATERIALS.WATER) {
        if (moveCell(next, processed, index, x, y + 1)) continue;

        for (const dx of getDirections(random)) {
          if (moveCell(next, processed, index, x + dx, y)) {
            break;
          }
        }

        if (!processed[index]) {
          for (const dx of getDirections(random)) {
            if (moveCell(next, processed, index, x + dx, y + 1)) {
              break;
            }
          }
        }

        if (!processed[index]) {
          processed[index] = 1;
        }

        continue;
      }

      if (material !== MATERIALS.EMPTY) {
        processed[index] = 1;
      }
    }
  }

  return next;
}
