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
| `api` | Runtime-neutral values and schemas shared by API handlers and their callers. |
| `contract` | Versioned IPC schemas, inferred types, operation names, and pure domain values shared across runtimes. |
| `main` | Authoritative behavior, stores, operating system adapters, and API registration. |
| `preload` | The fixed capability methods that call approved IPC operations. |
| `renderer` | React behavior, queries, local state, stories, and locale text. |

The application entry points stay separate. `src/main.ts`, `src/preload.ts`, and
`src/renderer/main.tsx` are composition roots. A composition root assembles domain interfaces. It
does not own domain behavior.

Imports point toward the shared API and contract facets. The matrix defines each permitted dependency:

| Source facet | API | Contract | Main | Preload | Renderer |
| --- | --- | --- | --- | --- | --- |
| `api` | Yes | Yes | No | No | No |
| `contract` | No | Yes | No | No | No |
| `main` | Yes | Yes | Yes | No | No |
| `preload` | Yes | Yes | No | Yes | No |
| `renderer` | Yes | Yes | No | No | Yes |

API and contract code cannot import Electron, Node, React, storage, providers, or runtime facets.
Renderer code cannot import Electron, Node, main implementations, or preload implementations. A
domain facet cannot import an application composition root.

`biome.jsonc`'s `noRestrictedImports` overrides enforce the facet matrix. The port-only
cross-domain rule (#2623) lives instead in `.dependency-cruiser.json`, a deliberate exception to
consolidating checks into Biome: stating "reach another domain only through its index.ts" as one
rule needs a regex backreference between `from.path` and `to.pathNot`, and Biome has no such
primitive as of 2.5.4 (open request: `biomejs/biome` discussion #6245). Without it, the rule would
need one override block per domain, repeating the same shape five or six times. `bun run quality`
runs biome as part of `format-and-lint` and dependency-cruiser as `quality:boundaries`. Tests stay
beside the facet that owns the behavior.

Every domain lives in this layout. `src/` holds `domains`, `platform`, `shared`, `harnesses`,
`providers`, the `renderer` composition root, and the entry points. A harness is a named external
agent environment. Its Claude or Codex implementation lives in `src/harnesses/<harness>/`, under
its own `harness` facet. A harness facet can use the Sessions contract, but it cannot use Sessions
main code. A harness can also have a `renderer` facet, under `src/harnesses/<harness>/renderer/`,
for the harness-specific UI it draws (#2505). The renderer facet follows the same rule as a domain
renderer: it cannot use Node, Electron, or main-process code. `src/harnesses/composition/` is a
declared composition root. It wires each harness into the application, so it can use Sessions main
code the way `src/main.ts` can. This harness-facet nuance (the composition-root exception, the
temporary main allowances, and the ban on any other top-level root) has no `biome.jsonc` rule yet
(#2623 covered only the product-domain port rule); it is unenforced until a follow-up ticket
expresses it there.

## Consequences

A reader can find all Project behavior under one domain and identify its runtime from the path.
The Project contract remains the shared interface across runtimes. The main, preload, and renderer
entry points contain wiring only.

Each later migration can move one domain without moving the complete application. The boundary
checker applies to every domain as soon as that domain enters `src/domains`.

Harnesses stay outside product domains because they implement external environments rather than
one product capability. The application composition root wires them to the Sessions main facet.
Pure contracts that cross runtimes stay in the Sessions contract.

## Amendment · shared API placement and the Ticket read model (#2906)

Use one placement rule. Put code under the facet that owns its behavior. Put shared table
definitions under `src/database/`. Put provider and Harness protocols under `src/providers/` and
`src/harnesses/`. Put renderer-only state, stories, and text under the owning renderer facet.

Use `api/` for runtime-neutral values and schemas that current API handlers and callers share. Put
the input and output schemas for one tRPC procedure beside its handler. Infer caller types from the
router. Use `contract/` only for a versioned IPC contract that has a current owner in more than one
runtime. Put other internal types beside their handler, machine, query, or view. Do not keep a
folder or barrel only to preserve an old path.

The desktop domains now have these owners:

| Domain or entry | Before #2906 | Current owner |
| --- | --- | --- |
| Accounts | `domains/accounts/contract`, `main`, `renderer` | `contract/contract.ts` owns Account messages; `main/access.ts` owns grant access; `renderer/hooks/use-accounts.ts` reads Accounts. |
| Atlas | `domains/atlas/renderer` | `renderer/pages/atlas-page.tsx` owns the page; `renderer/components/atlas-sidebar.tsx` owns its sidebar. |
| Connections | `domains/connections/main` | `main/index.ts` owns the Connection port and records. |
| Harness sign-in | `domains/harness-signin/contract`, `main`, `renderer` | `contract/contract.ts` owns sign-in messages; `main/harness-sign-in.ts` owns sign-in; `renderer/components/harness-sign-in-cards.tsx` owns its controls. |
| Projects | `domains/projects/main`, `renderer` | `main/api/project-register.ts` owns Project registration; `renderer/onboarding/screens/project-setup-screen.tsx` owns setup. |
| Sessions | `domains/sessions/api`, `main`, `renderer` | `api/session-live-event.ts` owns Feed messages; `main/sync/session-sync-machine.ts` owns sync; `renderer/screens/session-screen-details.tsx` owns the screen. |
| Tickets | `domains/tickets/contract`, `main`, `renderer` | `contract/contract.ts` and `contract/ticket.ts` move to `api/messages.ts` and `api/ticket.ts`; `main/ticket-index-service.ts` owns SQLite list reads; `renderer/sidebar/ticket-row.tsx` owns row display. |
| Workspaces | `domains/workspaces/main`, `renderer` | `main/workspace-resolve-path.ts` owns path lookup; `renderer/use-workspaces.ts` owns workspace choices. |
| Providers | `src/providers/` | `providers/registry.ts` selects adapters; `providers/github/issues.ts` and `providers/linear/issues.ts` read Tickets. |
| Harnesses | `src/harnesses/` | `harnesses/claude/registration.ts` and `harnesses/codex/registration.ts` connect vendor protocols to Sessions. |
| Renderer composition | `src/renderer/main.tsx`, `src/renderer/cockpit-router.tsx`, `src/renderer/catalogs.ts` | These files assemble routes, catalogs, and domains. They do not own domain behavior. |

Ticket lists now read committed SQLite rows through `ticketActive`, `ticketClosed`, and `ticketSearch`.
Provider reads run through the Ticket sync and search machines. The old `ticketList` procedure read
the provider directly and duplicated the SQLite path, so it is removed. Its unused request and
reply schemas are removed too. The Ticket display-age helper now lives beside the Ticket sidebar.

The completed #2865 slices own provider registration, the Ticket SQLite read model, shared UI,
Ticket sync, and status and priority operations. #2878 still owns recovery for uncertain Ticket
edits after restart. It must read the provider by native ID and settle or show the uncertain result.
The direct provider list procedure was the remaining duplicate Ticket read path found in this audit.
The existing Feed and Composer cleanup remains with #2815.
