---
name: design-to-code
description: Build a screen from its approved design in docs/designs/, once per ticket. Use for any UI ticket whose screen has a design there, even when the user says "implement" or "build" without naming it; a screen built without its design loses the measurements the design carries.
---

# Design To Code

Input: one approved design in `docs/designs/` (from `prototype-to-design`) and its render.
Output: the screen assembled from existing primitives against a derived view-model, plus an
inventory of the components extraction actually justified. The design is a disposable spec,
not source: its decisions survive as tokens and inventory rows, its markup does not.

## 0. Read the stack

`docs/designs/stack.md` answers four questions for this repo: where the token contract
lives, where components live and how to choose between locations, what the isolated-state
mechanism is (a story, a specimen case, a preview), and how to render a state. Every step
below defers to it. If the file is missing, answer the four questions from what the repo
shows, say so in the report, and suggest `/setup-design-infra`.

Done when you hold the four answers.

## 1. Confirm the design is current

If its front matter reads `status: stale`, re-base it first (`prototype-to-design`, step 4).
A raw value appearing in this build is a build bug, not a decision to make now: snap it and
say so.

## 2. Assemble the screen skeleton

Build the screen top-down from what already exists: kit primitives, existing shared atoms,
and a derived view-model, a pure `derive(facts)`. Write the markup inline in the screen view.

Done when the screen renders its happy path from primitives plus the view-model, with no
net-new named component authored.

## 3. Extract by evidence, then write the inventory

Extract a block into a named component when any is true, else it stays inline:

- **Repetition**: the same markup appears a second time within the screen.
- **Known cross-screen unit**: a shape the design system reuses (card, badge, status,
  empty-state, drawer header), even at one occurrence here.
- **Unexercised states**: states the happy path doesn't render that need their own coverage.

Write the inventory from these extractions (`<design>.inventory.md`, linked from the designs
README), one row per extracted component:

| Column | Meaning |
|---|---|
| name | component name = the file to create, from the design's `data-component` |
| tier | the project's altitude label per `stack.md`, applied at extraction |
| location | which of `stack.md`'s component locations, and why |
| props | the surface the skeleton proved: every prop, its type, variants, states |
| composed-of | which lower-tier components it renders |

Show the user the inventory and which blocks stayed inline, and get a nod.

## 4. Harden

Build or relocate each extracted component per the `ui-components` and `design-system`
rules, placed by its `location`, with a colocated isolated-state case per `stack.md` for the
states it has. Add a screen-level case for the assembled view, composed from the child
cases, with connected logic in a wrapper outside it.

Done when every inventory row has a file at its `location` and an isolated-state case, and
the screen-level case renders the assembled view.

## 5. Verify

Make the mechanical gates green (lint, tests, the no-raw-values check), then run
`pixel-review`. Divergence is fixed in the component, or in the design if the design was
wrong, in the same change.

Done when the gates are green, `pixel-review` has run, and every finding is fixed and
re-judged or rejected with a cited rule.

## 6. Mark the design

When this ticket was the last one against the design, set its front matter to
`status: built` and record the commit.
