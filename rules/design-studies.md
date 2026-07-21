---
paths:
  - "docs/designs/**"
  - "apps/desktop/src/renderer/src/**/*.{css,tsx,jsx}"
---

# Design Studies

High-fidelity UI design studies — the HTML designs you produce while exploring
a screen's layout, palette, or interaction model — are a **committed repo artifact**,
not scratch files.

## Rule — studies live in `docs/designs/`, committed

- When you generate an HTML design study (via `frontend-design`, `prototype`, an ad-hoc
  mockup, or a fan-out design pass), write the keepers to `docs/designs/`, not to a
  temp/scratchpad directory. Scratchpad output gets swept — anyone else on the repo then
  can't see the design you settled on.
- `docs/designs/` holds only the **agreed-latest** set. When a study supersedes an
  earlier one, delete the stale file in the same change — don't accumulate v1…v7. A
  reader opening the directory should see the current direction, not the archaeology.
- Keep a `docs/designs/README.md` index: one row per file (screen · what it is). Update
  it whenever you add or prune a study.
- `docs/` is excluded from the code knowledge graph (`.graphifyignore`), so committing
  HTML studies here never pollutes the graph.

## Component-first authoring — designs must transfer

Studies are authored the way the app is built (atoms → molecules → organisms →
screen), so a settled design can be rebuilt in any target (Electron/shadcn, web,
React Native) without reverse-engineering the markup:

- **Tokens first.** Start every study from the token vocabulary mirrored from
  `argo-tokens.css` — no bespoke hex/px for a value a token already covers.
  Exploring a value the contract doesn't have yet is allowed (that's what studies
  are for), but it's a **proposal**: it either snaps to an existing token or gets
  promoted to a named one when the study settles, never ported raw.
- **Foundations before screens.** The ramps themselves (type roles, spacing,
  radii, color roles) are designed once via the `design-foundations` skill and rendered
  as `docs/designs/foundations.html` — the one **non-disposable** study: it
  styles only via `var(--token)`, so it always renders the current contract.
  Screen studies follow it; they propose, they never redefine.
- **Name every region.** Each meaningful region carries a stable
  `data-component="SessionRow"` attribute (PascalCase, the future component's
  name). This name survives into the inventory, the codebase, stories, and
  tickets — it is decided once, in the study.
- **Compose from a kit.** Recurring atoms/molecules are named render functions taking
  an explicit props object (shared `docs/designs/kit.js`, script-included); a study
  calls them, never re-writes their markup. New primitive → add to the kit first,
  then compose. Same tiering as `ui-components.md`.
- **Ship the inventory.** A settled study carries a component-inventory table —
  name · tier · props/variants · composed-of — next to it in `docs/designs/`. The
  inventory, not the HTML, is the build contract; the `componentize-design` skill consumes it
  to scaffold the real components.

## The study is a spec, never a source

A study's markup and CSS are disposable. Building a screen means running
the `componentize-design` skill — settle values into the token contract, extract the
inventory, rebuild from tokens + existing components — never copying study markup
or styles into the app.

## Drift — the inventory carries a Status column

A big screen ships row by row over many tickets, so its study is authoritative for the
regions not built yet and stale for the ones that are. The inventory says which, per row:

- **`spec`** — no component yet. The study region is truth; a design change means editing
  the study HTML, which is what the study is for.
- **`partial · <path>`** — the component exists but doesn't cover the row. Code is truth for
  what it renders, the study for the rest; the row's Notes name what's outstanding.
- **`built · <path>`** — the component and its stories are truth. A decision made while
  implementing lands in the **inventory row** — its name and props become whatever the code
  says, freezing having applied only up to `spec`. The study region is frozen reference and
  is allowed to go stale.

Pay to update a settled study's HTML in exactly one case: when a `built` region's drift would
mislead a still-`spec` neighbour — a changed shell, split ratio, or row height that unbuilt
regions are laid out against. Cosmetic divergence inside a built region costs nothing and is
not worth a 100 KB edit.

Two corollaries, both cheap and both mandatory in the same change as the code:
a component that exists with no inventory row gets one (the row is how it becomes findable),
and a row whose built name diverged from the study proposal keeps the old name in its Notes
so the study anchor stays greppable.

## Why not scratchpad

The harness default sends temp files to a session scratchpad that is later cleaned up.
Design decisions are durable team artifacts — they belong in version control where every
agent and teammate on the repo can open them, diff them, and build the real UI from them.
