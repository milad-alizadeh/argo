# Desktop Rules

What no linter checks about `apps/desktop`. The surfaces are
[ADR-0038](../../docs/adr/0038-desktop-surfaces-are-opaque.md); the caps are `biome.jsonc`.

## Naming

Call the Electron application Argo Desktop. Name internal parts for their role, such as `AppShell`,
`ProjectsState`, and `WorktreeRow`. Use `Cockpit` for historical references to the deprecated
Swift app or earlier decisions.

## Session adapters

Before changing Session observation, transcript discovery or a Harness parser, read
`docs/adr/0024-session-drive-port-two-adapters.md`. Each Harness owns one adapter under
`src/harnesses/<harness>/`, holding its filesystem layout and parser. Shared Session code holds
only the IPC contract and projections, with no Harness or filename branches. Register an adapter
once.

## Test assets

Test assets live outside `src/`, and a mock is called a mock.

- `e2e/<flow>/` holds Playwright flows (`*.e2e.ts`, `cases/*.case.ts`, `fixtures/*.fixture.ts`),
  one project per flow in `playwright.config.ts`, run by `bun run test:e2e`. A new flow is a
  project, never a script.
- Run e2e locally against the Vite build: `bun run test:e2e` builds it and never packages the app.
  Only CI sets `ARGO_E2E_PACKAGED=1` to run the same cases against the packaged app. Do not package
  to run e2e.
- The e2e build is the `build:vite` Turborepo task, cached in `<git common dir>/turbo-cache`, which
  every worktree of the clone shares. Unchanged inputs restore `.vite` in about a second. A cold
  build waits for one of two machine-wide build slots. You can delete the `turbo-cache` folder at
  any time; the next build fills it again.
- Cases build on the `test` in `e2e/packaged-proof.ts` and declare their starting state as a
  fixture option (`test.use`), never as a case that runs first. A flow variant, such as the
  real-Harness backend, is a project `use` option on the same file, never a copy.
- `mocks/` holds `mock-*` CLIs, providers, transcripts, and reusable fixture data for stories
  and tests. `tools/` holds capture, measure and repro scripts; `scripts/` holds runtime wrappers
  only.

## Test runners

`bun test` runs the suite. Anything reaching the Session index needs `node:sqlite`, which Bun
lacks, so it runs under the `node` Vitest project with the `*.vitest.ts` suffix. `bun run test`
runs both. Everything else stays `*.test.ts`.

## Tokens

`docs/design-stack.md` names the token contract.

- Production visual values use shared tokens or named component-local tokens beside their owner.
  Resolve exploratory values into tokens before review.
- Registry controls keep their default typography. Custom content recipes follow
  `docs/design-stack.md`; `type-control` is not a blanket control override.
- A screen is a thin container: it resolves state and hands a pure render surface the result.
- Read every color through a token. The app offers System (default), Light and Dark, and a value
  right in one appearance and wrong in the other is caught by no gate.

## Reader text

Every new production UI label, message or accessible name goes in its locale catalog.

## Accessible names

A tooltip is silent to a screen reader, so naming is separate from showing a tooltip.

- **An icon-only control** carries `aria-label` with the name a sighted reader would say. An
  optional tooltip repeats that string.
- **A mark that is not a control** puts its fact in text, visible or visually hidden, never only
  in a tooltip, and never takes a `tabIndex` to make a tooltip reachable.
- **A labelled control whose help adds a fact** points `aria-describedby` at the fact.

Anything else follows the mark rule.

## Focus

The ring is `--ring` in both appearances, via `:focus-visible`; shadcn components draw it
themselves, and the root rule in `styles/app-base.css` covers the rest. Write `outline: none` only in a
block that draws a replacement ring.

## Shortcuts

Every chord is an entry in `src/platform/contract/commands.ts`, with a scope:

| Scope | Where it fires |
| --- | --- |
| `menu` | An application-menu accelerator, built in the main process. |
| `window` | A window key handler, live whatever holds focus. |
| `element` | A key handler on one element, live only while it holds focus. |

Enter and Escape inside a dialog are DOM semantics, not entries.

## Design work

For UI work, read `docs/design-stack.md` for the token contract and render commands. Record design
decisions and their reasons in the implementation ticket.

## Storybook

A component is reviewed in Storybook; a screen is reviewed by a render command
(`docs/design-stack.md`, `README.md`).

Use readable title case and group stories by product ownership: `Design System/Primitives/<Name>`
for base or registry controls, `Design System/Patterns/<Name>` for app-owned compositions,
`Design System/Foundations/<Showcase>` for token or theme showcases,
`Features/<Domain>/<Component>` for feature UI, and `App/<Area>/<Component>` for shell UI.

Mode and Theme are global Storybook toolbar controls. Keep one canonical story per component
state or behavior; stories inherit the selected globals. Assert behavioral events in `play`
functions, and keep the canvas to realistic product or component UI. Never add Light/Dark
duplicate stories, story-level mode forcing, theme test matrices, or visible test/debug output.

For rendered UI work, a `play` function is the TDD seam: operate the story through visible
controls and assert reader-visible behaviour and accessible semantics. Dedicated browser
contracts in `tests/styling/` prove classes and computed measurements.

Every story runs a required axe scan. A story only for looking at takes the `view-only` tag
instead of an empty `play`. Fix a finding, usually with a shared token; disable an axe rule only for
markup you did not author, naming the vendored element on the same line (example in
`.storybook/preview.ts`).

## Running the app

Test the running app through its worktree's debugging port: from that worktree run `bun run dev`,
read `debugPort` from `bun run desktop:status`, then `npx -y agent-browser@0.37.1 --session
<worktree folder name> connect <debugPort>`, and pass the same `--session` to every later
agent-browser command so other agents' commands stay out of your window. Never attach to a generic
Electron process or write a separate CDP client.

To profile jank, dropped frames, re-renders or white flashes, read `docs/agents/profiling.md`
first.
