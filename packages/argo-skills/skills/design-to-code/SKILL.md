---
name: design-to-code
description: Build a screen from its approved design ticket, once per build ticket. Use for any UI ticket whose screen has a design ticket, even when the user says "implement" or "build" without naming it.
---

# Design To Code

Input: one approved design (from `prototype-to-design`) and its state renders. Output: the screen
assembled from existing primitives against a derived view-model, plus an inventory of the
components extraction actually justified. The design is a disposable spec, not source: its
decisions survive as tokens and inventory rows, its markup does not.

**Where the input is.** The **durable** half is the design ticket, carrying the measurements, the
frozen component names and the state renders. The **throwaway** half is its page, alone at the
root of `design/#<N>-<screen>`, read without a checkout:

```sh
git fetch origin 'design/#<N>-<screen>'
git show FETCH_HEAD:design.html > "$TMPDIR/<screen>.html"
```

`FETCH_HEAD`, not the branch name: a fetch of one branch writes no local head, so
`design/#<N>-<screen>` resolves to nothing and the failure reads exactly like a reaped branch.
The page is self-contained, so that one file opens over `file://` as the design.

A branch that is gone is the process working, not an input that is missing: the screen shipped
and the sweep reaped it. The ticket is then the whole spec, which is why the measurements were
written there. Build from it.

## 0. Read the stack

`docs/design-stack.md` answers four questions for this repo: where the token contract
lives, where components live and how to choose between locations, what the isolated-state
mechanism is (a story, a specimen case, a preview), and how to render a state. Every step
below defers to it. If the file is missing, answer the four questions from what the repo
shows, say so in the report, and suggest `/setup-design-infra`.

Done when you hold the four answers.

## 1. Confirm the design is current

If the design ticket carries a `stale` label, re-base it first (`prototype-to-design`, step 4).
A raw value appearing in this build is a build bug, not a decision to make now: snap it and
say so.

Done when the ticket is open and unlabelled `stale`.

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

Write the inventory as a comment on **this build ticket**, one row per extracted component. What
was extracted and why is a property of this build, so it is recorded against this build:

| Column | Meaning |
|---|---|
| name | component name = the file to create, from the ticket's frozen `data-component` names |
| tier | the project's altitude label per `docs/design-stack.md`, applied at extraction |
| location | which of `docs/design-stack.md`'s component locations, and why |
| props | the surface the skeleton proved: every prop, its type, variants, states |
| composed-of | which lower-tier components it renders |

Show the user the inventory and which blocks stayed inline, and get a nod.

## 4. Harden

Build or relocate each extracted component per the target repo's `rules/`, placed by its
`location`, with a colocated isolated-state case per `docs/design-stack.md` for the
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

## 6. Close the design ticket

The build tickets are sub-issues of the design ticket, so "the last one" is a question for the
tracker: no other sub-issue of `#<N>` is still open. When this one is the last, **close the
design ticket**, naming the commit that finished the screen. That one act retires both halves:
the ticket's state now reads "shipped", and the sweep reaps `design/#<N>-<screen>` on its next
run because the number in the branch name points at a closed issue.

**Close it after the PR merges, not before.** The sweep runs at the end of every session, and a
design ticket closed while the PR is still in review takes the page with it, exactly when a
review round asking for a pixel change would want it.

Closing is the whole step: the branch carries its own expiry in its name, so nothing else has to
be updated or remembered.

A shipped screen keeps no page. Re-opening the design re-bases it against the shipped app
(`prototype-to-design`, step 4), which screenshots what actually ships, so a kept page would add
nothing a re-base would not read for itself.

Done when the design ticket is closed and names the finishing commit.
