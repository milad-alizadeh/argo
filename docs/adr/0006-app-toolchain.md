# apps/desktop toolchain

**Context.** The greenfield Electron app (ADR-0001/0002) needs a build/UI/test/lint stack. The repo currently has no real linter (only `node --check` in `argo-skills`), so there is nothing to migrate away from.

**Decision.**
- **Build/dev:** `electron-vite` (main + preload + renderer HMR); **packaging:** `electron-builder` (mac/dmg first).
- **UI:** React 19 + Vite, **Tailwind 4**, **shadcn/ui** as the component layer, **Phosphor Light** icons, **xterm.js 6** + `node-pty`. `argo-tokens.css` → `globals.css`.
- **Component / screen development:** **Storybook** (isolated component *and* full-screen/view states).
- **Tests:** **Vitest** for unit/integration. **Component/story tests** run each Storybook story via `@storybook/addon-vitest` in **Vitest browser mode**, whose browser provider is **Playwright (Chromium)** — so Storybook *is* the story-testing surface and Playwright is the engine under it. **App-launch smokes** use **Playwright's Electron launcher** (`_electron`) to boot the real app and exercise the main process, IPC, and PTY — a boundary Storybook/browser-mode cannot reach.
- **Lint + format:** **Biome** — the single Rust-based tool covering both, chosen over an ESLint + Prettier pair.

**Why.** Standard modern Electron + React stack; the design handoff already fixed the UI layer (shadcn/Phosphor/Tailwind/xterm). Storybook is added because the cockpit has many discrete component and screen states worth developing in isolation. Biome is picked as a clean adoption (no existing config to fight) for one fast lint+format tool instead of two.

**Consequences.** Biome, Storybook, and the test runners are individually swappable — none is deep lock-in. Explicitly *not* decided here: any "run-the-app trust gate" (an argo-v2 concept that does **not** carry over to this build); Playwright is adopted only as a normal test runner.
