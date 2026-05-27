const startButton = document.querySelector("#start-button");
const comboEl = document.querySelector("#combo");
const trustEl = document.querySelector("#trust");
const scoreEl = document.querySelector("#score");
const judgementEl = document.querySelector("#judgement");
const progressEl = document.querySelector("#progress");
const dialogueEl = document.querySelector("#dialogue");
const speakerEl = document.querySelector("#speaker");
const chapterEl = document.querySelector("#chapter");
const goldEl = document.querySelector("#gold");
const dayEl = document.querySelector("#day");
const seasonEl = document.querySelector("#season");
const clockEl = document.querySelector("#clock");
const sunEl = document.querySelector("#sun");
const cropGrid = document.querySelector("#crop-grid");
const laneEls = [...document.querySelectorAll(".lane")];
const sceneCanvas = document.querySelector("#scene-canvas");
const scene = sceneCanvas.getContext("2d");

const laneKeys = ["KeyD", "KeyF", "KeyJ", "KeyK"];
const travelMs = 1850;
const judgeY = 190;
const hitWindow = 190;

const chapters = [
  {
    title: "첫 씨앗",
    speaker: "로완",
    text: "땅은 오래 쉬었지만 아직 따뜻해요. 박자마다 씨앗을 눌러 주세요. 농장이 당신을 기억할 거예요.",
  },
  {
    title: "비 오는 장터",
    speaker: "미나",
    text: "오늘은 마을 장터가 열려요. 좋은 박자로 수확하면 잼 가게에 첫 납품을 맡길 수 있어요.",
  },
  {
    title: "광산의 종소리",
    speaker: "준",
    text: "밤마다 광산 입구에서 작은 종이 울려요. 리듬을 맞추면 잃어버린 물레방아 부품을 찾을지도 몰라요.",
  },
  {
    title: "달빛 축제",
    speaker: "마을 사람들",
    text: "농장에 등이 켜졌어요. 모두가 기다린 축제의 마지막 곡입니다. 이 곡을 끝내면 계곡 마을이 다시 살아나요.",
  },
];

const patterns = [
  [0, 430, 860, 1290, 1720, 2150, 2580, 3010, 3440, 3870, 4300, 4730],
  [0, 330, 660, 990, 1320, 1650, 1980, 2310, 2760, 3090, 3420, 3900, 4380],
  [0, 260, 520, 1040, 1300, 1560, 2080, 2340, 2600, 3120, 3380, 3640, 4160, 4680],
  [0, 220, 440, 660, 1100, 1320, 1760, 1980, 2420, 2640, 3080, 3300, 3740, 3960, 4400, 4840],
];

const state = {
  running: false,
  startedAt: 0,
  nextNoteIndex: 0,
  chapter: 0,
  combo: 0,
  bestCombo: 0,
  trust: 0,
  score: 0,
  gold: 120,
  day: 1,
  completed: false,
  notes: [],
  crops: [],
};

function buildCrops() {
  state.crops = Array.from({ length: 18 }, (_, index) => ({
    growth: index % 3 === 0 ? 1 : 0,
    ready: false,
  }));
}

function currentSongLength() {
  const pattern = patterns[state.chapter];
  return pattern[pattern.length - 1] + 2600;
}

function resetSong() {
  if (state.completed) {
    state.completed = false;
    state.chapter = 0;
    state.day = 1;
    state.trust = 0;
    state.score = 0;
    state.gold = 120;
    buildCrops();
    updateStory();
  }
  state.running = true;
  state.startedAt = performance.now();
  state.nextNoteIndex = 0;
  state.notes.forEach((note) => note.el.remove());
  state.notes = [];
  state.combo = 0;
  progressEl.style.width = "0%";
  startButton.textContent = "Playing";
  judgementEl.textContent = "D F J K 키로 수확 리듬을 맞춰요";
  updateHud();
}

function spawnNote(time) {
  const key = laneKeys[Math.floor((time / 220 + state.chapter) % 4)];
  const laneEl = document.querySelector(`[data-key="${key}"]`);
  const noteEl = document.createElement("i");
  noteEl.className = "note";
  noteEl.dataset.key = key;
  laneEl.append(noteEl);
  state.notes.push({
    key,
    dueAt: state.startedAt + time + travelMs,
    spawnedAt: performance.now(),
    el: noteEl,
    hit: false,
  });
}

function updateHud() {
  comboEl.textContent = state.combo.toString();
  trustEl.textContent = `${Math.min(100, Math.round(state.trust))}%`;
  scoreEl.textContent = state.score.toString();
  goldEl.textContent = `${state.gold}g`;
  dayEl.textContent = `${state.day}일`;
  seasonEl.textContent = ["봄", "여름", "가을", "겨울"][Math.floor((state.day - 1) / 4) % 4];
}

function updateStory() {
  const chapter = chapters[state.chapter];
  speakerEl.textContent = chapter.speaker;
  dialogueEl.textContent = chapter.text;
  chapterEl.textContent = chapter.title;
}

function growCrop(amount) {
  const crop = state.crops.find((item) => !item.ready) ?? state.crops[state.score % state.crops.length];
  crop.growth = Math.min(4, crop.growth + amount);
  crop.ready = crop.growth >= 4;
}

function px(x, y, w, h, color) {
  scene.fillStyle = color;
  scene.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawTree(x, y, variant = 0) {
  px(x + 7, y + 24, 6, 18, "#7b4a28");
  px(x + 4, y + 34, 12, 8, "#5c351f");
  px(x + 2, y + 12, 16, 18, variant ? "#356f40" : "#3f844a");
  px(x - 2, y + 20, 24, 16, variant ? "#2f6239" : "#4e9654");
  px(x + 3, y + 6, 14, 12, "#5ba65b");
  px(x + 7, y + 2, 8, 8, "#78b968");
  px(x + 0, y + 18, 5, 5, "#2c5a32");
  px(x + 16, y + 23, 5, 5, "#2c5a32");
}

function drawHouse() {
  px(36, 66, 64, 44, "#a85c3a");
  px(42, 72, 52, 32, "#d98955");
  px(31, 58, 74, 10, "#6d382d");
  px(38, 48, 60, 10, "#8f4033");
  px(47, 38, 42, 10, "#b7523f");
  px(61, 28, 16, 10, "#d66b50");
  px(76, 34, 10, 18, "#6b3f24");
  px(80, 29, 8, 5, "#4b2b1a");
  px(44, 78, 14, 13, "#ffe19a");
  px(47, 81, 8, 7, "#74a8b6");
  px(75, 80, 13, 30, "#5a321f");
  px(80, 93, 3, 3, "#e7a73b");
  px(35, 106, 68, 5, "#704025");
}

function drawPond() {
  px(238, 119, 44, 8, "#477f87");
  px(228, 127, 66, 20, "#5fa9b0");
  px(234, 147, 50, 7, "#477f87");
  px(240, 132, 19, 3, "#bde9de");
  px(266, 140, 14, 3, "#bde9de");
  px(226, 135, 5, 9, "#396a61");
  px(291, 132, 4, 12, "#396a61");
}

function drawCropTile(crop, x, y) {
  px(x, y, 14, 10, "#6f4228");
  px(x + 1, y + 1, 12, 1, "#9a5d35");
  px(x + 2, y + 8, 10, 2, "#4b2c1d");
  const h = Math.max(1, Math.round(crop.growth * 2));
  px(x + 6, y + 7 - h, 2, h + 2, "#4e9b4c");
  if (crop.growth > 1.6) {
    px(x + 3, y + 6 - h, 4, 2, "#78bf5c");
    px(x + 8, y + 5 - h, 4, 2, "#8fd368");
  }
  if (crop.ready) {
    px(x + 5, y + 2, 5, 5, "#e7a73b");
    px(x + 6, y + 3, 3, 3, "#f7d76a");
  }
}

function drawCharacter(x, y, shirt, hair, step = 0) {
  px(x + 4, y, 12, 5, hair);
  px(x + 2, y + 5, 16, 5, hair);
  px(x + 5, y + 8, 10, 10, "#f2b37f");
  px(x + 7, y + 11, 2, 2, "#3b2418");
  px(x + 13, y + 11, 2, 2, "#3b2418");
  px(x + 4, y + 18, 14, 15, shirt);
  px(x + 1, y + 20, 4, 12, "#f2b37f");
  px(x + 17, y + 20, 4, 12, "#f2b37f");
  px(x + 5, y + 33, 5, 11 + step, "#5b3a2a");
  px(x + 13, y + 33 + step, 5, 11 - step, "#5b3a2a");
  px(x + 3, y + 43 + step, 7, 3, "#392519");
  px(x + 12, y + 43, 7, 3, "#392519");
}

function drawFarmer(x, y, step) {
  px(x + 3, y - 3, 18, 4, "#d99a3b");
  px(x + 7, y - 8, 10, 6, "#f0c35d");
  drawCharacter(x, y, "#476fa8", "#7a4424", step);
}

function drawPixelScene(now = 0) {
  scene.imageSmoothingEnabled = false;
  px(0, 0, 320, 180, "#89cbd0");
  px(0, 45, 320, 35, "#bfe0b6");
  px(0, 80, 320, 100, "#79af56");
  px(0, 160, 320, 20, "#5a8f48");

  const sunX = 230 + Math.sin(now / 2400) * 6;
  px(sunX, 18, 14, 14, "#ffd45c");
  px(sunX - 2, 22, 18, 6, "#ffd45c");
  px(42, 24, 32, 8, "#fff3c9");
  px(50, 18, 16, 8, "#fff8db");
  px(190, 30, 42, 8, "#fff3c9");
  px(202, 23, 18, 8, "#fff8db");

  px(0, 70, 320, 15, "#5b9256");
  px(10, 60, 44, 18, "#6aa05d");
  px(82, 56, 50, 22, "#548b58");
  px(230, 58, 62, 24, "#6b9858");

  for (let x = -8; x < 322; x += 25) {
    drawTree(x, 55 + ((x / 25) % 2) * 5, x % 50);
  }

  for (let y = 84; y < 180; y += 12) {
    for (let x = 0; x < 320; x += 16) {
      px(x + ((y / 12) % 2) * 8, y, 2, 2, "#8cc966");
      px(x + 6, y + 5, 2, 2, "#5f9b49");
    }
  }

  drawHouse();
  px(102, 112, 10, 6, "#c88750");
  px(112, 118, 16, 8, "#c88750");
  px(128, 126, 34, 16, "#c88750");
  px(162, 142, 42, 19, "#c88750");

  let cropIndex = 0;
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      drawCropTile(state.crops[cropIndex], 118 + col * 17, 104 + row * 13);
      cropIndex += 1;
    }
  }

  drawPond();
  drawCharacter(214, 94, "#b94f4b", "#6d382d", 0);
  drawFarmer(148, 128, Math.floor(now / 300) % 2);
}

function flashLane(key) {
  laneEls.forEach((lane) => lane.classList.toggle("hit", lane.dataset.key === key));
  window.setTimeout(() => laneEls.forEach((lane) => lane.classList.remove("hit")), 90);
}

function judge(key) {
  if (!state.running) {
    resetSong();
    return;
  }

  const now = performance.now();
  const candidate = state.notes
    .filter((note) => !note.hit && note.key === key)
    .sort((a, b) => Math.abs(a.dueAt - now) - Math.abs(b.dueAt - now))[0];

  flashLane(key);

  if (!candidate || Math.abs(candidate.dueAt - now) > hitWindow) {
    state.combo = 0;
    state.trust = Math.max(0, state.trust - 2);
    judgementEl.textContent = "Miss";
    updateHud();
    return;
  }

  const offset = Math.abs(candidate.dueAt - now);
  const perfect = offset < 70;
  candidate.hit = true;
  candidate.el.classList.add("good");
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.trust = Math.min(100, state.trust + (perfect ? 4.2 : 2.5));
  state.score += perfect ? 140 : 90;
  state.gold += perfect ? 8 : 5;
  growCrop(perfect ? 1.2 : 0.75);
  judgementEl.textContent = perfect ? "Perfect Harvest" : "Good";
  window.setTimeout(() => candidate.el.remove(), 90);
  updateHud();
}

function missOldNotes(now) {
  state.notes.forEach((note) => {
    if (!note.hit && now - note.dueAt > hitWindow) {
      note.hit = true;
      note.el.classList.add("miss");
      state.combo = 0;
      state.trust = Math.max(0, state.trust - 1.4);
      judgementEl.textContent = "Miss";
      window.setTimeout(() => note.el.remove(), 160);
    }
  });
  state.notes = state.notes.filter((note) => note.el.isConnected);
}

function finishChapter() {
  state.running = false;
  state.day += 1;
  state.trust = Math.min(100, state.trust + state.bestCombo);
  state.bestCombo = 0;

  if (state.chapter === chapters.length - 1) {
    state.completed = true;
    startButton.textContent = "New Season";
    speakerEl.textContent = "계곡 마을";
    chapterEl.textContent = "새 계절";
    dialogueEl.textContent =
      "마지막 곡이 끝나자 물레방아가 다시 돌기 시작했습니다. 농장은 이제 당신의 박자를 따라 숨을 쉽니다.";
    judgementEl.textContent = "이야기 완주";
  } else {
    state.chapter += 1;
    startButton.textContent = state.chapter === chapters.length - 1 ? "Final Song" : "Next Day";
    judgementEl.textContent = "하루가 저물고 이야기가 이어집니다";
    updateStory();
  }
  updateHud();
}

function updateClock(elapsed) {
  const ratio = Math.min(1, elapsed / currentSongLength());
  const minutes = Math.floor(370 + ratio * 900);
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  clockEl.textContent = `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`;
  sunEl.style.left = `${4 + ratio * 86}%`;
  progressEl.style.width = `${ratio * 100}%`;
}

function tick(now) {
  drawPixelScene(now);

  if (state.running) {
    const elapsed = now - state.startedAt;
    const pattern = patterns[state.chapter];
    while (
      state.nextNoteIndex < pattern.length &&
      elapsed >= pattern[state.nextNoteIndex]
    ) {
      spawnNote(pattern[state.nextNoteIndex]);
      state.nextNoteIndex += 1;
    }

    state.notes.forEach((note) => {
      const y = ((now - note.spawnedAt) / travelMs) * judgeY;
      note.el.style.top = `${y}px`;
    });

    missOldNotes(now);
    updateClock(elapsed);

    if (elapsed > currentSongLength()) {
      finishChapter();
    }
  }

  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  if (laneKeys.includes(event.code)) {
    event.preventDefault();
    judge(event.code);
  }
  if (event.code === "Space") {
    event.preventDefault();
    resetSong();
  }
});

laneEls.forEach((lane) => {
  lane.addEventListener("pointerdown", () => judge(lane.dataset.key));
});

startButton.addEventListener("click", resetSong);

buildCrops();
updateStory();
updateHud();
updateClock(0);
requestAnimationFrame(tick);
