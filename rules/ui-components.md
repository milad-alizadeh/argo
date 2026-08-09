---
paths:
  - "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/**/*.swift"
---

# UI Component Rules

Applies to every view in `ArgoUI`. Read together with `design-system.md` (the token contract,
no magic numbers) and `swift-style.md` (how Swift spells the rest).

This is the stack-neutral rule. Its React/shadcn/Storybook spelling retired with the Electron
cockpit and still ships to consumer projects as
`packages/argo-skills/skills/setup-rules/rules/ui-components.md`; what follows is the same
vocabulary in SwiftUI. Where this file says "component", read `View`.

## Atomic design — always (atoms → molecules → organisms)

Every piece of UI is one of three tiers. This vocabulary is what stops rogue, one-off styling
from creeping in. Before writing a `body`, decide which tier the unit belongs to and
build/reuse at that tier.

- **Atoms** — the smallest indivisible presentational units: a chip, a status dot, a label, a
  glyph, a separator, a meter. They take only presentational parameters, hold no domain logic,
  and read no shared state.
- **Molecules** — a small reusable composition of atoms forming one labelled unit: a feed row's
  header, a toolbar segment, an empty-state block, a pill.
- **Organisms** — a self-contained section composed of molecules and atoms: the feed, the
  roster, the evidence panel, a deck zone. This is where domain shape is allowed.

Rules that fall out of this:

- **Never inline a lower-tier shape.** Writing an atom's or molecule's layout inside an organism
  is a duplication bug, even on first use — call it, or extract it if it doesn't exist yet.
- **Build bottom-up.** A new organism is assembled from existing atoms and molecules. This is
  *assembly* order within a build — how tiers stack once a component exists — not a mandate to
  author components ahead of the screen that needs them. For **when** a component is created
  (assemble the screen first, extract on evidence), see `componentize-design`.
- **One tier per file**, and the file is named for the type it exports (`swift-style.md`).

## Reuse before you build

- **Before writing any layout, look for a view that already renders it.** If one exists, call
  it — never re-implement its body at a call site.
- **The moment the same shape would appear a second time, extract it** into one view. Two
  copies is the trigger — don't wait for a third.
- **Don't hand-roll what the platform provides.** A `Menu`, a `Popover`, a `Table`, a
  `Divider`, a disclosure — reach for SwiftUI's before authoring a bespoke equivalent. A
  hand-rolled version of a system control is a bug, not a design choice: it loses keyboard
  handling, accessibility, and every behaviour macOS users already expect. Where the system
  control's look is wrong, restyle it through the contract.
- Views are pure presentation — no I/O, and no state beyond local interaction state.

## All rendered text goes through the type ramp

Typography is a primitive like any other, so it obeys the rule above: **every string the user
reads is set by a role**, never by inheritance. A bare `Text("…")` with no style modifier is
the violation even when it inherits the right type today, because inheritance is exactly what
drifts the moment an ancestor changes.

```swift
Text("14:32")                                    // forbidden — inherits whatever is above it
Text("14:32").font(.system(size: 11))            // forbidden — a size at a call site
Text("14:32").argoText(ArgoTypography.machine)   // correct — a named role
Text("No sessions yet").argoText(.body)          // correct — a rung of the HIG ladder
```

- **The ladder is Apple's** (`ArgoTypeScale` = the macOS HIG text styles) and reaches the screen
  through `argoText(_:)` / `argoMono(_:)`. Nothing else decides a size or a weight.
- **Colour is not part of a type role.** A call site sets ink from the palette separately, so
  one role serves every tone it appears in.
- `FoundationSpecimen` is the project's **type specimen** — every role in one frame, and the
  surface any change to the ramp is checked against.

## Screens — container/View split

Every screen is two things: a thin **container** that resolves state, and a pure presentational
**View** that takes a view-model value and draws it.

- **The View never reads a store, an engine, or the Hub.** Its initializer parameters are its
  whole input. A view that reaches for shared observable state is unpreviewable, untestable,
  and re-renders on state it does not draw.
- Fixtures are typed off the projection's own types and live beside it, so shape drift is a
  compile error rather than a silently stale fixture.
- Mechanically enforced: `scripts/swift-boundaries.sh` permits exactly one file in `ArgoUI` to
  read live Hub state — the Hub → cockpit projection.

## Coverage — a state with no render is a state nobody has looked at

Every view ships `#Preview`s for the states it can be in, and every state worth a screenshot
gets a `Specimen` case (`design-studies.md`). The coverage rule is the same one at both grains:

**A render is an axis, not a value.** The unit is a distinct rendering *behaviour*. Re-running
the same layout with a different number or word is not a second case.

| What the parameter is | Shape |
|---|---|
| Continuous (a count, free text) | ONE render at a representative value |
| Discrete union (tone, status, kind) | ONE gallery rendering every value side by side |
| Boolean that changes the layout | one render for the non-default side only |
| Structural (loading / empty / error / populated) | one each — these are different renders |

- Edges that are *behaviour* rather than appearance (clamping, rounding, truncation) belong in
  a unit test, never in their own render.
- **An empty required value is not a variation, it's invalid input.** A render of `""` proves
  nothing; the fix is a type or a guard at the boundary. Only render emptiness where empty is a
  real designed state (an empty roster, a zero count).
- A width is part of the state for anything laid out in columns — render the narrow case at a
  chosen size (`ARGO_WINDOW_SIZE`), not by dragging a window.

### A parent covers only what it adds

Tiers compose, so their parameters do too — and a parent that re-renders the states it merely
forwards multiplies one axis by the depth of the tree.

**If a parent's case differs from its base case only by a parameter the parent passes through
untouched, it belongs to the child — delete it.** What a parent covers is what composition
creates and nothing below it can show:

- which child renders, and the switch between them
- focus and keyboard wiring that spans two children
- layout under pressure — a long label has to give way somewhere
- the parent's own state (a zone expanded, a seam dragged)

Cover one axis at two tiers and both copies rot the day the child changes — the upstairs copy
just fails later and further from the cause.

The sharpest case is the **delivery lifecycle**: the S0–S11 matrix
(`cockpit-surface-matrix.md`) is the Delivery region's union, told once in that region's
gallery. A screen must **not** carry one case per S-row — that is the region's gallery
multiplied by the spine. The screen gets one representative composed case plus its own
structural variants. And name a case for the state a human sees, never an internal matrix id:
`S9` is noise in a catalog; "+1 commit after approval" is the state. The S0–S11 sweep lives in
a derivation unit test, not in the catalog.

## Naming follows the tree

A `Specimen` case is named for what a human sees, and a view file for the type it exports.
Within a region, single-owner parts nest under their owner: a view with exactly one caller is
that organism's part, not its peer. A part picked up by a second region is promoted — and that
move *is* the promotion.
