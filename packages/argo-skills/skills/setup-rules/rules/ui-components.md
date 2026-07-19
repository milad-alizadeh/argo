---
paths:
  - "{{COMPONENTS_GLOB}}"
---

# UI Component Rules

Applies to all UI components under `{{COMPONENTS_DIR}}`. Read together with the
`design-system` rule (tokens + utilities, no magic numbers).

## Atomic design — always (atoms → molecules → organisms)

Every piece of UI is one of three tiers. This vocabulary is what stops rogue,
one-off styling from creeping in. Before writing markup, decide which tier the unit
belongs to and build/reuse at that tier.

- **Atoms** — the smallest indivisible presentational units: a button, input, label,
  icon, badge, dot, divider, spinner, meter bar. Atoms live in `components/ui/`
  (`Button.tsx`, `StatusDot.tsx`), icons in `components/ui/icons/`. They take only
  presentational props, hold no domain logic, and never emit raw `<svg>`.
- **Molecules** — a small reusable composition of atoms forming one labelled unit: a
  setting row, a status banner, a card header, an empty-state block, a pill. Molecules
  live in `components/ui/` when reused across two+ domains; otherwise as a subcomponent
  under the parent domain folder.
- **Organisms** — a self-contained domain section composed of molecules and atoms: a
  card, a list, a settings panel, a detail view. Organisms live in their domain folder
  and are where domain logic / state wiring is allowed.

Rules that fall out of this:

- **Never inline a lower-tier shape.** Writing the markup for an atom or molecule
  inside an organism is a duplication bug, even on first use — import it, or extract
  it if it doesn't exist yet.
- **Build bottom-up.** A new organism is assembled from existing atoms/molecules. If
  a needed primitive is missing, create it in `components/ui/` first, then compose.
- **One tier per file:** an atom file exports one atom, a molecule file one molecule.

## Reuse before you build

- **Before writing any raw markup, search `components/ui/` (and the parent domain
  folder) for a component that already renders it.** If one exists, import it — never
  re-implement its markup at a call site.
- **The moment the same shape would appear a second time, extract it** into one
  component. Two copies is the trigger — don't wait for a third.
- **Don't introduce a bespoke element where a primitive is the right tool** (sliders,
  selects, dialogs, radio groups, meters, dividers, section labels, icons). Raw
  buttons/inputs standing in for an existing primitive are forbidden.
- Re-export every primitive from `components/ui/index.ts` so imports are one line.
- Primitives are pure presentation — no state machines, no I/O, no hooks beyond local
  interaction state. Interactive primitives wrap the chosen headless-UI library and
  are styled only with design-system tokens; never import the library's default CSS.

## Build from the inventory — when a design study exists

If the UI being built comes from a settled design study, its component inventory
(`docs/designs/<study>.inventory.md`, produced by `/componentize-design`) is the
build contract:

- **Names are fixed by the inventory.** The component's name, tier, and props come
  from its inventory row — don't rename, re-tier, or re-shape mid-build.
- **A component that isn't in the inventory doesn't get built** off a study;
  update the inventory first (one row), then build. This keeps the study, the
  inventory, and the codebase telling one story.
- Never derive a component by copying study markup — rebuild from tokens and
  existing primitives (the study is a spec, per `design-studies.md`).

## Icons — one icon component per file

**No inline SVGs anywhere.** Every SVG icon is its own named component in
`components/ui/icons/`, re-exported from its barrel. Each file exports exactly one
component, accepts optional `width`/`height`/`className`, and defaults to its original
size. Plain-text glyphs standing in for icons (`✕`, `→`) are forbidden — use the icon
atom.

## Screens — container/View split

Every screen is two files: a thin **container** (`CheckoutScreen.tsx` — hooks, data
fetching, store wiring; ~10 lines) and a pure presentational **View**
(`CheckoutScreenView.tsx` — props in, JSX out).

- **The View never imports data access.** No API client, no data bridge, no store
  hooks — it receives everything through props. All wiring lives in the container,
  which does nothing but wire and render `<XView {...props} />`.
- Fixtures are typed off the container's own view-model types and live next to the
  screen — shape drift is a compile error, never a silent stale fixture.

> If/when this project adds Storybook: one story per PRD/spec state, rendering the
> View with typed fixtures; stories prove composition and visual state only — they
> never replace e2e wiring checks of the container.
