---
name: prototype-to-design
description: Turn an agreed prototype variant into the approved design — values snapped to the token contract, a render committed beside it. Once per screen, before any code. Use when the user picks a variant ("variant A looks right", "go with the second one"), wants a design approved or settled, or asks what to do with a finished prototype.
---

# Prototype To Design

`/prototype` explores. This approves **one** of what it explored, and leaves on `main`
the two artifacts everything downstream needs: an **HTML design** that speaks only the
token contract, and a **render** of it.

Run it **once per screen**. `design-to-code` then runs once per ticket against what
this produces.

## Gate

Needs a prototype whose variant is **agreed**. If the user has not picked one, stop
and ask — approving a screen nobody chose is the one failure this skill can't undo.

If the token contract is missing a whole family the prototype uses (no typography
roles at all, no spacing steps), stop and ask the user to run
`/setup-design-foundations` with the prototype as raw material, then come back. **This
skill reconciles a screen against foundations; designing a scale belongs there.**

## 1. Drop the losing variants

The agreed variant only. Delete the others, the variant switcher, and the URL
plumbing that selected them.

Keep, and carry forward, anything the prototype learned that is **not** visible in the
winning render — a fact the data exposed, a case that overflowed, a figure that turned
out unavailable. Those go in the report at step 6; they are the reason the prototype
was built and they are invisible in a PNG.

**Keep every state reachable by URL.** A prototype that showed error/empty/loading via
a search param keeps that — those states are what `design-to-code` extracts against and
what `pixel-review` judges. A state you cannot link to is a state nobody re-checks.

## 2. Dump every raw value

Per family — colors, font sizes, spacing, radii, durations:

```bash
grep -oE 'font-size:\s*[^;]+' <prototype>.html | sort | uniq -c | sort -rn
```

Include values inherited from a hand-written stylesheet, not just inline ones.

## 3. Snap or promote — nothing stays raw

For each distinct value, exactly one of:

- **Snap** to the nearest existing token. Exploration jitter (11 vs 11.5px) collapses
  here, and **the token keeps its clean value** — never inherit the prototype's jitter.
- **Promote** to a new token, named by *role*, never by value (`--text-label`, not
  `--text-10-5`). Typography roles are full tuples: size + line-height + weight +
  tracking.

A promotion is a **contract change**: a mini `setup-design-foundations` bless, shown to
the user before it lands, in all theme variants, with its framework wiring in the same
change.

**Show the user the snap/promote table before proceeding.** Collapsing near-duplicate
values changes how the screen looks in the small; they should see what moved.

## 4. Write the design

Move the winner to `docs/designs/<screen>.html`, from `design-template.html`:

- imports `docs/designs/tokens.css` — the mirror of the real contract, so the design
  cannot say anything the app can't;
- **every** value via `var(--token)` or a role class; no literals survive step 3;
- every meaningful region carries `data-component="PascalCaseName"`. Those names are
  **frozen** — they become component files and ticket titles, and renaming later is a
  migration;
- repeated shapes call a named render function in `kit.js` rather than copying markup.

Then add the front matter that says what this file is:

```html
<!-- status: approved
     approved-at: <commit>
     prototype: <throwaway branch> -->
```

Three values, in order: **`approved`** (agreed, not yet in the app) → **`built`**
(`design-to-code` finished the screen) → **`stale`** (the app has since changed this
screen without coming through here).

**Stale is fine** — labelling it beats pretending. A stale design is **re-based before it is edited, never after**. Re-basing
means screenshotting the shipped screen, correcting the design to match, and only then
exploring. Editing a stale design silently reverts whatever shipped since.

## 5. Render it

Screenshot the design via the render method in `docs/designs/stack.md`, and commit the
PNG beside the HTML. One per state if the screen has several.

**The PNG is the artifact that gets linked and judged** — tickets link it, `pixel-review`
judges against it, humans open it. The HTML is there so the screen can be explored
again later without starting over.

## 6. Report

- The snap/promote table, and any token that landed in the contract.
- **The measurements the tickets must carry** — the numbers this screen settled that
  prose would lose. A ticket that states them can fail review for getting them wrong;
  one that links only an HTML file cannot.
- What the prototype exposed that the render doesn't show (step 1).
- Where the design and its PNG live, and the next step: `/to-tickets`, then
  `design-to-code` per ticket.
