# Desktop Rules

What no linter checks about `apps/desktop`. The surfaces are
[ADR-0038](../../docs/adr/0038-the-desktop-cockpit-is-opaque.md); the caps are `biome.jsonc`.

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
- Cases build on the `test` in `e2e/packaged-proof.ts` and declare their starting state as a
  fixture option (`test.use`), never as a case that runs first. A flow variant, such as the
  real-Harness backend, is a project `use` option on the same file, never a copy.
- `mocks/` holds `mock-*` CLIs, providers and transcripts; `tools/` holds capture, measure and
  repro scripts; `scripts/` holds runtime wrappers only.

## Test runners

`bun test` runs the suite. Anything reaching the Session index needs `node:sqlite`, which Bun
lacks, so it runs under the `node` Vitest project with the `*.vitest.ts` suffix. `bun run test`
runs both. Everything else stays `*.test.ts`.

## Tokens

`docs/design-stack.md` names the token contract.

- Production visual values use shared tokens or named component-local tokens beside their owner.
  Resolve exploratory values into tokens before review.
- Name a token for its role, not its value: `--text-body`, not `--text-13`. One small role set per
  family.
- Every reader-visible string takes a typography role.
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
themselves, and the root rule in `globals.css` covers the rest. Write `outline: none` only in a
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

A story's `title:` nests under its owning parent component's group, one level per parent,
matching folder placement (`Sessions/Composer/*`); a shared cross-domain primitive stays under
`Components/`.

For rendered UI work, a `play` function is the TDD seam: operate the story through visible
controls and assert reader-visible behaviour and accessible semantics, never CSS classes or
computed styles.

Every story runs a required axe scan. A story only for looking at takes the `view-only` tag
instead of an empty `play`. Fix a finding, usually with a shared token; disable an axe rule only for
markup you did not author, naming the vendored element on the same line (example in
`.storybook/preview.ts`).

## Running the app

Test the running app through its worktree's debugging port: from that worktree run `bun run dev`,
read `debugPort` from `bun run desktop:status`, then `npx -y agent-browser@0.37.1 connect
<debugPort>`. Never attach to a generic Electron process or write a separate CDP client.

To profile jank, dropped frames, re-renders or white flashes, read `docs/agents/profiling.md`
first.
