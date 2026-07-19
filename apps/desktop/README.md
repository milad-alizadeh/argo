# @argo/desktop — Argo Cockpit

The Argo **Cockpit**: a render-only desktop window that observes and steers stock agentic
CLI **Sessions**. This is the walking-skeleton scaffold (issue #2) — it boots to an empty
window with the full toolchain wired; no Session is observed yet.

Greenfield (ADR-0001), Electron + TypeScript (ADR-0002), living beside `packages/argo-skills`
in this bun + turbo monorepo (ADR-0003).

## Stack (ADR-0006)

- **electron-vite** (main + preload + renderer HMR) · **electron-builder** (mac/dmg first)
- **React 19** · **Tailwind 4** (`argo-tokens.css` → `globals.css`) · **shadcn/ui** · **Phosphor** icons · **xterm.js 6** + **node-pty**
- **Biome** (lint + format) · **Vitest** (unit + Storybook story tests) · **Playwright** (Electron app-launch smoke) · **Storybook**

## Commands

Run from the repo root (`bun run <script>` fans out via turbo) or from `apps/desktop`.

| Command | What it does |
| --- | --- |
| `bun run dev` | Launch the app with HMR (`electron-vite dev`). |
| `bun run build` | Build main + preload + renderer to `out/`. |
| `bun run typecheck` | `tsc` for the node (main/preload) and web (renderer) projects. |
| `bun run lint` | `biome check .` |
| `bun run test` | Vitest **unit** project (fast, node). |
| `bun run test:stories` | Vitest **storybook** project — every story run as a test in real Chromium. |
| `bun run test:e2e` | Build, then the Playwright `_electron` app-launch smoke. |
| `bun run storybook` | Storybook dev server on :6006. |
| `bun run package` | Build + `electron-builder --mac` (dmg). |

## Testing seams

- **Unit** (`vitest --project=unit`): plain node tests for renderer/main logic.
- **Stories** (`vitest --project=storybook`): Storybook is the component/story-testing surface;
  the addon runs each story in Chromium via Playwright.
- **App-launch smoke** (`playwright test`): boots the real Electron main process — the boundary
  Storybook/browser-mode can't reach.

## Notes

- **node-pty** is installed but its native binary is not rebuilt against Electron's ABI yet — it
  is not imported in the skeleton. A later ticket (embedded steering terminal) adds the rebuild
  step (`electron-builder install-app-deps` / `@electron/rebuild`) and marks it a trusted dependency.
- The monorepo uses bun's **hoisted** linker (`bunfig.toml`) so `vite` resolves to a single copy
  shared by electron-vite and the Vite plugins.
