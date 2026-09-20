# 0044 · Product domains use runtime facets

Status: accepted (#2425) · 2026-09-18

## Context

Electron gives Argo three runtimes: the main process, preload, and the renderer. The old source
tree grouped some code by runtime and some code by product capability. A reader had to open a
file to learn which runtime owned it.

Argo already uses one operation table for each IPC domain. The table keeps the wire contract
consistent across the main process, preload, and the renderer. The source tree did not state the
same ownership rule.

## Decision

A domain is one product capability, such as Projects or Sessions. A runtime facet is the part of
that domain that runs in one Electron runtime. Product domains live under
`apps/desktop/src/domains/<domain>/` and can contain these facets:

| Facet | Owns |
| --- | --- |
| `contract` | Serializable schemas, inferred types, operation names, and pure domain values. |
| `main` | Authoritative behavior, stores, operating system adapters, and IPC registration. |
| `preload` | The fixed capability methods that call approved IPC operations. |
| `renderer` | React behavior, queries, local state, stories, and locale text. |

The application entry points stay separate. `src/main.ts`, `src/preload.ts`, and
`src/renderer/main.tsx` are composition roots. A composition root assembles domain interfaces. It
does not own domain behavior.

Imports point toward contracts. The matrix defines each permitted dependency:

| Source facet | Contract | Main | Preload | Renderer |
| --- | --- | --- | --- | --- |
| `contract` | Yes | No | No | No |
| `main` | Yes | Yes | No | No |
| `preload` | Yes | No | Yes | No |
| `renderer` | Yes | No | No | Yes |

Contract code cannot import Electron, Node, React, storage, providers, or renderer code. Renderer
code cannot import Electron, Node, main implementations, or preload implementations. A domain
facet cannot import an application composition root.

`scripts/check-domain-facets.mjs` reads every source file under `apps/desktop/src` and reports
each import that crosses a facet boundary. `bun run quality:facets` runs the checker and its own
tests, and `bun run quality` runs `quality:facets`. CI runs `quality:facets` as its own step
(#2505). Tests stay beside the facet that owns the behavior.

Every domain lives in this layout. `src/` holds `domains`, `platform`, `shared`, `harnesses`,
`providers`, the `renderer` composition root, and the entry points. A harness is a named external
agent environment. Its Claude or Codex implementation lives in `src/harnesses/<harness>/`, under
its own `harness` facet. A harness facet can use the Sessions contract, but it cannot use Sessions
main code. A harness can also have a `renderer` facet, under `src/harnesses/<harness>/renderer/`,
for the harness-specific UI it draws (#2505). The renderer facet follows the same rule as a domain
renderer: it cannot use Node, Electron, or main-process code. `src/harnesses/composition/` is a
declared composition root. It wires each harness into the application, so it can use Sessions main
code the way `src/main.ts` can. The checker refuses an import from any other top-level root.

## Consequences

A reader can find all Project behavior under one domain and identify its runtime from the path.
The Project contract remains the shared interface across runtimes. The main, preload, and renderer
entry points contain wiring only.

Each later migration can move one domain without moving the complete application. The boundary
checker applies to every domain as soon as that domain enters `src/domains`.

Harnesses stay outside product domains because they implement external environments rather than
one product capability. The application composition root wires them to the Sessions main facet.
Pure contracts that cross runtimes stay in the Sessions contract.
