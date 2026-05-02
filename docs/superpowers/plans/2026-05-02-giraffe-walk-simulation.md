# Giraffe Walk Simulation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `/giraffe` web app with a seven-line giraffe that walks in place, follows the cursor with neck-led motion, reacts to clicks with short bend impulses, and appears as a new landing card in the root app.

**Architecture:** Keep the simulation state pure in `giraffe/src/simulation.js` and let `giraffe/public/app.js` own canvas setup, pointer input, animation timing, and browser hooks. Extend the existing folder-level route/build system so `giraffe` behaves like the other sibling apps.

**Tech Stack:** Vanilla HTML/CSS/JS, canvas 2D, Node built-in test runner, existing root Node server and Vercel static build script

---

## Chunk 1: Simulation Core

### Task 1: Add failing simulation tests

**Files:**
- Create: `giraffe/tests/simulation.test.js`
- Test: `giraffe/tests/simulation.test.js`

- [ ] **Step 1: Write the failing test**

Cover:
- initial seven-segment pose creation
- neck-led cursor steering
- body lag behind target angle
- click impulse decay
- gait phase disturbance after an impulse

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test giraffe/tests/simulation.test.js`
Expected: module missing or exported API missing

- [ ] **Step 3: Write minimal implementation**

Create `giraffe/src/simulation.js` with:
- state factory
- pointer target update
- impulse application
- time stepping
- segment pose projection for rendering and hit testing

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test giraffe/tests/simulation.test.js`
Expected: PASS

## Chunk 2: Browser App

### Task 2: Build the canvas app shell

**Files:**
- Create: `giraffe/public/index.html`
- Create: `giraffe/public/styles.css`
- Create: `giraffe/public/app.js`
- Modify: `giraffe/src/simulation.js`

- [ ] **Step 1: Write a failing expectation through test or browser contract**

Define the browser contract:
- one full-screen canvas
- faded off-white background
- `window.render_game_to_text`
- `window.advanceTime(ms)`

- [ ] **Step 2: Implement the app shell**

Add:
- minimal page chrome
- responsive canvas sizing
- animation loop
- pointer move and click handling
- deterministic stepping hooks for automated checks

- [ ] **Step 3: Run targeted checks**

Run:
- `node --check giraffe/public/app.js`
- `node --check giraffe/src/simulation.js`

Expected: no syntax errors

## Chunk 3: Landing And Routing

### Task 3: Wire the new app into the workspace

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `server.js`
- Modify: `scripts/build-vercel-output.js`
- Modify: `README.md`

- [ ] **Step 1: Add landing card**

Describe the giraffe simulation in the existing card grid and give it a distinct faded monochrome treatment.

- [ ] **Step 2: Add route/build integration**

Mirror the existing sibling-app route handling for `/giraffe`.

- [ ] **Step 3: Verify the build wiring**

Run: `npm run vercel-build`
Expected: `.vercel/output/static/giraffe` exists and config routes `/giraffe`

## Chunk 4: Final Verification

### Task 4: Run full checks

**Files:**
- Verify all files above

- [ ] **Step 1: Run tests**

Run: `node --test giraffe/tests/simulation.test.js`

- [ ] **Step 2: Run syntax checks**

Run:
- `node --check giraffe/public/app.js`
- `node --check giraffe/src/simulation.js`
- `node --check server.js`
- `node --check scripts/build-vercel-output.js`

- [ ] **Step 3: Run build**

Run: `npm run vercel-build`

- [ ] **Step 4: Run local app**

Run: `npm run dev`
Then verify:
- `/` shows the new card
- `/giraffe` loads
- mouse motion changes facing
- click impulses visibly react
