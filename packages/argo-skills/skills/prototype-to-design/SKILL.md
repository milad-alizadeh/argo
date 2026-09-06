---
name: prototype-to-design
description: Approve one prototype variant as the design, once per screen, before any code. Use when the user picks a variant ("go with the second one"), asks for a design to be approved, or asks what to do with a finished prototype.
---

# Prototype To Design

`/prototype` explores. This approves one of what it explored and splits the result in two: an
HTML design that speaks only the token contract, which **stays on the throwaway branch**, and
the durable record — a design `.md` and a render per state — which lands on `main`.
`design-to-code` then runs once per ticket against them.

**The page never lands on `main`.** A page on `main` is a live file with an owner, and it goes on
being edited long after the screen it describes has shipped. It is worth having only while the
screen is being built, which is exactly as long as the branch lives.

A prototype settles one of two things. Unsettled *behaviour* ("does this state model work?")
goes `/prototype` → `/handoff` → `/to-spec`, and never through here. Unsettled *appearance*
("what should this screen look like?") goes `/prototype` → here → `/to-spec` → `/to-tickets`
→ `/design-to-code` per ticket → `/pixel-review`, because a UI prototype's decision is a set
of measurements and prose loses every one of them. Both: the behaviour prototype first, cheap
and throwaway, then the appearance route.

## Gate

Needs a prototype whose variant is agreed. If the user has not picked one, stop and ask. If
the token contract is missing a whole family the prototype uses (no typography roles, no
spacing steps), stop and ask the user to run `/setup-design-infra` (phase B) with the prototype
as raw material, then come back.

## 1. Drop the losing variants

Delete the other variants, the switcher and their URL plumbing. Keep every state reachable
by URL: error, empty and loading are what `design-to-code` extracts against and what
`pixel-review` judges. Note what the prototype learned that the render will not show (a fact
the data exposed, a case that overflowed) for step 6.

Done when the file renders only the agreed variant and every state is reachable by URL.

## 2. Dump every raw value

Per family (colours, font sizes, spacing, radii, durations), one list of distinct values,
including values inherited from a hand-written stylesheet.

## 3. Snap or promote, nothing stays raw

For each distinct value, exactly one of:

- **Snap** to the nearest existing token. Exploration jitter collapses here and the token
  keeps its clean value.
- **Promote** to a new token, named by role (`--text-label`, not `--text-10-5`). Typography
  roles are full tuples: size, line-height, weight, tracking.

Show the user the snap/promote table before proceeding; a promotion is a contract change and
lands with its framework wiring in every theme variant.

## 4. Write the design on its own branch

Move the winner to `docs/designs/<screen>.html`, from the design template and token mirror
`docs/designs/stack.md` names (`design-template.html` and `tokens.css` by default):

- every value via `var(--token)` or a role class;
- every meaningful region carries `data-component="PascalCaseName"`. Those names are frozen:
  they become component files and ticket titles;
- repeated shapes call a named render function in `kit.js`.

Commit it to the branch `design/<screen>` and push that branch. A real branch, not a ref outside
the branch namespace: a branch shows in the code host's UI, it clones, and `git switch` reaches
it, where a bare ref needs a hand-written fetch refspec before anyone can read the design.

Add the front matter to the page:

```html
<!-- status: approved
     approved-at: <commit>
     prototype: <throwaway branch> -->
```

Done when `design/<screen>` is pushed, the no-raw-values check passes on the file and every
region has a `data-component`.

## 5. Render it, and write the record on `main`

Screenshot the design via the render method in `stack.md`. What lands on `main` is the durable
record, and only that: one PNG per state under `docs/designs/<screen>/`, and
`docs/designs/<screen>.md` carrying the measurements, the frozen component names and this front
matter:

```html
<!-- status: approved
     approved-at: <commit>
     prototype: <throwaway branch>
     explorable: design/<screen>
     epic: #<the screen's epic> -->
```

`explorable` names the branch, so `design-to-code` and `pixel-review` can find the page without
being told; `epic` is what `worktrees:gc` keys the branch's deletion on. Neither reader needs a
checkout:

```sh
git show design/<screen>:docs/designs/<screen>.html > "$TMPDIR/<screen>.html"
```

`status` takes three values: `approved` (agreed, not yet in the app), `built` (`design-to-code`
finished the screen — and the branch is now free to go), `stale` (the app has since changed this
screen without coming through here). A `stale` design is re-based before it is edited: screenshot
the shipped screen, correct the design to match, then explore. Once the branch is deleted,
`explorable` reads `gone` and the `.md` and its renders are the whole record — which is why the
measurements go in the `.md` and not only in the page.

Done when `main` carries the `.md` and one PNG per state, and no `.html`.

## 6. Report

- The snap/promote table, and any token that landed in the contract.
- The measurements the tickets must carry: the numbers this screen settled.
- What the prototype exposed that the render doesn't show.
- Where the `.md` and its PNGs live on `main`, the branch the page is on, and the next step:
  `/to-tickets`, then `design-to-code` per ticket.
