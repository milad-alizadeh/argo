# ADR-0023 — The Electron runtime is retired, and four ADRs go with it

**Status:** Accepted — completes [ADR-0022 (swift-native-macos-runtime)](./0022-swift-native-macos-runtime.md)

## Context

ADR-0022 chose a pure Swift macOS app and specified the migration as
parallel-until-parity in vertical slices, ending in "delete `apps/desktop`". That
last step is now taken. `apps/macOS` is the app; nothing in the tree imports
`@argo/desktop`.

Four accepted ADRs described the runtime that just left:

| ADR | Decided |
|---|---|
| 0002 | Electron over Tauri, because `node-pty` + `xterm.js` was the core organ |
| 0004 | Electron's **main process is the backend** — PTY host, in-process MCP server, store, router supervision; the renderer is React over IPC |
| 0005 | Authoritative state in main as a plain observable store; the renderer a **projection** fed by IPC deltas into Zustand; XState reserved, not general |
| 0006 | The app toolchain: React 19 + Vite, Tailwind 4, shadcn/ui, Phosphor, xterm.js 6, `argo-tokens.css` |

Every one of them names a mechanism that no longer exists. Left in place they
read as live guidance — an ADR trail is where a fresh session goes to learn how
this app is built, and four of the twenty-two would have been describing a
different app.

## Decision

**Delete ADRs 0002, 0004, 0005 and 0006.** Their numbers are retired, not reused:
a future ADR takes the next free number, so a reference to "ADR-0005" found in an
old issue resolves to nothing rather than to something unrelated.

This ADR is what those four are superseded *by*, and it carries the one claim
among them that outlived its mechanism:

**One owner holds authoritative state; the UI is a projection over it.** ADR-0005
spelled that as main-process store → IPC deltas → Zustand → React. Swift spells it
as the **Hub** (`ArgoEngine`) → a cockpit projection → SwiftUI. The shape is the
load-bearing part and it survived the rewrite unchanged: business logic does not
migrate into the view layer, and `scripts/swift-boundaries.sh` now enforces
mechanically what ADR-0005 could only assert — exactly one file in `ArgoUI` may
read live Hub state.

The rest did not survive and is not restated anywhere:

- **0002's** premise (Electron is where `node-pty` + `xterm.js` is most proven) is
  moot; the terminal path is native.
- **0004's** consequence (no headless mode without extracting a daemon) still
  holds for the same reason — the window is the app — but it is a property of
  having one process, not of that process being Electron's main.
- **0006** is wholly gone. Its successor is not a list of libraries but
  `ArgoUI/VisualContract/`, and `rules/swift-style.md`.
- **0005's** `better-sqlite3` mirror was already withdrawn by
  [ADR-0008](./0008-persistence-files-only-derived-layer.md), which remains the
  persistence decision of record.

## Consequences

- Git history is the only copy of the deleted four. `git log --diff-filter=D --
  docs/adr/` finds the commit that removed them, and the ADRs are readable at its
  parent. This is deliberate: an ADR's value is at the moment a decision is being
  made or revisited, and both of those have happened.
- The quality gates that existed to check `apps/desktop`'s shape have no subject.
  The three placement gates come out of `quality` and pre-commit;
  [ADR-0021](./0021-placement-is-declared-per-module.md) is **dormant, not
  withdrawn** — its scripts stay in `scripts/`, ship to consumers through
  `scaffold.mjs --hooks`, and are rewired the day a TypeScript workspace returns.
- `docs/designs/` loses its HTML studies and CSS token contract for the same
  reason; `ArgoUI/Specimen/FoundationSpecimen.swift` is the living contract now.
