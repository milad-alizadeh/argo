---
name: componentize-design
description: Turn a settled HTML design study into properly componentized app code — settle its raw values into the token contract, assemble the screen from existing primitives against a derived view-model, then extract components only where reuse or unexercised states justify it, storying the screen plus each extracted component. Use when the user wants to build a design, componentize or settle a study, or transfer a design study HTML file into the app.
---

# Componentize Design

Input: one settled study in the repo's design-studies directory (see the
`design-studies` rule — typically `docs/designs/`). Output: the screen assembled
from existing primitives against a derived view-model, with a written inventory of
the components extraction actually justified as the durable contract. The HTML is
visual truth; the inventory is build truth — a component exists because evidence in
the assembled screen forced it out, never because the HTML was eyeballed for
boundaries up front.

The study is a **disposable spec, not source**. Its markup and CSS are never
ported; only its decisions survive, as tokens and inventory rows.

**This screen-first order is for building application screens.** If the deliverable
is a reusable cross-app component library, or the inventory is already empirically
known, or multiple teams need frozen contracts before building, build inventory-first
bottom-up instead.

## 1. Settle the tokens — no code yet

The study was allowed to invent values while exploring. Before anything is built,
every raw value in it must either **snap** to an existing token or be **promoted**
to a new named one. Nothing stays raw.

**Foundations first.** This step *reconciles a screen against existing
foundations* — it never designs a scale. If the contract is missing a whole
family the study uses (no typography roles at all, no spacing steps), stop and
run the `design-foundations` skill with this study as raw material, then come back.

1. Locate the token contract: the file the `design-system` rule names as the
   single source of raw values (the CSS custom-property file feeding Tailwind's
   `@theme`, a Tamagui `createTokens` source, or the project's DTCG `tokens.json`).
2. Dump the study's used values (colors, font sizes, spacing, radii, durations) —
   e.g. `grep -oE 'font-size:\s*[^;]+' <study>.html | sort | uniq -c` and
   equivalents per property.
3. For each distinct value: **snap** it to the nearest existing token (exploration
   jitter — 11px vs 11.5px — collapses here; the token keeps its clean value,
   never inherit the study's jitter), or **promote** it to a new token
   named by *role*, never by value (`--text-label`, not `--text-10-5`). Typography
   roles are full tuples: size + line-height + weight + tracking. A promotion is
   a contract change — a mini `design-foundations` bless, shown to the user
   before it lands.
4. Land promotions in the token contract (all theme variants) and its framework
   wiring in the same change.

Show the user the snap/promote table before proceeding — collapsing near-duplicate
values changes how the built UI looks in the small; they should see what moved.

## 2. Assemble the screen skeleton — real structure, no new components

Build the screen top-down from what already exists: kit primitives, existing
`shared/ui` atoms, and a **derived view-model** — a pure `derive(facts)`, the same
pattern as `shipState(facts)`. Write the markup inline in the screen View. Do not
author new named components yet; no stories yet. Variation and state live in the
view-model and region-local state, never flattened props threaded down. Settle raw
values against the token contract as you go (step 1's snap/promote rules still apply).

The skeleton is done when the screen renders its happy path from primitives plus
the view-model, with no net-new named component authored.

## 3. Extract by evidence — then write the inventory

Extract a block into a named component when **any** is true; else it stays inline:

- **Repetition** — the same markup appears a second time within the screen (rule of
  two/three).
- **Known cross-screen unit** — a shape the design system reuses across screens
  (card, badge, status, empty-state, drawer header), even at one occurrence here.
- **Unexercised states** — states the happy path doesn't render (error / empty /
  loading / overflow) that need their own coverage.

A single-use, single-state, trivial block — a primitive with hardcoded children — is
**not** extracted; inline it in its one caller.

Write the inventory **from these extractions** (`<study>.inventory.md`, linked from
the design README), one row per extracted component:

| Column | Meaning |
|---|---|
| name | component name = the file to create |
| tier | atom / molecule / organism — a **label applied at extraction**, not a schedule |
| domain | `shared/ui` if it renders across regions, else `domains/<region>` (per CONTEXT.md's Panes) |
| props | the surface the skeleton proved — every prop, its type, enum variants, states |
| composed-of | which lower-tier components it renders |
| source | anchor in the study: its `data-component` attribute, else a CSS class (e.g. `.srow`) |

Names are frozen once written — renaming later is a migration, not a whim.

Show the user the inventory **and which blocks stayed inline**, and get a nod —
this is the one checkpoint; everything after is mechanical.

## 4. Harden — story and test what was extracted, plus the screen

For each extracted component: build or relocate it per the `ui-components` +
`design-system` rules — tokens only, one tier per file, kit primitives adapted not
re-authored, re-exported from the UI barrel, placed by its `domain` — with a
colocated `*.stories.tsx` covering the states it actually has (union → one story +
`select` control + gallery; boolean → its non-default side; a prop forwarded
untouched is not storied here — it belongs to the child).

**Always** write a screen-level story for the assembled View: compose its args from
the child stories, and keep connected/data logic in a wrapper outside Storybook.
This screen story is the visual-regression baseline for every region that stayed
inline; extracted components add their own.

## 5. Verify — never self-review

The screen is not signed off by the agent that built it. First make the mechanical
gates green (the repo's lint and test commands, wrapped per its tooling rules; the
design-token check if installed). Then hand both judgments to fresh eyes, the way the
`implement` skill hands its diff to `code-review`:

- **Pixels** — the `visual-verify` skill: a fresh agent judges the built screen
  against the study and foundations. Divergence is fixed in the component, or in the
  study if the design was wrong, in the same change.
- **Conversion judgment** — the `review-componentization` skill: a fresh agent judges
  the extractions, altitude, naming, snap/promote, and stories against the UI rules.

Resolve every finding from either lens the way that skill directs.

The screen is done when the mechanical gates are green, both fresh-eyes reviews have
run, and every finding is fixed-and-re-judged or rejected with a cited rule.
