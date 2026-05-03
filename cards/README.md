# Prism Trio

`Prism Trio` is the card-matching game served at `/cards` inside this repository.

## Run

From the repository root:

```bash
cd /Users/leeyukyung/project/Playground
PORT=3005 npm run dev
```

Open:

```bash
http://127.0.0.1:3005/cards
```

## Rules

- 10 turns per run
- 5 cards in hand
- 3 challenge cards on the board
- after each play, 1 hand card and 1 board card are refilled from the deck

## Deck

- 4 suits: `crimson`, `azure`, `verdant`, `gold`
- ranks `1` through `9`
- each suit-rank pair appears twice
- total deck size: `72`

Because each card exists in duplicate, a real `PRISM` match is possible.

## Scoring

- `PRISM`: same suit + same rank -> `rank x 5`
- `BOND OF TEN`: ranks sum to `10` -> `20`
- `HUE MATCH`: same suit -> `rank x 3`
- `TWIN`: same rank -> `rank x 3`
- `MISMATCH`: anything else -> `-3`

When multiple conditions overlap, the game records the highest scoring result for that pair. It does not simply use the first matching rule.

Examples:

- `5 + 5` with different suits -> `BOND OF TEN` (`20`) beats `TWIN` (`15`)
- same-suit `1 + 9` -> `BOND OF TEN` (`20`) beats `HUE MATCH` (`3`)
- same-suit `9 + 1` -> `HUE MATCH` (`27`) beats `BOND OF TEN` (`20`)
- same-suit `5 + 5` -> `PRISM` (`25`) beats `BOND OF TEN` (`20`)

## Randomness

The game is random at setup time.

- a full 72-card deck is built
- the deck is shuffled once
- 5 cards are dealt to the hand
- 3 cards are dealt to the board

After that, the run consumes the already shuffled deck in order. Each turn is not freshly randomized, but the future deck order is hidden from the player.

That means there is no strict guaranteed winning line. There are strong heuristics, but not a perfect always-win strategy.

## Shared Leaderboard

The leaderboard uses Supabase directly from the browser.

- only scores saved after finishing a run can be inserted
- manual score entry is disabled
- the default project is the dedicated `ai-playground` Supabase project

Optional overrides:

- `PRISM_TRIO_SUPABASE_URL`
- `PRISM_TRIO_SUPABASE_ANON_KEY`

Schema and RLS policy live here:

- [`/Users/leeyukyung/project/Playground/supabase/prism_trio_scores.sql`](/Users/leeyukyung/project/Playground/supabase/prism_trio_scores.sql)

## Key Files

- [`/Users/leeyukyung/project/Playground/cards/public/index.html`](/Users/leeyukyung/project/Playground/cards/public/index.html)
- [`/Users/leeyukyung/project/Playground/cards/public/app.js`](/Users/leeyukyung/project/Playground/cards/public/app.js)
- [`/Users/leeyukyung/project/Playground/cards/public/game.js`](/Users/leeyukyung/project/Playground/cards/public/game.js)
- [`/Users/leeyukyung/project/Playground/cards/public/leaderboard.js`](/Users/leeyukyung/project/Playground/cards/public/leaderboard.js)
- [`/Users/leeyukyung/project/Playground/cards/tests/game.test.js`](/Users/leeyukyung/project/Playground/cards/tests/game.test.js)
- [`/Users/leeyukyung/project/Playground/cards/tests/leaderboard.test.js`](/Users/leeyukyung/project/Playground/cards/tests/leaderboard.test.js)
