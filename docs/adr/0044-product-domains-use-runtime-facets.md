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

`scripts/check-domain-facets.mjs` enforces this matrix. The quality gate and CI run
the checker. Tests stay beside the facet that owns the behavior.

Every domain lives in this layout. `src/` holds only `domains`, `platform`, `shared`, `agents`,
`providers`, the `renderer` composition root, and the entry points. The checker refuses an import
from any other top-level root.

## Consequences

A reader can find all Project behavior under one domain and identify its runtime from the path.
The Project contract remains the shared interface across runtimes. The main, preload, and renderer
entry points contain wiring only.

Each later migration can move one domain without moving the complete application. The boundary
checker applies to every domain as soon as that domain enters `src/domains`.

## Amendment · harness adapters (#2453) · 2026-09-20

A harness adapter is a port adapter, not a product domain. It lives under
`apps/desktop/src/harnesses/<harness>/`, beside the harness-specific filesystem layout and parser.
The main composition root registers adapters. An adapter may depend on the Session contract but not
on Sessions main internals, and renderer code reaches adapter-owned values through that contract.
