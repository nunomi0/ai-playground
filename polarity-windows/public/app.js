const app = document.querySelector("#app");
const backButton = document.querySelector("#backButton");
const openWindowButton = document.querySelector("#openWindowButton");
const rerollButton = document.querySelector("#rerollButton");
const closeWindowButton = document.querySelector("#closeWindowButton");
const faceCanvas = document.querySelector("#faceCanvas");
const faceContext = faceCanvas.getContext("2d", { willReadFrequently: true });

const channelName = "polarity-windows-field";
const peerTimeout = 1800;
const influenceRange = 900;
const storagePrefix = "polarity-windows-signal:";
const spritePath = "/polarity-windows/assets/face-sprite-raw.png";
const id = crypto.randomUUID();
const storageKey = `${storagePrefix}${id}`;
const peers = new Map();
const channel = "BroadcastChannel" in window ? new BroadcastChannel(channelName) : null;
let channelOpen = Boolean(channel);
let spriteImage = null;
let currentCellKey = "";
let active = true;

const state = {
  polarity: pickPolarity(),
  stage: 0,
  relation: "neutral",
};

function pickPolarity() {
  return Math.random() < 0.5 ? "S" : "N";
}

function centerOfWindow(peer = null) {
  if (peer) {
    return {
      x: peer.x + peer.width / 2,
      y: peer.y + peer.height / 2,
    };
  }

  return {
    x: window.screenX + window.outerWidth / 2,
    y: window.screenY + window.outerHeight / 2,
  };
}

function snapshot() {
  return {
    id,
    polarity: state.polarity,
    x: window.screenX,
    y: window.screenY,
    width: window.outerWidth,
    height: window.outerHeight,
    now: Date.now(),
  };
}

function publish() {
  if (!active) return;

  const message = snapshot();
  if (channel && channelOpen) {
    try {
      channel.postMessage(message);
    } catch {
      channelOpen = false;
    }
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(message));
  } catch {
    // Local storage can be disabled in private contexts.
  }
}

function receive(message) {
  if (!message || message.id === id || !message.polarity) return;
  peers.set(message.id, { ...message, seenAt: Date.now() });
}

function prunePeers(now) {
  for (const [peerId, peer] of peers) {
    if (now - peer.seenAt > peerTimeout) {
      peers.delete(peerId);
      try {
        localStorage.removeItem(`${storagePrefix}${peerId}`);
      } catch {
        // Ignore local storage cleanup failures.
      }
    }
  }
}

function syncFromStorage() {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(storagePrefix) || key === storageKey) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      receive(JSON.parse(raw));
    }
  } catch {
    // Cross-window storage is best-effort.
  }
}

function getClosestPeer() {
  const own = centerOfWindow();
  let closest = null;

  for (const peer of peers.values()) {
    const peerCenter = centerOfWindow(peer);
    const distance = Math.hypot(peerCenter.x - own.x, peerCenter.y - own.y);
    if (!closest || distance < closest.distance) {
      closest = { ...peer, distance, center: peerCenter };
    }
  }

  return closest;
}

function stageForDistance(distance) {
  if (!Number.isFinite(distance) || distance > influenceRange) return 0;
  if (distance <= 320) return 3;
  if (distance <= 560) return 2;
  return 1;
}

function spriteCellFor(relation, stage) {
  if (relation === "attract") return { col: Math.max(1, stage), row: 0 };
  if (relation === "repel") return { col: Math.max(0, stage), row: 1 };
  return { col: 0, row: 0 };
}

function liquidVectorFor(closest, relation, intensity) {
  if (!closest || relation === "neutral") {
    return {
      ownX: 0,
      ownY: 0,
      stretch: 1,
      spin: 0,
    };
  }

  const ownCenter = centerOfWindow();
  const dx = closest.center.x - ownCenter.x;
  const dy = closest.center.y - ownCenter.y;
  const length = Math.hypot(dx, dy);
  const ux = length < 1 ? 1 : dx / length;
  const uy = length < 1 ? 0 : dy / length;
  const attraction = relation === "attract";
  const stageBoost = 0.45 + intensity * 0.9;
  const ownDistance = attraction ? 74 : -108;

  return {
    ownX: ux * ownDistance * stageBoost,
    ownY: uy * ownDistance * stageBoost,
    stretch: attraction ? 0.86 + intensity * 0.24 : 1.04 + intensity * 0.18,
    spin: Math.atan2(uy, ux) * (180 / Math.PI),
  };
}

function updateMood(closest) {
  const stage = closest ? stageForDistance(closest.distance) : 0;
  const relation = closest && stage > 0
    ? closest.polarity === state.polarity
      ? "repel"
      : "attract"
    : "neutral";
  const intensity = stage / 3;
  const cell = spriteCellFor(relation, stage);
  const direction = relation === "repel" ? 1 : relation === "attract" ? -1 : 0;
  const push = Math.round(direction * intensity * 34);
  const liquid = liquidVectorFor(closest, relation, intensity);

  state.stage = stage;
  state.relation = relation;

  app.classList.toggle("pole-s", state.polarity === "S");
  app.classList.toggle("pole-n", state.polarity === "N");
  app.classList.toggle("mood-same", relation === "repel");
  app.classList.toggle("mood-opposite", relation === "attract");
  app.style.setProperty("--intensity", intensity.toFixed(3));
  app.style.setProperty("--own-x", `${Math.round(liquid.ownX)}px`);
  app.style.setProperty("--own-y", `${Math.round(liquid.ownY)}px`);
  app.style.setProperty("--liquid-stretch", liquid.stretch.toFixed(3));
  app.style.setProperty("--liquid-spin", `${Math.round(liquid.spin)}deg`);
  app.style.setProperty("--pull-x", `${push}px`);
  app.style.setProperty("--pull-y", `${Math.round(push * 0.38)}px`);
  renderFace(cell);
  document.title = `${state.polarity} Polarity`;
}

function loop() {
  if (!active) return;

  const now = Date.now();
  syncFromStorage();
  prunePeers(now);
  const closest = getClosestPeer();
  updateMood(closest);
  publish();
  requestAnimationFrame(loop);
}

function openNewWindow() {
  const width = 520;
  const height = 620;
  const offset = 34 + Math.floor(Math.random() * 120);
  const left = Math.max(0, window.screenX + offset);
  const top = Math.max(0, window.screenY + offset);
  const features = [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=no",
  ].join(",");
  const child = window.open(`/polarity-windows?popup=1&t=${Date.now()}`, `_polarity_${Date.now()}`, features);
  if (child) child.focus();
}

function rerollPolarity() {
  state.polarity = state.polarity === "S" ? "N" : "S";
  updateMood(getClosestPeer());
  publish();
}

function cleanupSelf() {
  active = false;
  channelOpen = false;

  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Ignore local storage cleanup failures.
  }

  try {
    if (channel) channel.close();
  } catch {
    // Ignore close failures during navigation.
  }
}

function goBack() {
  cleanupSelf();
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.assign("/");
}

function closeCurrentWindow() {
  cleanupSelf();
  window.close();

  window.setTimeout(() => {
    if (!window.closed) {
      window.location.assign("/");
    }
  }, 120);
}

function renderFace(cell) {
  if (!spriteImage) return;

  const cellKey = `${cell.col}:${cell.row}`;
  if (cellKey === currentCellKey) return;
  currentCellKey = cellKey;

  const sourceWidth = spriteImage.naturalWidth / 4;
  const sourceHeight = spriteImage.naturalHeight / 2;
  const sourceX = sourceWidth * cell.col;
  const sourceY = sourceHeight * cell.row;

  faceContext.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
  faceContext.drawImage(
    spriteImage,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    faceCanvas.width,
    faceCanvas.height,
  );

  const imageData = faceContext.getImageData(0, 0, faceCanvas.width, faceCanvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const greenDominance = green - Math.max(red, blue);
    if (green > 110 && greenDominance > 34) {
      data[index + 3] = Math.max(0, 255 - greenDominance * 5.8);
      data[index] = Math.min(255, red + 8);
      data[index + 1] = Math.max(0, green - 90);
    }
  }

  faceContext.putImageData(imageData, 0, 0);
}

function loadChromaKeyedSprite() {
  const image = new Image();
  image.onload = () => {
    spriteImage = image;
    currentCellKey = "";
    renderFace(spriteCellFor(state.relation, state.stage));
  };
  image.src = spritePath;
}

if (channel) {
  channel.addEventListener("message", (event) => receive(event.data));
}

window.addEventListener("storage", (event) => {
  if (!event.key?.startsWith(storagePrefix) || event.key === storageKey || !event.newValue) return;
  try {
    receive(JSON.parse(event.newValue));
  } catch {
    // Ignore malformed cross-window storage events.
  }
});

window.addEventListener("beforeunload", () => {
  cleanupSelf();
});

backButton.addEventListener("click", goBack);
openWindowButton.addEventListener("click", openNewWindow);
rerollButton.addEventListener("click", rerollPolarity);
closeWindowButton.addEventListener("click", closeCurrentWindow);

loadChromaKeyedSprite();
updateMood(null);
publish();
requestAnimationFrame(loop);
