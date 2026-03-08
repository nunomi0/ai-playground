# Playground

This repository is a multi-project workspace.

Each project lives in its own subdirectory and manages its own files, scripts, and tests.

## Projects

### `games/snake`

Classic Snake game built as a small standalone web app.

Run it:

```bash
cd /Users/leeyukyung/Documents/Playground/games/snake
PORT=3001 npm run dev
```

Open:

```bash
http://127.0.0.1:3001
```

Test it:

```bash
cd /Users/leeyukyung/Documents/Playground/games/snake
npm test
```

## Recommended structure

When you add more projects, keep them as sibling folders:

```text
Playground/
  README.md
  games/
    snake/
  apps/
    project-b/
  tools/
    project-c/
```

Each project should keep its own:

- `package.json`
- `src/`
- `public/`
- `tests/`

That keeps the repository simple and avoids the complexity of Git submodules unless you truly need separate repositories.
