import { blendMetric, clamp, classifyPace, scoreCityPulse, trendLabel } from "./engine.js";

const cities = [
  {
    name: "Seoul",
    region: "KR",
    x: 0.79,
    y: 0.38,
    lat: 37.5665,
    lon: 126.978,
    color: "#ff4f64",
    phase: 0.3,
    tempo: 1.22,
    metrics: { traffic: 76, weather: 38, news: 62, social: 84, crowd: 74 },
  },
  {
    name: "Tokyo",
    region: "JP",
    x: 0.83,
    y: 0.43,
    lat: 35.6762,
    lon: 139.6503,
    color: "#f4b740",
    phase: 1.4,
    tempo: 1.38,
    metrics: { traffic: 88, weather: 46, news: 70, social: 79, crowd: 82 },
  },
  {
    name: "Mumbai",
    region: "IN",
    x: 0.68,
    y: 0.53,
    lat: 19.076,
    lon: 72.8777,
    color: "#2bbf8a",
    phase: 2.2,
    tempo: 1.05,
    metrics: { traffic: 84, weather: 61, news: 55, social: 72, crowd: 88 },
  },
  {
    name: "Berlin",
    region: "DE",
    x: 0.5,
    y: 0.31,
    lat: 52.52,
    lon: 13.405,
    color: "#3d8bfd",
    phase: 3.1,
    tempo: 0.86,
    metrics: { traffic: 52, weather: 42, news: 48, social: 58, crowd: 48 },
  },
  {
    name: "Lagos",
    region: "NG",
    x: 0.5,
    y: 0.57,
    lat: 6.5244,
    lon: 3.3792,
    color: "#e65f2b",
    phase: 4.0,
    tempo: 1.18,
    metrics: { traffic: 81, weather: 66, news: 52, social: 63, crowd: 76 },
  },
  {
    name: "Sao Paulo",
    region: "BR",
    x: 0.36,
    y: 0.72,
    lat: -23.5558,
    lon: -46.6396,
    color: "#6e63d9",
    phase: 4.8,
    tempo: 0.94,
    metrics: { traffic: 74, weather: 54, news: 58, social: 69, crowd: 70 },
  },
  {
    name: "New York",
    region: "US",
    x: 0.28,
    y: 0.35,
    lat: 40.7128,
    lon: -74.006,
    color: "#0aa6a6",
    phase: 5.7,
    tempo: 1.31,
    metrics: { traffic: 72, weather: 49, news: 82, social: 81, crowd: 78 },
  },
  {
    name: "Mexico City",
    region: "MX",
    x: 0.22,
    y: 0.5,
    lat: 19.4326,
    lon: -99.1332,
    color: "#d95d93",
    phase: 6.3,
    tempo: 1.02,
    metrics: { traffic: 79, weather: 47, news: 48, social: 66, crowd: 75 },
  },
  {
    name: "Sydney",
    region: "AU",
    x: 0.84,
    y: 0.76,
    lat: -33.8688,
    lon: 151.2093,
    color: "#39a96b",
    phase: 7.1,
    tempo: 0.82,
    metrics: { traffic: 43, weather: 39, news: 44, social: 55, crowd: 42 },
  },
  {
    name: "Cairo",
    region: "EG",
    x: 0.55,
    y: 0.46,
    lat: 30.0444,
    lon: 31.2357,
    color: "#c28d2c",
    phase: 8.2,
    tempo: 1.08,
    metrics: { traffic: 71, weather: 59, news: 57, social: 61, crowd: 68 },
  },
];

const landShapes = [
  [
    [0.09, 0.27],
    [0.18, 0.21],
    [0.29, 0.25],
    [0.32, 0.37],
    [0.25, 0.43],
    [0.2, 0.55],
    [0.25, 0.68],
    [0.18, 0.77],
    [0.12, 0.62],
    [0.07, 0.48],
  ],
  [
    [0.43, 0.2],
    [0.58, 0.21],
    [0.64, 0.34],
    [0.6, 0.47],
    [0.55, 0.63],
    [0.48, 0.74],
    [0.43, 0.58],
    [0.39, 0.43],
  ],
  [
    [0.58, 0.25],
    [0.73, 0.22],
    [0.88, 0.34],
    [0.86, 0.5],
    [0.74, 0.58],
    [0.65, 0.51],
    [0.6, 0.41],
  ],
  [
    [0.73, 0.68],
    [0.84, 0.65],
    [0.91, 0.73],
    [0.86, 0.84],
    [0.75, 0.82],
  ],
];

const signalNames = ["traffic", "weather", "news", "social", "crowd"];
const feedWords = [
  "station surge",
  "rain front",
  "market open",
  "late train",
  "venue spill",
  "headline burst",
  "heat lift",
  "airport wave",
  "river fog",
  "night market",
];

const canvas = document.getElementById("pulseMap");
const ctx = canvas.getContext("2d");
const cityList = document.getElementById("cityList");
const metricList = document.getElementById("metricList");
const cityOptions = document.getElementById("cityOptions");
const signalFeed = document.getElementById("signalFeed");
const signalForm = document.getElementById("signalForm");
const cityRows = new Map();
const metricRows = new Map();
const feedSlots = [];

const ui = {
  paceStatus: document.getElementById("paceStatus"),
  densityStatus: document.getElementById("densityStatus"),
  globalPulse: document.getElementById("globalPulse"),
  selectedTitle: document.getElementById("selectedCityTitle"),
  selectedTrend: document.getElementById("selectedTrend"),
  selectedScore: document.getElementById("selectedScore"),
  fastestCity: document.getElementById("fastestCity"),
  fastestScore: document.getElementById("fastestScore"),
  cityCount: document.getElementById("cityCount"),
  weatherSource: document.getElementById("weatherSource"),
  paceNeedle: document.getElementById("paceNeedle"),
  responseSpeed: document.getElementById("responseSpeed"),
  layoutMode: document.getElementById("layoutMode"),
  intentLevel: document.getElementById("intentLevel"),
  rushTransit: document.getElementById("rushTransit"),
  rushWeather: document.getElementById("rushWeather"),
  rushAttention: document.getElementById("rushAttention"),
  lastInjected: document.getElementById("lastInjected"),
};

const rangeIds = ["traffic", "weather", "news", "social"];
const ranges = Object.fromEntries(
  rangeIds.map((name) => [
    name,
    {
      input: document.getElementById(`${name}Input`),
      output: document.getElementById(`${name}Out`),
    },
  ]),
);

const state = {
  selected: cities[0],
  events: [],
  activity: 0,
  pace: classifyPace(0),
  lastPointer: null,
  lastFrame: performance.now(),
  lastUi: 0,
  feedAt: 0,
  feedItems: [],
  weatherStatus: "Local",
};

function formatScore(value) {
  return String(Math.round(value ?? 0)).padStart(2, "0");
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(bounds.width * dpr));
  const height = Math.max(1, Math.floor(bounds.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return { width: bounds.width, height: bounds.height };
}

function eventBoostFor(city, now) {
  let total = 0;
  state.events = state.events.filter((event) => event.expires > now);

  for (const event of state.events) {
    if (event.city === city.name) {
      const life = clamp((event.expires - now) / event.duration, 0, 1);
      total += event.boost * life;
    }
  }

  return total;
}

function updateCitySignals(now) {
  const seconds = now / 1000;

  for (const city of cities) {
    const eventBoost = eventBoostFor(city, now);
    const cityTempo = city.tempo + scoreCityPulse(city.metrics) / 220;
    const activityBoost = city === state.selected ? Math.min(12, state.activity / 240) : 0;
    const waveA = Math.sin(seconds * cityTempo + city.phase) * 6;
    const waveB = Math.cos(seconds * (cityTempo * 0.57) + city.phase * 1.7) * 4;

    city.current = {
      traffic: blendMetric(city.metrics.traffic, waveA, eventBoost * 0.35 + activityBoost),
      weather: blendMetric(city.metrics.weather, waveB, eventBoost * 0.22),
      news: blendMetric(city.metrics.news, -waveB, eventBoost * 0.4),
      social: blendMetric(city.metrics.social, waveA * 0.5, eventBoost * 0.52),
      crowd: blendMetric(city.metrics.crowd, waveB * 0.7, eventBoost * 0.26),
    };
    city.score = scoreCityPulse(city.current, eventBoost * 0.18);
  }
}

function drawLand(width, height) {
  ctx.save();
  ctx.fillStyle = "#dfe6dc";
  ctx.strokeStyle = "rgba(37, 55, 47, 0.18)";
  ctx.lineWidth = 1;

  for (const shape of landShapes) {
    ctx.beginPath();
    shape.forEach(([x, y], index) => {
      const px = x * width;
      const py = y * height;
      if (index === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawGrid(width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(37, 55, 47, 0.08)";
  ctx.lineWidth = 1;

  for (let i = 1; i < 8; i += 1) {
    const x = (width / 8) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let i = 1; i < 5; i += 1) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawRoute(from, to, width, height, now) {
  const sx = from.x * width;
  const sy = from.y * height;
  const tx = to.x * width;
  const ty = to.y * height;
  const lift = Math.min(110, Math.abs(tx - sx) * 0.18 + 52);
  const cx = (sx + tx) / 2;
  const cy = (sy + ty) / 2 - lift;

  ctx.save();
  ctx.strokeStyle = `rgba(37, 55, 47, ${0.1 + to.score / 460})`;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([7, 9]);
  ctx.lineDashOffset = -(now / 80);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cx, cy, tx, ty);
  ctx.stroke();
  ctx.restore();
}

function drawCity(city, width, height, now) {
  const x = city.x * width;
  const y = city.y * height;
  const score = city.score ?? 0;
  const selected = city === state.selected;
  const pulse = (Math.sin(now / (320 - Math.min(score, 90) * 1.8) + city.phase) + 1) / 2;
  const radius = 8 + score * 0.22 + pulse * 15;

  ctx.save();
  ctx.strokeStyle = city.color;
  ctx.fillStyle = city.color;
  ctx.globalAlpha = 0.12 + score / 240;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.22 + score / 190;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(5, radius * 0.43), 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.fillStyle = selected ? "#111815" : "#23342d";
  ctx.beginPath();
  ctx.arc(x, y, selected ? 5.5 : 4.2, 0, Math.PI * 2);
  ctx.fill();

  if (selected || score >= 72) {
    ctx.font = selected ? "700 13px Arial" : "600 12px Arial";
    ctx.fillStyle = "#17201b";
    ctx.fillText(city.name, x + 10, y - 10);
  }

  ctx.restore();
}

function drawMap(now) {
  const { width, height } = resizeCanvas();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f5f7f1";
  ctx.fillRect(0, 0, width, height);
  drawGrid(width, height);
  drawLand(width, height);

  const hotCities = [...cities].sort((a, b) => b.score - a.score).slice(0, 4);
  for (const city of hotCities) {
    if (city !== state.selected) {
      drawRoute(state.selected, city, width, height, now);
    }
  }

  for (const city of cities) {
    drawCity(city, width, height, now);
  }
}

function createCityRow(city) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "city-row";

  const label = document.createElement("span");
  const name = document.createElement("strong");
  const region = document.createElement("small");
  const bar = document.createElement("i");
  const score = document.createElement("b");

  bar.setAttribute("aria-hidden", "true");
  label.append(name, region);
  button.append(label, bar, score);
  button.addEventListener("click", () => selectCity(city));
  cityList.append(button);

  const row = { button, name, region, score };
  cityRows.set(city.name, row);
  return row;
}

function syncCityOptions() {
  const knownOptions = new Set(
    Array.from(cityOptions.options, (option) => option.value.toLowerCase()),
  );

  for (const city of cities) {
    if (!knownOptions.has(city.name.toLowerCase())) {
      const option = document.createElement("option");
      option.value = city.name;
      cityOptions.append(option);
      knownOptions.add(city.name.toLowerCase());
    }
  }
}

function renderCities() {
  for (const city of cities) {
    const row = cityRows.get(city.name) ?? createCityRow(city);

    row.name.textContent = city.name;
    row.region.textContent = city.region;
    row.score.textContent = formatScore(city.score);
    row.button.classList.toggle("active", city === state.selected);
    row.button.style.setProperty("--score", `${Math.round(city.score ?? 0)}%`);
  }

  syncCityOptions();
  ui.cityCount.value = cities.length;
}

function createMetricRow(name) {
  const row = document.createElement("div");
  row.className = "metric-row";

  const label = document.createElement("span");
  const bar = document.createElement("i");
  const value = document.createElement("strong");

  label.textContent = name;
  bar.setAttribute("aria-hidden", "true");
  row.append(label, bar, value);
  metricList.append(row);

  const refs = { row, value };
  metricRows.set(name, refs);
  return refs;
}

function renderMetrics() {
  const city = state.selected;
  const metrics = city.current ?? city.metrics;

  for (const name of signalNames) {
    const refs = metricRows.get(name) ?? createMetricRow(name);
    const value = Math.round(metrics[name] ?? 0);
    refs.row.style.setProperty("--value", `${value}%`);
    refs.value.textContent = formatScore(value);
  }
}

function createFeedSlots() {
  if (feedSlots.length > 0) {
    return;
  }

  for (let index = 0; index < 4; index += 1) {
    const item = document.createElement("li");
    const city = document.createElement("span");
    const signal = document.createElement("strong");
    const score = document.createElement("em");

    item.append(city, signal, score);
    feedSlots.push({ item, city, signal, score });
    signalFeed.append(item);
  }
}

function updateFeedSlots() {
  createFeedSlots();

  feedSlots.forEach((slot, index) => {
    const item = state.feedItems[index];
    slot.item.classList.toggle("empty", !item);
    slot.city.textContent = item?.city ?? "";
    slot.signal.textContent = item?.word ?? "";
    slot.score.textContent = item ? String(item.score) : "";
  });
}

function pushFeedItem(city, word) {
  state.feedItems.unshift({
    city: city.name,
    word,
    score: city.score,
  });

  state.feedItems = state.feedItems.slice(0, feedSlots.length || 4);
  updateFeedSlots();
}

function renderFeed(now) {
  if (now < state.feedAt) {
    return;
  }

  const city = [...cities].sort((a, b) => b.score - a.score)[0];
  const word = feedWords[Math.floor((now / 997 + city.phase) % feedWords.length)];
  pushFeedItem(city, word);

  state.feedAt = now + 2800 + Math.random() * 1800;
}

function renderStatus() {
  const selected = state.selected;
  const selectedMetrics = selected.current ?? selected.metrics;
  const sorted = [...cities].sort((a, b) => b.score - a.score);
  const global = Math.round(cities.reduce((sum, city) => sum + city.score, 0) / cities.length);
  const pace = state.pace;

  ui.paceStatus.value = pace.label;
  ui.densityStatus.value = pace.density;
  ui.globalPulse.value = formatScore(global);
  ui.selectedTitle.textContent = selected.name;
  ui.selectedTrend.textContent = trendLabel(selected.score);
  ui.selectedScore.textContent = formatScore(selected.score);
  ui.fastestCity.textContent = sorted[0].name;
  ui.fastestScore.textContent = formatScore(sorted[0].score);
  ui.weatherSource.value = state.weatherStatus;

  ui.responseSpeed.textContent = String(Math.round(state.activity));
  ui.layoutMode.textContent = pace.density;
  ui.intentLevel.textContent = pace.key === "sprint" ? "High" : pace.key === "flow" ? "Live" : "Low";
  ui.paceNeedle.style.setProperty("--pace", `${Math.min(100, state.activity / 22)}%`);
  ui.rushTransit.textContent = formatScore(selectedMetrics.traffic);
  ui.rushWeather.textContent = formatScore(selectedMetrics.weather);
  ui.rushAttention.textContent = String(
    Math.round((selectedMetrics.news + selectedMetrics.social) / 2),
  ).padStart(2, "0");
}

function renderUi(now) {
  if (now - state.lastUi < 160) {
    return;
  }

  renderCities();
  renderMetrics();
  renderStatus();
  state.lastUi = now;
}

function selectCity(city) {
  state.selected = city;
  document.getElementById("cityInput").value = city.name;
  syncWeather(city);
  renderCities();
  renderMetrics();
}

function addActivity(speed) {
  state.activity = Math.max(state.activity, clamp(speed, 0, 3200));
}

function handlePointerMove(event) {
  const now = performance.now();
  const point = { x: event.clientX, y: event.clientY, now };

  if (state.lastPointer) {
    const dx = point.x - state.lastPointer.x;
    const dy = point.y - state.lastPointer.y;
    const dt = Math.max(16, point.now - state.lastPointer.now);
    addActivity((Math.hypot(dx, dy) / dt) * 1000);
  }

  state.lastPointer = point;
}

function handleWheel(event) {
  addActivity(Math.abs(event.deltaY) * 9);
}

function handleKey() {
  addActivity(900);
}

function updateActivity(now) {
  const dt = now - state.lastFrame;
  const decay = Math.pow(0.84, dt / 120);
  state.activity *= decay;
  state.pace = classifyPace(state.activity);
  state.lastFrame = now;
}

function injectSignal(city, values, label = "Manual") {
  const traffic = clamp(values.traffic);
  const weather = clamp(values.weather);
  const news = clamp(values.news);
  const social = clamp(values.social);

  city.metrics = {
    traffic: city.metrics.traffic * 0.56 + traffic * 0.44,
    weather: city.metrics.weather * 0.56 + weather * 0.44,
    news: city.metrics.news * 0.56 + news * 0.44,
    social: city.metrics.social * 0.56 + social * 0.44,
    crowd: city.metrics.crowd * 0.72 + ((traffic + social) / 2) * 0.28,
  };

  const boost = (traffic + weather + news + social) / 18;
  state.events.push({
    city: city.name,
    boost,
    duration: 22000,
    expires: performance.now() + 22000,
  });

  state.selected = city;
  ui.lastInjected.value = `${label}: ${city.name}`;
  addActivity(780);
}

function findOrCreateCity(name) {
  const normalized = name.trim().replace(/\s+/g, " ");
  const existing = cities.find((city) => city.name.toLowerCase() === normalized.toLowerCase());

  if (existing) {
    return existing;
  }

  const seed = [...normalized].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const city = {
    name: normalized || "Custom City",
    region: "USER",
    x: 0.13 + ((seed * 37) % 74) / 100,
    y: 0.22 + ((seed * 53) % 58) / 100,
    lat: null,
    lon: null,
    color: ["#ff4f64", "#3d8bfd", "#2bbf8a", "#f4b740", "#6e63d9"][seed % 5],
    phase: (seed % 60) / 10,
    tempo: 0.9 + (seed % 55) / 100,
    metrics: { traffic: 50, weather: 50, news: 50, social: 50, crowd: 50 },
  };

  cities.push(city);
  return city;
}

async function syncWeather(city) {
  if (!city.lat || !city.lon || city.weatherSynced) {
    return;
  }

  city.weatherSynced = true;
  state.weatherStatus = "Sync";

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", city.lat);
    url.searchParams.set("longitude", city.lon);
    url.searchParams.set("current", "temperature_2m,wind_speed_10m,precipitation");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather ${response.status}`);
    }
    const payload = await response.json();
    const current = payload.current ?? {};
    const weather = clamp(
      Math.abs(Number(current.temperature_2m ?? 18) - 18) * 2.4 +
        Number(current.wind_speed_10m ?? 0) * 1.5 +
        Number(current.precipitation ?? 0) * 18,
    );
    city.metrics.weather = city.metrics.weather * 0.58 + weather * 0.42;
    state.weatherStatus = "Open-Meteo";
  } catch {
    city.weatherSynced = false;
    state.weatherStatus = "Local";
  }
}

function handleSignalSubmit(event) {
  event.preventDefault();
  const city = findOrCreateCity(document.getElementById("cityInput").value);
  injectSignal(city, {
    traffic: Number(ranges.traffic.input.value),
    weather: Number(ranges.weather.input.value),
    news: Number(ranges.news.input.value),
    social: Number(ranges.social.input.value),
  });
  selectCity(city);
}

function handleRangeInput(event) {
  const name = event.target.name;
  if (ranges[name]) {
    ranges[name].output.value = event.target.value;
  }
}

function rotateHotspot() {
  const sorted = [...cities].sort((a, b) => b.score - a.score);
  const index = sorted.indexOf(state.selected);
  selectCity(sorted[(index + 1) % sorted.length]);
  addActivity(620);
}

function frame(now) {
  updateActivity(now);
  updateCitySignals(now);
  drawMap(now);
  renderFeed(now);
  renderUi(now);
  requestAnimationFrame(frame);
}

window.addEventListener("pointermove", handlePointerMove, { passive: true });
window.addEventListener("wheel", handleWheel, { passive: true });
window.addEventListener("keydown", handleKey);
window.addEventListener("resize", () => drawMap(performance.now()));
signalForm.addEventListener("submit", handleSignalSubmit);
signalForm.addEventListener("input", handleRangeInput);

document.getElementById("focusButton").addEventListener("click", () => {
  injectSignal(state.selected, state.selected.current ?? state.selected.metrics, "Focus");
});
document.getElementById("rotateButton").addEventListener("click", rotateHotspot);

for (const [name, range] of Object.entries(ranges)) {
  range.output.value = range.input.value;
  range.input.addEventListener("input", handleRangeInput);
}

createFeedSlots();
selectCity(state.selected);
requestAnimationFrame(frame);
