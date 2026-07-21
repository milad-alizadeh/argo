---
name: run-desktop
description: Build, launch, screenshot, and drive the Argo Electron cockpit from a clean tree. Argo-specific (apps/desktop). Use when asked to run the desktop app, confirm a renderer/main-process change works in the real window, or capture a screenshot of the running cockpit.
---

# Run Desktop

Boots the packaged Electron cockpit through Playwright's `_electron` launcher — the same
harness `e2e/*.spec.ts` uses — so an agent with no display can launch, screenshot, and inspect
the running app. All commands below run from `apps/desktop`.

## Prerequisites

- `bun install` at the repo root (or in `apps/desktop`) — the driver imports `@playwright/test`
  and launches the repo's local `electron`; a tree that has never installed has neither. On a
  genuinely cold tree this first install is slow and needs a working native toolchain: it
  compiles `node-pty` (a native module) and downloads the Electron binary.
- The app is ESM (`"type": "module"`); `driver.mjs` runs under `node`.

## Build first

The driver launches `out/main/index.js`, so a build must precede every run — `out/` is not
watched, so **rebuild after editing `src/`**:

```bash
bun run build          # electron-vite build → out/{main,preload,renderer}
```

## Agent path — the driver

```bash
node .claude/skills/run-desktop/driver.mjs --seed --out /tmp/cockpit.png \
  --eval "document.querySelector('[data-testid=cockpit-root] a')?.innerText"
```

It launches the built app, waits for `[data-testid="cockpit-root"]`, writes the screenshot, and
prints the window title. With `--seed` the eval above returns the demo row's text
(`"Refactor auth module\nRunning\nclaude"`). Options:

- `--out <path>` — screenshot destination, resolved against the current directory
  (default `run-desktop.png` in cwd).
- `--seed` — sets `ARGO_SEED_DEMO=1` so the rail shows a demo Session instead of the empty state.
- `--testid <id>` — print the inner text of `[data-testid="<id>"]`. `cockpit-root` is the
  renderer root, so it returns the whole tree's text; point this at a leaf testid to read one
  element as more get added.
- `--eval <expr>` — eval a JS expression in the renderer and print the JSON result.
- `--wait <testid>` — element to wait for before shooting (default `cockpit-root`).

**Read the PNG back and confirm it shows the app** — a green exit is not proof the window
rendered. A seeded run shows a `SESSIONS` rail with a `Refactor auth module` / `Running` /
`claude` row.

## Human path — dev server

For interactive work with hot reload (not for headless agents):

```bash
bun run dev            # electron-vite dev; renderer on http://localhost:5173, opens a window
```

`ARGO_SEED_DEMO=1 bun run dev` seeds the same demo Session.

## Gotchas

- Run the driver **from `apps/desktop`** — it resolves the app root relative to its own file, but
  `--out` and any relative screenshot path resolve against your cwd.
- Playwright's launcher emits benign teardown noise on close (`kill EPERM`,
  `<will force kill>`) even on a clean run — judge success by the printed title and the PNG.
- Stale `out/` renders old code; if a `src/` change isn't visible, you skipped the rebuild.

## Troubleshooting

- `Cannot find module .../out/main/index.js` → run `bun run build`.
- `waitFor` times out on `cockpit-root` → the renderer failed to mount; pass `--wait` for a
  testid you know exists, or run `bun run dev` and read the DevTools console.
- Driver import errors (`@playwright/test` not found) → `bun install` first.
