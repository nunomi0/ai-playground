# Giraffe Walk Simulation Design

## Summary

Add a new folder-level web app at `/giraffe` that shows a hand-drawn giraffe made from seven black straight lines on a faded off-white full-canvas stage. The giraffe stays near the center and walks in place forever. Mouse position affects where the giraffe looks: the neck and head lead, and the body follows with a delayed sway. Clicking a leg, the body, or the neck applies a short bend impulse that briefly disturbs the walking rhythm.

## Motion Design

- The giraffe silhouette is always composed of exactly seven black straight lines:
  - four legs
  - one body
  - one neck
  - one head
- The giraffe remains centered and does not travel across the canvas.
- Walking is an endless loop with phase-shifted leg swings and a subtle body bounce.
- Mouse movement changes facing through a two-stage response:
  - neck and head rotate toward the cursor first
  - body follows with a slower spring response
- Click interaction uses a short impulse model:
  - clicking the body, neck, or any leg adds a temporary bend offset
  - the offset decays over roughly 0.3 to 0.5 seconds
  - the impulse also adds a slight, short-lived disturbance to the gait timing
- The head line is not directly bendable; preserving the simple silhouette matters more than making every segment interactive.

## Stage And Visual Direction

- Background: faded off-white full-canvas stage
- No framed paper sheet or persistent overlay UI
- Visual language: sparse, dry, sketch-like
- The lines should read as a black marker or ink drawing rather than a polished vector mascot

## App Structure

Create a new sibling app folder:

- `giraffe/public/index.html`
- `giraffe/public/app.js`
- `giraffe/public/styles.css`
- `giraffe/src/simulation.js`
- `giraffe/tests/simulation.test.js`

Integrate the app with the existing project shell:

- add a landing card in `public/index.html`
- add card styling in `public/styles.css`
- route `/giraffe` in `server.js`
- copy the app into Vercel output in `scripts/build-vercel-output.js`
- document the route in `README.md`

## Scope

Included in this first version:

- seven-line giraffe silhouette
- endless in-place walk
- mouse-based neck/head lead and body follow
- click impulse on legs, body, and neck
- faded off-white full-canvas background
- landing card and `/giraffe` route

Explicitly out of scope:

- sound
- settings UI
- mobile-specific gesture tuning
- saved state
- additional animals
- configurable line counts or editing tools

## Verification Targets

- Visiting `/giraffe` immediately shows the animated giraffe on the faded off-white stage.
- Moving the mouse makes the neck and head lead the turn and the body follow afterward.
- Clicking a leg, the body, or the neck causes a brief bend reaction and a small gait disturbance.
- The silhouette still reads as seven black straight lines at all times.
- The new landing card links correctly from `/`.
- The app is included in the static Vercel output under `/giraffe`.
