---
name: componentize-design
description: Turn a settled HTML design study into properly componentized app code — settle its raw values into the token contract, extract a component inventory (atoms → molecules → organisms → screen), then scaffold each tier bottom-up with typed Views and Storybook stories that cover every prop. Use when the user wants to build a design, componentize or settle a study, or transfer a design study HTML file into the app.
---

# Componentize Design

Input: one settled study in the repo's design-studies directory (see the
`design-studies` rule — typically `docs/designs/`). Output: the design rebuilt as
real components in dependency order, with a written inventory as the durable
contract. The HTML is visual truth; the inventory is build truth — never build a
component by eyeballing the HTML and guessing its boundaries.

The study is a **disposable spec, not source**. Its markup and CSS are never
ported; only its decisions survive, as tokens and inventory rows.

## 1. Settle the tokens — no code yet

The study was allowed to invent values while exploring. Before anything is built,
every raw value in it must either **snap** to an existing token or be **promoted**
to a new named one. Nothing stays raw.

**Foundations first.** This step *reconciles a screen against existing
foundations* — it never designs a scale. If the contract is missing a whole
family the study uses (no typography roles at all, no spacing steps), stop and
run `/design-foundations` with this study as raw material, then come back.

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
   a contract change — a mini `/design-foundations` bless, shown to the user
   before it lands.
4. Land promotions in the token contract (all theme variants) and its framework
   wiring in the same change.

Show the user the snap/promote table before proceeding — collapsing near-duplicate
values changes how the built UI looks in the small; they should see what moved.

## 2. Inventory — still no code

Read the study, the design-studies README, the token contract, and the repo's
`ui-components` rule. Decompose the screen into one table row per component:

| Column | Meaning |
|---|---|
| name | component name = the file to create (or the existing one to reuse) |
| tier | atom / molecule / organism / screen |
| props | full contract: every prop, its type, enum variants, states |
| composed-of | which lower-tier rows it renders |
| reuse | how the row is sourced — resolves to exactly one of the three values below |
| domain | target folder the row is born into (`shared/ui` or `domains/<region>`) |
| source | anchor in the study: its `data-component` attribute, else a CSS class (e.g. `.srow`) |

**`reuse` and `domain` are the reconciliation this step exists for.** Every row
resolves both before the checkpoint — reuse against what already exists, domain
against where the row renders — so the build starts from a reconciled table, not
net-new components authored by reflex.

- **`reuse` — one of exactly three values, per row:**
  - `reuse:<existing primitive>` — an existing component already renders this shape;
    point the row at it and don't re-author. Search `shared/components/ui/` and the
    owning region's `components/` first.
  - `kit:<name>` — your configured component kit supplies it (the kit the
    `ui-components` rule names — its `{{COMPONENT_KIT}}` value, not a kit this skill
    hardcodes). Pull the primitive from the kit and **adapt its variant map to the
    token contract**; a hand-rolled equivalent beside a kit primitive is a duplication
    bug.
  - `new — <one-line why nothing covers it>` — nothing above fits. **A `new` row
    cannot omit the justification clause** — the one line arguing why no existing
    primitive and no kit component covers it is what makes hand-rolling the argued
    exception rather than the reflex.
- **`domain` — the target folder, derived not chosen.** A framework primitive shared
  across regions is `shared/ui`; a component that belongs to one Pane/region is
  `domains/<region>` (the region it renders in, per CONTEXT.md's Panes). This one
  value drives both the file path in step 4 and the story title's top segment (per
  the `ui-components` rule's `title == top domain folder`), so it is settled here, once.
- **Every repeated shape in the HTML is one row**, listed once.
- **Props come from the study itself** — its data objects (e.g. a `SESSIONS`
  array) and its CSS variant classes (`.sel`, `.amber`, …), not from guesses. A
  variant class is an enum prop; a data field is a value prop.
- **Names are frozen here.** The name in this table is the component's name in
  the codebase, in stories, and in tickets — renaming later is a migration, not
  a whim.

Write the table next to the study (`<study>.inventory.md`, linked from the design
README). **Show the user the inventory and get a nod before scaffolding** — this
is the one checkpoint; everything after is mechanical. **The checkpoint blocks on
both new columns being filled:** every row has a resolved `reuse` (one of the three
values, and no `new` row without its justification clause) and an assigned `domain`.
An unreconciled row — blank reuse, or a bare `new` — is not ready to build.

## 3. Ticket or build

Two ways to consume the inventory — pick with the user:

- **Build now** (default for a single screen): continue to step 4 in this session.
- **Ticket it** (bigger surface, or work split across sessions/agents): run
  `/to-tickets` over the inventory. One ticket per organism/screen; shared new
  atoms/molecules become their own tickets, `Blocked by:` edges follow
  `composed-of`. Because names and tokens are already frozen, build each ticket
  with `/implement` — one ticket per fresh context, in dependency order. Each
  ticket body links the study file, the inventory row, and the token contract — a
  fresh context needs nothing else.

## 4. Build bottom-up

Strict order: atoms → molecules → organisms → screen View. Never start a row
before its `composed-of` rows are done. For each row:

1. The component, per the repo's `ui-components` + `design-system` rules: tokens
   only, one tier per file, interactive primitives wrap the project's headless-UI
   library, re-export from the UI barrel. **Place the file by its `domain` value** —
   a `shared/ui` row is born in `shared/components/ui/`, a `domains/<region>` row in
   `domains/<region>/components/` — never a flat `components/` dump. The story
   title's top segment then equals that domain folder (per `ui-components`), so
   placement and taxonomy both fall out of the inventory with no further judgment.
   A `reuse:`/`kit:` row builds nothing net-new: import the existing primitive, or
   pull the kit component and adapt its variant map — only a `new` row authors a file.
2. Colocated `*.stories.tsx` per the Storybook section of the `ui-components`
   rule (when the project has Storybook): **every prop covered, but as an axis
   rather than a story each** — a union gets one story plus a `select` control and
   one gallery, a bounded number a range control, a boolean its non-default side.
   Story only what this tier *adds*, never a prop it forwards to a child untouched,
   and nest a single-owner part under its owner's title.
3. Tick the row in the inventory before moving up a tier.

The screen ships as container/View; only the **View** comes from the design — the
container wires real data later and is out of scope here.

## 5. Verify against the design

- Screenshot the study headless (Chrome command in the design README) and the
  built screen/story; compare side by side. Divergence is fixed in the component —
  or, if the design was wrong, in the study, in the same change.
- Run the repo's lint and test commands (wrapped per the repo's tooling rules);
  if a design-token check script is installed, it must pass.

A row is done only when: component + every prop covered by a story or a control +
visual parity + green checks.
