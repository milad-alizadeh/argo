---
paths:
  - "docs/designs/**"
  - "{{RENDERER_GLOB}}"
---

# Design Studies

High-fidelity UI design studies — the HTML designs you produce while exploring
a screen's layout, palette, or interaction model — are a **committed repo artifact**,
not scratch files.

**This file's spelling is HTML studies in `docs/designs/` plus four named skills
(`frontend-design`, `setup-design-foundations`, `design-to-code`, the kit); its rules are
the intents.** On a stack whose studies take another form (a Storybook playground, a Figma
file, RN screens behind a dev flag), or a repo where those skills aren't installed, rewrite
the mechanism and keep the intents (`setup-rules` §3):

1. exploratory designs are **committed and indexed**, never left in scratch space;
2. the directory holds the **agreed-latest** set only — superseding deletes;
3. studies are authored **from the token contract and the component tiers**, so they
   transfer; a value the contract lacks is a *proposal*, snapped or promoted on settling;
4. a settled study is a **spec, never a source** — the app is rebuilt from tokens and
   components, and disagreement between app and settled study is fixed in the same change.

A named skill that isn't installed here degrades to its manual step ("extract the
inventory table by hand"), stated in this file — never to a pointer at a skill the agent
can't run (`setup-rules` §5a: a rule naming a thing that doesn't exist here).

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

## Component-first authoring — designs must transfer

Studies are authored the way the app is built (atoms → molecules → organisms →
screen), so a settled design can be rebuilt in any target without reverse-engineering
the markup:

- **Tokens first.** Start every study from the token vocabulary mirrored from
  `{{TOKENS_CSS}}` — no bespoke hex/px for a value a token already covers.
  Exploring a value the contract doesn't have yet is allowed (that's what studies
  are for), but it's a **proposal**: it either snaps to an existing token or gets
  promoted to a named one when the study settles, never ported raw.
- **Foundations before screens.** The ramps themselves (type roles, spacing,
  radii, color roles) are designed once via the `setup-design-foundations` skill and rendered
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
  inventory, not the HTML, is the build contract; the `design-to-code` skill consumes it
  to scaffold the real components.

## The study is a spec, never a source

A study's markup and CSS are disposable. Building a screen means running
the `design-to-code` skill — settle values into the token contract, extract the
inventory, rebuild from tokens + existing components — never copying study markup
or styles into the app. When the app and a settled study disagree, fix whichever
is wrong *in the same change*; don't let them drift apart silently.

## Why not scratchpad

The harness default sends temp files to a session scratchpad that is later cleaned up.
Design decisions are durable team artifacts — they belong in version control where every
agent and teammate on the repo can open them, diff them, and build the real UI from them.
