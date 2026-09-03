---
paths:
  - "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/**/*.swift"
---

# UI Component Rules

Applies to every view in `ArgoUI`, read with `design-system.md` (the token contract) and
`swift-style.md` (the SwiftUI spelling).

## Three tiers, decided before the `body` is written

- **Atoms**: the smallest presentational units (a chip, a dot, a glyph, a separator). They
  take only presentational parameters, hold no domain logic, and read no shared state.
- **Molecules**: a small composition of atoms forming one labelled unit (a row header, a
  toolbar segment, an empty-state block).
- **Organisms**: a self-contained section (the feed, the roster, a deck zone), and the only
  tier where domain shape is allowed.

Never inline a lower-tier shape inside a higher one, even on first use: call it, or extract it.
One tier per file, named for the type it exports. Assemble the screen first and extract on
evidence (`design-to-code`); this is assembly order, not a mandate to author atoms ahead of
the screen that needs them.

## Reuse before you build

- Before writing any layout, look for a view that already renders it.
- The moment the same shape would appear a second time, extract it. Two copies is the trigger.
- Don't hand-roll what the platform provides. A `Menu`, `Popover`, `Table`, `Divider` or
  disclosure is reached for before a bespoke equivalent, which loses keyboard handling and
  accessibility. Restyle the system control through the contract instead.

## Every control is a real control

Full Keyboard Access is the contract and the app builds no ring of its own (#718). A control
reachable only with that setting on is not a bug. Four rules hold that up:

- A `Button`, `Menu`, `Picker` or `TextField`, never a shape with an `onTapGesture`. A tap
  gesture is allowed only as a pointer-only layer over something the keyboard already reaches
  another way, and says which way in a comment.
- `.focusable()` is for a key the control would not otherwise get (Escape on something it
  opened, arrows across a zone), never for a Tab stop. Each use names its key.
- A focusable that can show focus draws `argoFocusRing`, never the system effect. A focusable
  that covers its own zone is ringless and says so.
- A command with a platform convention is bound to its key (⌘N, ⌘R, ⌘⌫, ⌘I, Return, Escape)
  and lives in a `Commands` menu, unless it is anchored to a control on screen, where it rides
  the control and both `.help` and the accessibility label name the key. Never invent a key.

## Screens: container / View

Every screen is a thin **container** that resolves state and a pure **View** that takes a
view-model value and draws it. The View never reads a store, an engine or the Hub; its
initialiser parameters are its whole input. Fixtures are typed off the projection's own
types. Mechanically: `scripts/swift-boundaries.sh` permits exactly one file in `ArgoUI` to
read live Hub state.

## Coverage: a state with no render is a state nobody has looked at

Every view ships previews for the states it can be in, and every state worth a screenshot
gets a `SpecimenEntry` (`designs.md`). **A render is an axis, not a value:**

| Parameter | Shape |
|---|---|
| Continuous (a count, free text) | one render at a representative value |
| Discrete union (tone, status, kind) | one gallery rendering every value side by side |
| Boolean that changes the layout | the non-default side only |
| Structural (loading / empty / error / populated) | one each |

Behavioural edges (clamping, truncation) belong in a unit test. An empty required value is
invalid input, not a variation. A width is part of the state for anything laid out in columns
(`ARGO_WINDOW_SIZE`).

**A parent covers only what it adds.** A case that differs from the base only by a parameter
the parent passes through untouched belongs to the child. A parent's own cases are what
composition creates: which child renders, wiring that spans two children, layout under
pressure, its own state. Name a case for what a human sees, never an internal matrix id.

## Naming follows the tree

A view with exactly one caller is that organism's part and nests under it. A part picked up
by a second region is promoted, and that move is the promotion.
