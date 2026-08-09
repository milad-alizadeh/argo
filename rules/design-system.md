---
paths:
  - "apps/macOS/**/*.swift"
---

# Design System

Style every surface through the **visual contract**, never through raw values at a call site.
Two hard rules, no exceptions outside the documented escape hatches.

The Tailwind/CSS spelling of this rule retired with the Electron cockpit; the shipped
`packages/argo-skills/skills/setup-rules/rules/design-system.md` still carries it for consumer
projects that have a browser. What follows is Argo's own, in SwiftUI.

## Where the contract lives (ADR-0022)

`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/` is the single source of visual
values. One file per family, each value named for the **question it answers**:

| File | Holds |
|---|---|
| `ArgoPalette` · `ArgoColor` · `GraphitePalette` | colour ROLES — `surface`, `text`, `edge`, `interaction`, `state`, `diff` — and the one appearance that fills them |
| `ArgoTheme` | the appearance in force, carried in the environment (`\.argo`) — colour is the only family an appearance changes |
| `ArgoTypeScale` | the type ladder, which is **Apple's**: the macOS HIG text styles, named as the HIG names them |
| `ArgoTextStyle` · `ArgoTypography` | named roles over that ladder (face + rung + weight + tracking) |
| `ArgoSpacing` · `ArgoRadius` · `ArgoStroke` | the rhythm, the four radius rungs, the stroke widths |
| `ArgoElevation` · `ArgoMotion` · `ArgoIconSize` · `ArgoSymbol` | depth, durations and curves, glyph sizes |
| `ArgoLayout` · `ArgoFeedRow` · `ArgoPlanPill` | structural proportions and per-surface measures |

`Specimen/FoundationSpecimen.swift` renders the contract on a real surface. It is the living
proof and the one non-disposable design artifact (`rules/design-studies.md`).

## Rule 1 — Tokens only, never magic numbers

Every visual constant is a named value in `VisualContract/`, and a view reaches it by name.

- **Never** write a colour literal, a font size, a duration, or a spacing number in a view.
- Need a value that doesn't exist? **Add it to the contract first**, with a comment saying what
  question it answers, then use the name. Don't inline the raw value "just here".
- Colour comes from the environment (`@Environment(\.argo) private var theme`), not from a
  static — a second appearance is a second `ArgoPalette` and an environment write, and every
  call site that reads a role moves with it for free.

`scripts/check-design-tokens-swift.sh` is the mechanical half: it reads colour construction,
the type ladder, and the modifiers that take a rhythm value. `VisualContract/` is exempt
because it IS the contract, and `Specimen/` because a specimen exists to show what a role is
worth. A finding is fixed by snapping to a token or promoting one — **never by allowlisting**,
unless it is pre-existing debt tracked in a ticket.

## Roles, not values

Names say what a thing is for, never what it is worth. `ArgoSpacing.comfortable`, not
`space12`; `state.attention`, not `amber`. Role names survive a redesign; value names are drift
with extra steps.

- **The type scale is Apple's, and stays Apple's.** `ArgoTypeScale` names the HIG's macOS text
  styles and renders through the semantic `Font.TextStyle`, so a line takes the platform's
  metrics — and Accessibility text-size settings already know how to scale it. `size` is on
  each rung for the arithmetic a line height has to do; it is **read, never set**. Argo does
  not own a ladder of its own, and `ArgoTextStyle` cannot hold a size the HIG's does not have.
- The set of roles in each family is deliberately small. A new one needs a reason an existing
  one can't cover — "this looked 2pt better in one spot" is a snap, not a new role.
- A **measure** is not a token. How wide a thumbnail is, or how long a line of prose may run,
  is a property of the content; it lives beside the surface it belongs to (`ArgoFeedRow`) with
  its reason at the value, not as a rung of the rhythm.

## Drift — fix the contract, not the symptom

When you find a raw value in a view (yours or inherited), the fix is never local: snap it to an
existing token or promote it into the contract, then use the name. Patching one view while the
raw value's siblings survive elsewhere is how the system rots. Same rule for the AI: when
output drifts, correct the contract or the rules — not the one offending line.

## Escape hatches

A raw number in a view is allowed **only** where it is not a design constant, with a comment
saying why:

1. **Runtime-derived values** — a width that came from a drag, a `GeometryReader`, or a
   measured string.
2. **A content measure with no home yet** — allowed in the same change that gives it one.

`frame` is deliberately outside the mechanical gate, because its numbers are usually content
measures rather than design constants. That makes it the easiest place for a real drift to
hide: judge it, don't assume the gate did.

## Checklist before you finish visual work

- [ ] No colour literal, font size, duration or spacing number outside `VisualContract/`.
- [ ] Colour read from `\.argo`, not from a static or a system colour.
- [ ] Type set with `argoText(_:)` / `argoMono(_:)` or a named `ArgoTypography` role.
- [ ] Any new visual value added to the contract first, with its reason.
- [ ] `bun run check:design-tokens` passes (mechanical version of the above).
- [ ] The state RENDERED — a `Specimen` case, screenshotted and looked at
      (AGENTS.md → *Visual verification*). A view that only compiles has not been checked.
