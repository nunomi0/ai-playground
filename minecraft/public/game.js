let started = false;

export function startMinecraft() {
  if (started) {
    return;
  }

  started = true;
  const canvas = document.querySelector("#game");
  const context = canvas.getContext("2d");
  const inventoryElement = document.querySelector("#inventory");
  const statusElement = document.querySelector("#status");
  const resetButton = document.querySelector("#reset-button");
  const lockHintElement = document.querySelector("#lock-hint");

  const WORLD_WIDTH = 48;
  const WORLD_HEIGHT = 24;
  const WORLD_DEPTH = 48;
  const PLAYER_RADIUS = 0.32;
  const PLAYER_HEIGHT = 1.7;
  const PLAYER_EYE_OFFSET = 1.58;
  const MOVE_SPEED = 4.2;
  const JUMP_SPEED = 8;
  const GRAVITY = 22;
  const MAX_FALL_SPEED = 20;
  const REACH = 6.5;
  const DRAW_DISTANCE = 18;
  const LOOK_SPEED = 0.0024;
  const FOV = Math.PI / 2.7;

  const blockTypes = [
    {
      id: 0,
      key: "air",
      label: "Air",
      solid: false,
      top: "#000000",
      side: "#000000",
      bottom: "#000000",
    },
    {
      id: 1,
      key: "grass",
      label: "Grass",
      solid: true,
      top: "#78c44f",
      side: "#5e9f42",
      bottom: "#7d5a32",
    },
    {
      id: 2,
      key: "dirt",
      label: "Dirt",
      solid: true,
      top: "#8e6338",
      side: "#8e6338",
      bottom: "#7a5029",
    },
    {
      id: 3,
      key: "stone",
      label: "Stone",
      solid: true,
      top: "#8f96a0",
      side: "#7f8791",
      bottom: "#6f7781",
    },
    {
      id: 4,
      key: "wood",
      label: "Wood",
      solid: true,
      top: "#ba8a57",
      side: "#956739",
      bottom: "#80572d",
    },
    {
      id: 5,
      key: "leaves",
      label: "Leaves",
      solid: true,
      top: "#4f9c4f",
      side: "#478947",
      bottom: "#397139",
    },
    {
      id: 6,
      key: "water",
      label: "Water",
      solid: false,
      top: "#4f93d8",
      side: "#457fc1",
      bottom: "#34679d",
    },
  ];

  const blockKeyToId = Object.fromEntries(blockTypes.map((block) => [block.key, block.id]));
  const palette = ["grass", "dirt", "stone", "wood", "leaves", "water"];
  const keys = new Set();

  const faceDefs = [
    {
      axis: "x",
      delta: 1,
      normal: [1, 0, 0],
      vertices: [
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
        [1, 0, 1],
      ],
      tone: "side",
    },
    {
      axis: "x",
      delta: -1,
      normal: [-1, 0, 0],
      vertices: [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
        [0, 0, 0],
      ],
      tone: "side",
    },
    {
      axis: "y",
      delta: 1,
      normal: [0, 1, 0],
      vertices: [
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
        [0, 1, 0],
      ],
      tone: "top",
    },
    {
      axis: "y",
      delta: -1,
      normal: [0, -1, 0],
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ],
      tone: "bottom",
    },
    {
      axis: "z",
      delta: 1,
      normal: [0, 0, 1],
      vertices: [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
      tone: "side",
    },
    {
      axis: "z",
      delta: -1,
      normal: [0, 0, -1],
      vertices: [
        [1, 0, 0],
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
      tone: "side",
    },
  ];

  let selectedBlockKey = "grass";
  let selectedBlockId = blockKeyToId[selectedBlockKey];
  let world = createWorld();
  let hoverHit = null;

  const player = {
    x: 8,
    y: 14,
    z: 8,
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,
    yaw: 0.75,
    pitch: -0.08,
    onGround: false,
  };

  let statusUntil = 0;
  let statusMessage = "Click the canvas to start.";
  let lastFrameTime = 0;

  function worldIndex(x, y, z) {
    return x + z * WORLD_WIDTH + y * WORLD_WIDTH * WORLD_DEPTH;
  }

  function inBounds(x, y, z) {
    return x >= 0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT && z >= 0 && z < WORLD_DEPTH;
  }

  function getBlock(x, y, z) {
    if (!inBounds(x, y, z)) {
      return blockKeyToId.stone;
    }
    return world[worldIndex(x, y, z)];
  }

  function setBlock(x, y, z, blockId) {
    if (!inBounds(x, y, z)) {
      return;
    }
    world[worldIndex(x, y, z)] = blockId;
  }

  function createWorld() {
    const data = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT * WORLD_DEPTH);

    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      for (let z = 0; z < WORLD_DEPTH; z += 1) {
        const height =
          8 +
          Math.floor(Math.sin(x / 4.7) * 1.9) +
          Math.floor(Math.cos(z / 5.2) * 1.6) +
          Math.floor(Math.sin((x + z) / 8) * 1.3);

        for (let y = 0; y <= Math.max(0, height); y += 1) {
          let blockId = blockKeyToId.stone;
          if (y > height - 3) {
            blockId = blockKeyToId.dirt;
          }
          if (y === height) {
            blockId = blockKeyToId.grass;
          }
          data[worldIndex(x, y, z)] = blockId;
        }
      }
    }

    for (let x = 14; x <= 22; x += 1) {
      for (let z = 28; z <= 36; z += 1) {
        const base = getFrom(data, x, z);
        if (base > 5) {
          data[worldIndex(x, base, z)] = blockKeyToId.water;
        }
      }
    }

    plantTree(data, 12, 11);
    plantTree(data, 29, 18);
    plantTree(data, 35, 31);
    plantTree(data, 21, 8);

    return data;
  }

  function getFrom(data, x, z) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y -= 1) {
      const blockId = data[worldIndex(x, y, z)];
      if (blockId !== blockKeyToId.air && blockId !== blockKeyToId.water) {
        return y;
      }
    }
    return 0;
  }

  function plantTree(data, x, z) {
    const groundY = getFrom(data, x, z);
    if (groundY < 4 || groundY > WORLD_HEIGHT - 7) {
      return;
    }

    for (let offset = 1; offset <= 3; offset += 1) {
      data[worldIndex(x, groundY + offset, z)] = blockKeyToId.wood;
    }

    const crownY = groundY + 4;
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 3) {
            continue;
          }
          const tx = x + dx;
          const ty = crownY + dy;
          const tz = z + dz;
          if (!inBounds(tx, ty, tz)) {
            continue;
          }
          data[worldIndex(tx, ty, tz)] = blockKeyToId.leaves;
        }
      }
    }
  }

  function isSolid(blockId) {
    return blockTypes[blockId].solid;
  }

  function collidesAt(x, y, z) {
    const minX = Math.floor(x - PLAYER_RADIUS);
    const maxX = Math.floor(x + PLAYER_RADIUS);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + PLAYER_HEIGHT - 0.001);
    const minZ = Math.floor(z - PLAYER_RADIUS);
    const maxZ = Math.floor(z + PLAYER_RADIUS);

    for (let tx = minX; tx <= maxX; tx += 1) {
      for (let ty = minY; ty <= maxY; ty += 1) {
        for (let tz = minZ; tz <= maxZ; tz += 1) {
          if (isSolid(getBlock(tx, ty, tz))) {
            return true;
          }
        }
      }
    }

    return false;
  }

  function resolveAxis(axis, delta) {
    if (delta === 0) {
      return;
    }

    const direction = Math.sign(delta);
    const step = Math.min(Math.abs(delta), 0.05) * direction;
    let remaining = delta;

    while (Math.abs(remaining) > 0.0001) {
      const slice = Math.abs(remaining) < Math.abs(step) ? remaining : step;
      let targetX = player.x;
      let targetY = player.y;
      let targetZ = player.z;

      if (axis === "x") {
        targetX += slice;
      } else if (axis === "y") {
        targetY += slice;
      } else {
        targetZ += slice;
      }

      if (collidesAt(targetX, targetY, targetZ)) {
        if (axis === "y") {
          if (slice < 0) {
            player.onGround = true;
          }
          player.velocityY = 0;
        } else if (axis === "x") {
          player.velocityX = 0;
        } else {
          player.velocityZ = 0;
        }
        break;
      }

      player.x = targetX;
      player.y = targetY;
      player.z = targetZ;
      remaining -= slice;
    }
  }

  function cameraDirection() {
    const cosPitch = Math.cos(player.pitch);
    return {
      x: Math.sin(player.yaw) * cosPitch,
      y: Math.sin(player.pitch),
      z: Math.cos(player.yaw) * cosPitch,
    };
  }

  function raycast(maxDistance) {
    const origin = { x: player.x, y: player.y + PLAYER_EYE_OFFSET, z: player.z };
    const direction = cameraDirection();
    let previousCell = null;

    for (let t = 0; t <= maxDistance; t += 0.05) {
      const sx = origin.x + direction.x * t;
      const sy = origin.y + direction.y * t;
      const sz = origin.z + direction.z * t;

      const cell = {
        x: Math.floor(sx),
        y: Math.floor(sy),
        z: Math.floor(sz),
      };

      if (!previousCell || cell.x !== previousCell.x || cell.y !== previousCell.y || cell.z !== previousCell.z) {
        const blockId = getBlock(cell.x, cell.y, cell.z);
        if (blockId !== blockKeyToId.air) {
          return { hit: cell, previous: previousCell, blockId };
        }
        previousCell = cell;
      }
    }

    return null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function updateStatus(now) {
    const selected = blockTypes[selectedBlockId].label;
    const locked = document.pointerLockElement === canvas;
    if (statusUntil > now) {
      statusElement.textContent = `${statusMessage}  |  Selected: ${selected}`;
      return;
    }
    if (!locked) {
      statusElement.textContent = `Click canvas to start.  |  Selected: ${selected}`;
      return;
    }
    statusElement.textContent = `Selected: ${selected}`;
  }

  function showStatus(message, durationMs = 1600) {
    statusMessage = message;
    statusUntil = performance.now() + durationMs;
  }

  function updatePlayer(deltaTime) {
    const forward = (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0);
    const strafe = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);

    let moveX = 0;
    let moveZ = 0;
    if (forward !== 0 || strafe !== 0) {
      const length = Math.hypot(forward, strafe);
      const normForward = forward / length;
      const normStrafe = strafe / length;
      const sinYaw = Math.sin(player.yaw);
      const cosYaw = Math.cos(player.yaw);
      moveX = sinYaw * normForward + cosYaw * normStrafe;
      moveZ = cosYaw * normForward - sinYaw * normStrafe;
    }

    player.velocityX = moveX * MOVE_SPEED;
    player.velocityZ = moveZ * MOVE_SPEED;

    if (keys.has(" ") && player.onGround) {
      player.velocityY = JUMP_SPEED;
      player.onGround = false;
    }

    player.velocityY = Math.max(player.velocityY - GRAVITY * deltaTime, -MAX_FALL_SPEED);

    resolveAxis("x", player.velocityX * deltaTime);
    resolveAxis("z", player.velocityZ * deltaTime);
    player.onGround = false;
    resolveAxis("y", player.velocityY * deltaTime);

    player.x = clamp(player.x, 1.5, WORLD_WIDTH - 1.5);
    player.z = clamp(player.z, 1.5, WORLD_DEPTH - 1.5);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width * dpr));
    const height = Math.max(180, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function viewTransform(wx, wy, wz) {
    const dx = wx - player.x;
    const dy = wy - (player.y + PLAYER_EYE_OFFSET);
    const dz = wz - player.z;

    const sinYaw = Math.sin(player.yaw);
    const cosYaw = Math.cos(player.yaw);
    const xzX = cosYaw * dx - sinYaw * dz;
    const xzZ = sinYaw * dx + cosYaw * dz;

    const sinPitch = Math.sin(player.pitch);
    const cosPitch = Math.cos(player.pitch);

    return {
      x: xzX,
      y: cosPitch * dy - sinPitch * xzZ,
      z: sinPitch * dy + cosPitch * xzZ,
    };
  }

  function shade(hex, factor) {
    const int = Number.parseInt(hex.slice(1), 16);
    const r = (int >> 16) & 0xff;
    const g = (int >> 8) & 0xff;
    const b = int & 0xff;
    const nr = Math.max(0, Math.min(255, Math.round(r * factor)));
    const ng = Math.max(0, Math.min(255, Math.round(g * factor)));
    const nb = Math.max(0, Math.min(255, Math.round(b * factor)));
    return `rgb(${nr} ${ng} ${nb})`;
  }

  function sky() {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#74b9ff");
    gradient.addColorStop(0.58, "#cceeff");
    gradient.addColorStop(0.581, "#9bcc74");
    gradient.addColorStop(1, "#5f7b41");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function pushFace(faces, x, y, z, faceDef, block) {
    const cameraX = player.x;
    const cameraY = player.y + PLAYER_EYE_OFFSET;
    const cameraZ = player.z;

    if (faceDef.normal[0] === 1 && cameraX <= x + 1) {
      return;
    }
    if (faceDef.normal[0] === -1 && cameraX >= x) {
      return;
    }
    if (faceDef.normal[1] === 1 && cameraY <= y + 1) {
      return;
    }
    if (faceDef.normal[1] === -1 && cameraY >= y) {
      return;
    }
    if (faceDef.normal[2] === 1 && cameraZ <= z + 1) {
      return;
    }
    if (faceDef.normal[2] === -1 && cameraZ >= z) {
      return;
    }

    const focal = canvas.height / (2 * Math.tan(FOV / 2));
    const projected = [];
    let depthSum = 0;

    for (const vertex of faceDef.vertices) {
      const worldX = x + vertex[0];
      const worldY = y + vertex[1];
      const worldZ = z + vertex[2];
      const cameraPoint = viewTransform(worldX, worldY, worldZ);
      if (cameraPoint.z <= 0.08) {
        return;
      }
      depthSum += cameraPoint.z;
      projected.push({
        x: canvas.width / 2 + (cameraPoint.x / cameraPoint.z) * focal,
        y: canvas.height / 2 - (cameraPoint.y / cameraPoint.z) * focal,
      });
    }

    const baseColor = block[faceDef.tone];
    const depth = depthSum / projected.length;
    const fog = clamp(1 - depth / (DRAW_DISTANCE * 1.8), 0.35, 1);
    faces.push({
      points: projected,
      depth,
      color: shade(baseColor, fog),
      outline: shade(baseColor, fog * 0.72),
    });
  }

  function renderWorld() {
    sky();
    const faces = [];
    const centerX = Math.floor(player.x);
    const centerY = Math.floor(player.y);
    const centerZ = Math.floor(player.z);
    const minX = Math.max(0, centerX - DRAW_DISTANCE);
    const maxX = Math.min(WORLD_WIDTH - 1, centerX + DRAW_DISTANCE);
    const minY = Math.max(0, centerY - DRAW_DISTANCE);
    const maxY = Math.min(WORLD_HEIGHT - 1, centerY + DRAW_DISTANCE);
    const minZ = Math.max(0, centerZ - DRAW_DISTANCE);
    const maxZ = Math.min(WORLD_DEPTH - 1, centerZ + DRAW_DISTANCE);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          const blockId = getBlock(x, y, z);
          if (blockId === blockKeyToId.air) {
            continue;
          }

          const block = blockTypes[blockId];
          const distance = Math.hypot(x + 0.5 - player.x, y + 0.5 - player.y, z + 0.5 - player.z);
          if (distance > DRAW_DISTANCE + 1) {
            continue;
          }

          for (const faceDef of faceDefs) {
            const nx = x + (faceDef.axis === "x" ? faceDef.delta : 0);
            const ny = y + (faceDef.axis === "y" ? faceDef.delta : 0);
            const nz = z + (faceDef.axis === "z" ? faceDef.delta : 0);
            const neighbor = getBlock(nx, ny, nz);
            if (neighbor !== blockKeyToId.air && blockTypes[neighbor].solid) {
              continue;
            }
            pushFace(faces, x, y, z, faceDef, block);
          }
        }
      }
    }

    faces.sort((a, b) => b.depth - a.depth);

    for (const face of faces) {
      context.beginPath();
      context.moveTo(face.points[0].x, face.points[0].y);
      for (let i = 1; i < face.points.length; i += 1) {
        context.lineTo(face.points[i].x, face.points[i].y);
      }
      context.closePath();
      context.fillStyle = face.color;
      context.fill();
      context.strokeStyle = face.outline;
      context.lineWidth = 1;
      context.stroke();
    }
  }

  function renderCrosshair() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    context.strokeStyle = "rgba(255, 255, 255, 0.92)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx - 10, cy);
    context.lineTo(cx - 2, cy);
    context.moveTo(cx + 2, cy);
    context.lineTo(cx + 10, cy);
    context.moveTo(cx, cy - 10);
    context.lineTo(cx, cy - 2);
    context.moveTo(cx, cy + 2);
    context.lineTo(cx, cy + 10);
    context.stroke();
  }

  function renderSelection() {
    if (!hoverHit) {
      return;
    }
    const text = `${blockTypes[hoverHit.blockId].label} (${hoverHit.hit.x}, ${hoverHit.hit.y}, ${hoverHit.hit.z})`;
    context.font = "14px Trebuchet MS, sans-serif";
    context.fillStyle = "rgba(10, 16, 26, 0.45)";
    context.fillRect(14, canvas.height - 40, context.measureText(text).width + 14, 24);
    context.fillStyle = "#f5f7fb";
    context.fillText(text, 21, canvas.height - 23);
  }

  function render(now) {
    updateStatus(now);
    renderWorld();
    renderCrosshair();
    renderSelection();
  }

  function isInsidePlayer(tx, ty, tz) {
    const minX = player.x - PLAYER_RADIUS;
    const maxX = player.x + PLAYER_RADIUS;
    const minY = player.y;
    const maxY = player.y + PLAYER_HEIGHT;
    const minZ = player.z - PLAYER_RADIUS;
    const maxZ = player.z + PLAYER_RADIUS;
    return !(tx + 1 <= minX || tx >= maxX || ty + 1 <= minY || ty >= maxY || tz + 1 <= minZ || tz >= maxZ);
  }

  function syncInventory() {
    for (const button of inventoryElement.querySelectorAll(".inventory-button")) {
      button.classList.toggle("active", button.dataset.block === selectedBlockKey);
    }
  }

  function buildInventory() {
    const fragment = document.createDocumentFragment();
    for (const blockKey of palette) {
      const block = blockTypes[blockKeyToId[blockKey]];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inventory-button";
      button.dataset.block = blockKey;
      button.innerHTML = `<span class="swatch" style="background:${block.top}"></span><span>${block.label}</span>`;
      button.addEventListener("click", () => {
        selectedBlockKey = blockKey;
        selectedBlockId = blockKeyToId[blockKey];
        syncInventory();
      });
      fragment.append(button);
    }
    inventoryElement.append(fragment);
    syncInventory();
  }

  function loop(timestamp) {
    if (lastFrameTime === 0) {
      lastFrameTime = timestamp;
    }

    const deltaTime = Math.min(0.033, (timestamp - lastFrameTime) / 1000);
    lastFrameTime = timestamp;

    resizeCanvas();
    updatePlayer(deltaTime);
    hoverHit = raycast(REACH);
    render(timestamp);
    requestAnimationFrame(loop);
  }

  canvas.addEventListener("click", () => {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    }
  });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  canvas.addEventListener("mousedown", (event) => {
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
      return;
    }

    const hit = raycast(REACH);
    if (!hit) {
      showStatus("No block in range.");
      return;
    }

    if (event.button === 0) {
      setBlock(hit.hit.x, hit.hit.y, hit.hit.z, blockKeyToId.air);
      showStatus("Block removed.");
      return;
    }

    if (event.button === 2) {
      if (!hit.previous) {
        showStatus("No placement surface.");
        return;
      }
      if (isInsidePlayer(hit.previous.x, hit.previous.y, hit.previous.z)) {
        showStatus("Cannot place block inside player.");
        return;
      }
      setBlock(hit.previous.x, hit.previous.y, hit.previous.z, selectedBlockId);
      showStatus(`${blockTypes[selectedBlockId].label} placed.`);
    }
  });

  document.addEventListener("pointerlockchange", () => {
    const locked = document.pointerLockElement === canvas;
    lockHintElement.classList.toggle("hidden", locked);
    if (locked) {
      showStatus("Mouse locked.");
    } else {
      showStatus("Mouse unlocked. Click canvas.");
    }
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== canvas) {
      return;
    }

    player.yaw += event.movementX * LOOK_SPEED;
    player.pitch -= event.movementY * LOOK_SPEED;
    player.pitch = clamp(player.pitch, -1.35, 1.35);
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    keys.add(key);

    if (["w", "a", "s", "d", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
    }

    const paletteIndex = Number.parseInt(event.key, 10);
    if (!Number.isNaN(paletteIndex) && paletteIndex >= 1 && paletteIndex <= palette.length) {
      selectedBlockKey = palette[paletteIndex - 1];
      selectedBlockId = blockKeyToId[selectedBlockKey];
      syncInventory();
    }
  });

  document.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  resetButton.addEventListener("click", () => {
    world = createWorld();
    player.x = 8;
    player.y = 14;
    player.z = 8;
    player.velocityX = 0;
    player.velocityY = 0;
    player.velocityZ = 0;
    showStatus("World reset.");
  });

  buildInventory();
  resizeCanvas();
  requestAnimationFrame(loop);
}
