# Snake Project Notes

## One-line summary

I built a classic Snake game as a small standalone web app and then adapted it to fit a multi-project Playground structure with a root landing page and Vercel routing.

## What I paid attention to

- I kept the scope intentionally narrow: grid movement, growth, food spawn, score, game-over, and restart only.
- I separated core game rules from rendering so movement, collisions, and food placement stayed testable.
- I avoided unnecessary dependencies and used simple platform primitives instead: Node HTTP server, plain HTML/CSS/JS, and Node's built-in test runner.
- I treated input feel as a real quality issue. I revised direction handling so the latest valid key input wins at move time.
- I optimized rendering where it actually mattered, reducing unnecessary DOM work instead of overengineering the stack.
- I fixed edge cases around game-over and restart, including stale snake traces left on the board.
- I adapted the project structure for future growth by making Snake one project inside a broader Playground rather than a one-off deployment target.
- I handled deployment details carefully, especially route handling and static asset paths under `/snake` on Vercel.

## Engineering decisions I can talk about

### Keep logic deterministic

I wrote the movement and collision logic as pure functions so I could verify behavior without relying on the browser. That made it easier to reason about growth, wall collisions, self-collisions, and food placement.

### Prefer simple infrastructure

Because the repository started empty, I chose the smallest viable stack instead of introducing a framework just to host one game. That kept the project understandable and reduced setup cost.

### Improve controls based on feel

The first version accepted input, but fast keyboard turns could feel inconsistent. I revised the direction handling so the current move respects the most recent valid intent instead of replaying stale queued inputs.

### Handle real deployment constraints

The project was eventually deployed as part of a shared Playground landing page. I adjusted routing and asset paths so Snake works under `/snake` rather than assuming it owns the site root.

## Short talking points

- Built a classic Snake game from scratch with plain JavaScript, deterministic game logic, and zero runtime dependencies.
- Added test coverage for movement, growth, food placement, wall collision, and self-collision logic.
- Improved control responsiveness by refining direction handling around high-frequency keyboard input.
- Restructured the app to fit a multi-project Playground and deployed it behind a root landing page on Vercel.

## Interview framing

If I describe this project in an interview or case study, the emphasis is:

- I can scope a small product tightly and finish it cleanly.
- I care about feel and edge cases, not just "it basically works."
- I keep rules and UI concerns separate when that improves testability.
- I can move from local prototype to deployment while cleaning up structure for future projects.
