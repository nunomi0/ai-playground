# Playground

This repository is a multi-project workspace with a root landing page.

Each project lives in its own subdirectory and manages its own files, scripts, and tests.

## Root app

Run the workspace shell:

```bash
cd /Users/leeyukyung/Documents/Playground
npm run dev
```

Open:

```bash
http://127.0.0.1:3000
```

The root page links to each project. `snake` is currently available at `/snake`.

## Projects

### `snake`

Classic Snake game built as a small standalone web app.

Run it:

```bash
cd /Users/leeyukyung/Documents/Playground/snake
PORT=3001 npm run dev
```

Open:

```bash
http://127.0.0.1:3001
```

Test it:

```bash
cd /Users/leeyukyung/Documents/Playground/snake
npm test
```

## Recommended structure

When you add more projects, keep them as sibling folders:

```text
Playground/
  README.md
  public/
  package.json
  server.js
  vercel.json
  snake/
  project-b/
  project-c/
```

Each project should keep its own:

- `package.json`
- `src/`
- `public/`
- `tests/`

That keeps the repository simple and avoids the complexity of Git submodules unless you truly need separate repositories.
