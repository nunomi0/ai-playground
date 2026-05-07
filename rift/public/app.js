const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const shieldEl = document.querySelector("#shield");
const pauseButton = document.querySelector("#pause-button");
const touchButtons = document.querySelectorAll("[data-dir]");

const keys = new Set();
const pointer = { active: false, x: 0, y: 0 };
const bestKey = "rift-runner-best";
const audio = {
  context: null,
  master: null,
  enabled: false,
};

const state = {
  running: false,
  gameOver: false,
  score: 0,
  best: Number(localStorage.getItem(bestKey) ?? 0),
  shield: 100,
  elapsed: 0,
  lastTime: 0,
  spawnSpark: 0,
  spawnHazard: 0,
  shake: 0,
  player: { x: 640, y: 360, vx: 0, vy: 0, radius: 17 },
  sparks: [],
  hazards: [],
  stars: [],
};

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  seedStars();
}

function seedStars() {
  const count = Math.max(90, Math.floor((window.innerWidth * window.innerHeight) / 8500));
  state.stars = Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: 0.7 + Math.random() * 2.2,
    drift: 8 + Math.random() * 26,
    phase: Math.random() * Math.PI * 2,
  }));
}

function reset() {
  ensureAudio();
  playStartSound();
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.shield = 100;
  state.elapsed = 0;
  state.spawnSpark = 0;
  state.spawnHazard = 0;
  state.shake = 0;
  state.player = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.55,
    vx: 0,
    vy: 0,
    radius: 17,
  };
  state.sparks = [];
  state.hazards = [];
  pauseButton.textContent = "Pause";
  updateHud();
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score).toString();
  bestEl.textContent = Math.floor(state.best).toString();
  shieldEl.textContent = `${Math.max(0, Math.ceil(state.shield))}%`;
}

function spawnSpark() {
  state.sparks.push({
    x: 28 + Math.random() * (window.innerWidth - 56),
    y: 90 + Math.random() * (window.innerHeight - 128),
    radius: 8 + Math.random() * 7,
    pulse: Math.random() * Math.PI * 2,
    value: 35,
  });
}

function spawnHazard() {
  const side = Math.floor(Math.random() * 4);
  const speed = 170 + Math.random() * 165 + state.elapsed * 8;
  const hazard = {
    x: side === 1 ? window.innerWidth + 36 : side === 3 ? -36 : Math.random() * window.innerWidth,
    y: side === 2 ? window.innerHeight + 36 : side === 0 ? -36 : Math.random() * window.innerHeight,
    vx: 0,
    vy: 0,
    radius: 18 + Math.random() * 24,
    spin: Math.random() * Math.PI * 2,
  };
  const angle = Math.atan2(state.player.y - hazard.y, state.player.x - hazard.x);
  hazard.vx = Math.cos(angle) * speed;
  hazard.vy = Math.sin(angle) * speed;
  state.hazards.push(hazard);
}

function controlVector() {
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;

  if (pointer.active) {
    dx += (pointer.x - state.player.x) / 72;
    dy += (pointer.y - state.player.y) / 72;
  }

  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length, active: Math.abs(dx) + Math.abs(dy) > 0.05 };
}

function update(dt) {
  if (!state.running || state.gameOver) return;

  state.elapsed += dt;
  state.score += dt * (14 + state.elapsed * 0.55);
  state.spawnSpark -= dt;
  state.spawnHazard -= dt;
  state.shake = Math.max(0, state.shake - dt * 18);

  if (state.spawnSpark <= 0) {
    spawnSpark();
    state.spawnSpark = Math.max(0.28, 0.72 - state.elapsed * 0.018);
  }

  if (state.spawnHazard <= 0) {
    spawnHazard();
    state.spawnHazard = Math.max(0.18, 0.82 - state.elapsed * 0.022);
  }

  const input = controlVector();
  const acceleration = input.active ? 1280 : 0;
  state.player.vx += input.x * acceleration * dt;
  state.player.vy += input.y * acceleration * dt;
  const topSpeed = 640;
  const speed = Math.hypot(state.player.vx, state.player.vy);
  if (speed > topSpeed) {
    state.player.vx = (state.player.vx / speed) * topSpeed;
    state.player.vy = (state.player.vy / speed) * topSpeed;
  }
  state.player.vx *= input.active ? 0.94 : 0.84;
  state.player.vy *= input.active ? 0.94 : 0.84;
  state.player.x += state.player.vx * dt;
  state.player.y += state.player.vy * dt;
  state.player.x = Math.max(22, Math.min(window.innerWidth - 22, state.player.x));
  state.player.y = Math.max(78, Math.min(window.innerHeight - 24, state.player.y));

  for (const star of state.stars) {
    star.y += star.drift * dt;
    if (star.y > window.innerHeight + 6) {
      star.y = -6;
      star.x = Math.random() * window.innerWidth;
    }
  }

  for (const hazard of state.hazards) {
    hazard.x += hazard.vx * dt;
    hazard.y += hazard.vy * dt;
    hazard.spin += dt * 2;
  }

  state.hazards = state.hazards.filter(
    (hazard) =>
      hazard.x > -90 &&
      hazard.x < window.innerWidth + 90 &&
      hazard.y > -90 &&
      hazard.y < window.innerHeight + 90,
  );

  state.sparks = state.sparks.filter((spark) => {
    spark.pulse += dt * 5;
    const hit = Math.hypot(spark.x - state.player.x, spark.y - state.player.y) < spark.radius + 18;
    if (hit) {
      state.score += spark.value;
      state.shield = Math.min(100, state.shield + 5);
      playCollectSound();
    }
    return !hit;
  });

  for (const hazard of state.hazards) {
    const hitDistance = hazard.radius + state.player.radius;
    if (Math.hypot(hazard.x - state.player.x, hazard.y - state.player.y) < hitDistance) {
      state.shield -= 26;
      state.shake = 1;
      hazard.x = -999;
      playHitSound();
      if (state.shield <= 0) endGame();
    }
  }

  updateHud();
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem(bestKey, state.best.toString());
  pauseButton.textContent = "Restart";
  playGameOverSound();
  updateHud();
}

function ensureAudio() {
  if (!audio.context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audio.context = new AudioContext();
    audio.master = audio.context.createGain();
    audio.master.gain.value = 0.22;
    audio.master.connect(audio.context.destination);
  }

  if (audio.context.state === "suspended") {
    audio.context.resume();
  }
  audio.enabled = true;
}

function playTone({ frequency, duration, type = "sine", gain = 0.18, slideTo = null }) {
  if (!audio.enabled || !audio.context || !audio.master) return;

  const now = audio.context.currentTime;
  const oscillator = audio.context.createOscillator();
  const envelope = audio.context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  }

  envelope.gain.setValueAtTime(0.001, now);
  envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(envelope);
  envelope.connect(audio.master);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.025);
}

function playStartSound() {
  playTone({ frequency: 260, slideTo: 520, duration: 0.16, type: "triangle", gain: 0.12 });
  window.setTimeout(() => playTone({ frequency: 660, duration: 0.09, type: "sine", gain: 0.1 }), 90);
}

function playCollectSound() {
  playTone({ frequency: 720, slideTo: 1180, duration: 0.1, type: "sine", gain: 0.13 });
  window.setTimeout(() => playTone({ frequency: 1480, duration: 0.06, type: "triangle", gain: 0.08 }), 45);
}

function playHitSound() {
  playTone({ frequency: 150, slideTo: 70, duration: 0.18, type: "sawtooth", gain: 0.16 });
  playTone({ frequency: 62, duration: 0.12, type: "square", gain: 0.08 });
}

function playGameOverSound() {
  playTone({ frequency: 260, slideTo: 92, duration: 0.42, type: "sawtooth", gain: 0.13 });
}

function drawBackground(width, height) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#071116");
  gradient.addColorStop(0.48, "#0f242d");
  gradient.addColorStop(1, "#090b10");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const star of state.stars) {
    const twinkle = 0.45 + Math.sin(state.elapsed * 2 + star.phase) * 0.25;
    ctx.fillStyle = `rgba(226, 255, 235, ${twinkle})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(116, 243, 176, 0.12)";
  ctx.lineWidth = 1;
  for (let x = -80; x < width + 80; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x + (state.elapsed * 42) % 80, 0);
    ctx.lineTo(x - 220 + (state.elapsed * 42) % 80, height);
    ctx.stroke();
  }
}

function drawSpark(spark) {
  const glow = spark.radius + Math.sin(spark.pulse) * 3;
  ctx.save();
  ctx.translate(spark.x, spark.y);
  ctx.rotate(spark.pulse * 0.35);
  ctx.shadowColor = "#74f3b0";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#74f3b0";
  ctx.beginPath();
  ctx.moveTo(0, -glow);
  ctx.lineTo(glow * 0.72, 0);
  ctx.lineTo(0, glow);
  ctx.lineTo(-glow * 0.72, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff8b8";
  ctx.beginPath();
  ctx.arc(0, 0, spark.radius * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHazard(hazard) {
  ctx.save();
  ctx.translate(hazard.x, hazard.y);
  ctx.rotate(hazard.spin);
  ctx.shadowColor = "#ff775f";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#2a1514";
  ctx.strokeStyle = "#ff775f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 9; i += 1) {
    const angle = (Math.PI * 2 * i) / 9;
    const radius = hazard.radius * (i % 2 ? 0.64 : 1);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  const { player } = state;
  const angle = Math.atan2(player.vy, player.vx || 1);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);
  ctx.shadowColor = "#74f3b0";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#eef8f2";
  ctx.strokeStyle = "#74f3b0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(-16, -15);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-16, 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f3cf63";
  ctx.beginPath();
  ctx.arc(2, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = `rgba(116, 243, 176, ${0.2 + state.shield / 180})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 26 + Math.sin(state.elapsed * 8) * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawOverlay(width, height) {
  if (state.running && !state.gameOver) return;
  ctx.save();
  ctx.fillStyle = "rgba(5, 9, 12, 0.52)";
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#eef8f2";
  ctx.font = "900 46px Inter, system-ui, sans-serif";
  ctx.fillText(state.gameOver ? "Rift Collapsed" : "Rift Runner", width / 2, height / 2 - 28);
  ctx.font = "700 17px Inter, system-ui, sans-serif";
  ctx.fillStyle = "rgba(238, 248, 242, 0.76)";
  ctx.fillText("Collect green shards. Dodge red rifts. Move with WASD, arrows, or touch.", width / 2, height / 2 + 18);
  ctx.restore();
}

function render() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake * 10, (Math.random() - 0.5) * state.shake * 10);
  }
  drawBackground(width, height);
  state.sparks.forEach(drawSpark);
  state.hazards.forEach(drawHazard);
  drawPlayer();
  ctx.restore();
  drawOverlay(width, height);
}

function tick(time) {
  const dt = Math.min(0.033, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(tick);
}

function togglePause() {
  ensureAudio();
  if (state.gameOver || (!state.running && state.score === 0)) {
    reset();
    return;
  }
  state.running = !state.running;
  pauseButton.textContent = state.running ? "Pause" : "Resume";
  if (state.running) playStartSound();
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
    return;
  }
  ensureAudio();
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => keys.delete(event.code));

canvas.addEventListener("pointerdown", (event) => {
  ensureAudio();
  pointer.active = true;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});
canvas.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});
canvas.addEventListener("pointerup", () => {
  pointer.active = false;
});
canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

touchButtons.forEach((button) => {
  const codeByDirection = {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
  };
  const code = codeByDirection[button.dataset.dir];
  button.addEventListener("pointerdown", () => {
    ensureAudio();
    keys.add(code);
  });
  button.addEventListener("pointerup", () => keys.delete(code));
  button.addEventListener("pointercancel", () => keys.delete(code));
  button.addEventListener("pointerleave", () => keys.delete(code));
});

pauseButton.addEventListener("click", togglePause);

resize();
updateHud();
requestAnimationFrame(tick);
