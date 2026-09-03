---
paths:
  - "apps/macOS/**/*.swift"
---

# Design System

Style every surface through the **visual contract**, never through raw values at a call site.

## Where the contract lives (ADR-0022)

Three populations, three homes:

- **Tokens**, a value the whole app reaches by name: `Packages/ArgoDesign/Sources/ArgoDesign/`.
  It declares no `View`, `ViewModifier` or `LabelStyle` type and holds no state.
- **Atoms**, the shared views built out of those values: `ArgoAtoms`, one control or material
  per file, holding no state of its own.
- **Measures**, a value that answers to one surface's content rather than to the whole app
  (how wide a thumbnail is, how long a line of prose may run): the sheet in that surface's own
  directory under `Shell/`, with its reason at the value. `ArgoLayout` stays in the contract
  because pane widths and splits describe the window, which is every surface.

Edge 7 of `scripts/swift-boundaries.sh` fails a colour, rhythm step, radius, stroke or type
size declared anywhere but `ArgoDesign`; `RhythmTests` holds a sheet's steps to the ladder;
a `Mirror` assertion fails a role missing from its family's `all` array, so nothing ships
without a place in `ContractSpecimen` where it can be looked at. A role specified ahead of
its surface goes in the family's `unwired` map; whether a member nothing reads is unwired,
worth zero, or dead is decided by `bun run contract:sweep` (`docs/agents/contract-sweep.md`).

## Rule 1: tokens only, never magic numbers

- **Never** write a colour literal, a font size, a duration or a spacing number in a view.
  Need a value that doesn't exist? Add it to the contract first, with the question it answers.
- Colour comes from the environment (`@Environment(\.argo)`), never from a static or a system
  semantic colour: a second appearance is a second `ArgoPalette` and one environment write.
- **State a relationship between roles, not an arithmetic on values.** "At least `secondary`"
  survives a light palette; "one step brighter" inverts. Assertions run over
  `ArgoPalette.all`, never over `.graphite`.
- Every string the user reads is set by a role through `argoText(_:)` / `argoMono(_:)`; the
  type scale is Apple's HIG ladder and `size` is read, never set.

## Roles, not values

Names say what a thing is for: `ArgoSpacing.comfortable`, not `space12`; `state.attention`,
not `amber`. The set of roles in each family stays small, and a new one needs a reason an
existing one can't cover.

## Hue is rationed

A colour in this palette **means** something: Ion Blue is brand, selection and focus and
nothing else; four operational states are held apart; two diff inks are held off both. The
text ramp is neutral, all of it, because a rung is a loudness and not a meaning. To mark a
*kind* of thing reach for a ground, a weight, a face or a rule under the words; a hue is the
last resort and takes a role from something else.

Two sealed exemptions: source code in the evidence panel takes Xcode's own theme
(`SyntaxTheme`), and a colour the provider itself set on a label is a reading, drawn through
`LabelInk`. Neither licenses a hue outside its panel. Where the accent is spent, and at which
weight, is a design decision: `docs/designs/selection-accent.md`.

## Drift: fix the contract, not the symptom

A raw value in a view is snapped to an existing token or promoted into the contract, never
patched locally and never allowlisted unless it is pre-existing debt tracked in a ticket.

## Escape hatches

A raw number in a view is allowed only where it is not a design constant, with a comment:
a runtime-derived value (a drag, a `GeometryReader`, a measured string), or a content measure
with no home yet, allowed in the same change that gives it one. `frame` is outside the
mechanical gate because its numbers are usually measures, which makes it the easiest place
for a real drift to hide.

Before calling visual work done, render the state (`designs.md`). A view that only compiles
has not been checked.
