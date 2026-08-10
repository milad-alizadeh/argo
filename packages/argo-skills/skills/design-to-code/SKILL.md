---
name: design-to-code
description: Build a screen from an approved design — assembled from existing primitives, components extracted only on evidence. Once per ticket. Use for any UI ticket whose screen has a design in docs/designs/, including when the user says "implement" or "build" without naming the design — a UI ticket built without its design drifts from what was agreed.
---

# Design To Code

Input: one **approved design** in `docs/designs/` (produced by `prototype-to-design`)
and its render. Output: the screen assembled from existing primitives against a derived
view-model, plus a written inventory of the components extraction actually justified.

The HTML is **visual truth**; the inventory is **build truth** — a component exists
because evidence in the assembled screen forced it out, never because the HTML was
eyeballed for boundaries up front.

The design is a **disposable spec, not source**. Its markup and CSS are never ported;
only its decisions survive, as tokens and inventory rows.

Run it **once per ticket**. Several tickets against one design is normal and expected.

**This screen-first order is for building application screens.** If the deliverable is
a reusable cross-app component library, or the inventory is already empirically known,
or multiple teams need frozen contracts before building, build inventory-first
bottom-up instead.

## 0. Read the stack

`docs/designs/stack.md` answers, for this repo: where the token contract lives, where
components live and how to choose between locations, what the isolated-state mechanism
is, and how to render a state. **Every instruction below defers to it.** Where this
skill says "isolated-state case", that file says whether it means a story, a specimen
catalog case, or a preview target.

If `stack.md` is missing, stop and ask the user to run `/setup-design-infra` — the
framework it records is a decision, not something to infer from what happens to be in
the repo.

## 1. Confirm the design is current

If its front matter reads `status: stale`, re-base it first — screenshot the shipped
screen, correct the design to match, then continue. Building from a stale design
silently reverts whatever shipped since it was approved.

Values were settled at approval time, so **there is no token work here**. A raw value
appearing in this build is a bug in the build, not a decision to make now — snap it
and say so.

## 2. Assemble the screen skeleton — real structure, no new components

Build the screen top-down from what already exists: kit primitives, existing shared
atoms, and a **derived view-model** — a pure `derive(facts)`. Write the markup inline
in the screen view. Author no new named components yet; no isolated-state cases yet.

Variation and state live in the view-model and region-local state, never as flattened
props threaded down.

The skeleton is done when the screen renders its happy path from primitives plus the
view-model, with no net-new named component authored.

## 3. Extract by evidence — then write the inventory

Extract a block into a named component when **any** is true; else it stays inline:

- **Repetition** — the same markup appears a second time within the screen.
- **Known cross-screen unit** — a shape the design system reuses across screens (card,
  badge, status, empty-state, drawer header), even at one occurrence here.
- **Unexercised states** — states the happy path doesn't render (error / empty /
  loading / overflow) that need their own coverage.

A single-use, single-state, trivial block — a primitive with hardcoded children — is
**not** extracted; inline it in its one caller.

Write the inventory **from these extractions** (`<design>.inventory.md`, linked from
the designs README), one row per extracted component:

| Column | Meaning |
|---|---|
| name | component name = the file to create |
| tier | the project's altitude label, per `stack.md` — applied **at extraction**, not as a schedule |
| location | which of `stack.md`'s component locations, and why |
| props | the surface the skeleton proved — every prop, its type, enum variants, states |
| composed-of | which lower-tier components it renders |
| source | anchor in the design: its `data-component` attribute, else a CSS class |

Names come from the design's `data-component` attributes and were frozen at approval.
Renaming one is a migration, not a whim.

Show the user the inventory **and which blocks stayed inline**, and get a nod — this is
the one checkpoint; everything after is mechanical.

## 4. Harden — cover what was extracted, plus the screen

For each extracted component: build or relocate it per the `ui-components` and
`design-system` rules — tokens only, one tier per file, kit primitives adapted not
re-authored, placed by its `location` — with a colocated isolated-state case per
`stack.md` covering the states it actually has (union → one case plus a control and a
gallery; boolean → its non-default side; a prop forwarded untouched belongs to the
child, not here).

**Always** add a screen-level case for the assembled view, composed from the child
cases, with connected/data logic in a wrapper outside it. That screen case is the
visual baseline for every region that stayed inline; extracted components add their
own.

## 5. Verify — fresh eyes only

The screen is signed off by an agent that never saw it being built.

First make the mechanical gates green — the repo's lint and test commands, wrapped per
its tooling rules, and the no-raw-values check.

Then hand the pixels to fresh eyes: **`pixel-review`**, judging the built screen
against the approved design's render and the foundations specimen. Divergence is fixed
in the component, or in the design if the design was wrong, in the same change.

The screen is done when the gates are green, `pixel-review` has run, and every finding
is fixed-and-re-judged or rejected with a cited rule.

## 6. Mark the design

When this ticket was the **last** one against the design — the screen is now whole —
set its front matter to `status: built` and record the commit. The lifecycle those
values belong to is defined in `prototype-to-design`.
