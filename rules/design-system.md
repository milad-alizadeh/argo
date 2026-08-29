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
**tokens** — a value the whole app reaches by name. It declares no `View`, `ViewModifier` or
`LabelStyle` TYPE and holds no observable state; the views built out of its values are its
neighbour, `ArgoUI/Atoms/`.

A **measure** is a value too, and it is deliberately not here: it answers to one surface's
content rather than to the whole app, so it lives in that surface's own directory. That is the
third table below, and it is the one thing "single source" does not mean.

The type is what draws the line, not the `View` extension. A family here may still extend
`View` with a modifier that applies its own value in one expression — `argoShadow`, `argoIcon`,
`argoText`, `argoTheme` — because that is the value being reached by name, which is Rule 1.
The moment the modifier needs a `ViewModifier` of its own to hold what it draws, the type is an
atom and both halves move: that is why `argoAnimation` left `ArgoMotion` for `Atoms/`.

Three populations, one table each: **tokens** and **atoms** are the two directories above, and
**measures** are the third population precisely because they live in neither.

### Tokens — a value the whole app reaches by name (`VisualContract/`)

| File | Holds |
|---|---|
| `ArgoPalette` · `ArgoColor` · `GraphitePalette` | colour ROLES — `surface`, `text`, `edge`, `interaction`, `state`, `diff` — and the one appearance that fills them |
| `TextRoles` | the ink ramp, every rung neutral, plus `marked(on:)` — the one role that is a function of the others |
| `ArgoRamp` | an ordered ramp of roles, held as roles and fractions rather than as a `Gradient` |
| `ArgoTheme` | the appearance in force, carried in the environment (`\.argo`) — colour is the only family an appearance changes |
| `ArgoTypeScale` · `ArgoTypeScale+AppKit` | the type ladder, which is **Apple's**: the macOS HIG text styles, named as the HIG names them, plus the `NSFont` each rung resolves to for the AppKit side of the feed |
| `ArgoTextStyle` · `ArgoTypography` | named roles over that ladder (face + rung + weight + tracking) |
| `ArgoSpacing` · `ArgoRadius` · `ArgoStroke` | the rhythm, the four radius rungs, the stroke widths |
| `ArgoElevation` · `ArgoMotion` · `ArgoIconSize` · `ArgoSymbol` | depth, durations and curves, glyph sizes plus the one drawn mark that is not a symbol (`ArgoIconSize.statusDot`), and the SF Symbol each meaning is drawn with |
| `ArgoOpacity` | how present a whole surface is — the rung a row nobody can drive is ghosted at |
| `ArgoOperationalState` | the four states colour is owed, and the tint each takes from a palette |
| `ArgoWaitAge` | the ladder `ArgoMotion.working` cools down as the wait it reports gets older |

### Measures — a property of the content, so it lives beside the surface (not `VisualContract/`)

A measure is not a token, and it is not in the contract's directory. It sits in the directory of
the **one surface whose layout it describes**, with its reason at the value — because how wide a
thumbnail is or how long a line of prose may run answers to the content, not to the rhythm
(see **Roles, not values** below).

One owning surface is the whole criterion. A sibling directory reading a sheet is expected and
costs nothing inside one Swift module: the minimap re-lays out the feed, so it reads
`ArgoFeedRow` by name, and the feed owns that geometry either way.

| File | Lives in | Holds |
|---|---|---|
| `ArgoFeedRow` | `Shell/Deck/Feed/` | the reading's own measures — the column, a row's steps, a bubble's ground |
| `ArgoComposerVessel` | `Shell/Deck/Composer/` | the composer's measurements, from its approved study |
| `ArgoMinimapLane` | `Shell/Deck/Minimap/` | what the overview lane beside the reading is measured at (D25) |
| `ArgoPlanPill` | `Shell/Deck/Plan/` | the pill's measurements and the list it reveals |
| `ArgoToolbarVessel` | `Shell/Toolbar/` | how tall a toolbar container is, and the slots in it and its drawers |
| `ArgoContextBar` | `Shell/Deck/Header/` | the context gauge on the tab line and the ⓘ panel it opens |
| `ArgoConnectPanel` | `Shell/Connect/` | the Connect panel's width and the device code's slot in it |
| `ArgoAgentsRail` | `Shell/Deck/Feed/Agents/` | where the rail opens, and where it collapses to |
| `ArgoRosterFoot` | `Shell/Sidebar/` | the floor under the roster's archive header |
| `ArgoLayout` | `VisualContract/` | the window's structural proportions — pane widths, minimums, the splits |

`ArgoLayout` is the one that stays, and not as an exception: pane widths and the splits between
them describe the window, which is every surface and therefore no single one. One reading
directory is a strong SIGNAL that a member is a measure filed in the wrong place — #773 read that
signal and moved nineteen, the five sheets above — but it is not the criterion, because what a
value describes is. `titlebarTitleMaximumShare` and `seamGrabWidth` each have one reader today
and stay: a share of the detail pane and a seam's hit area are the window's arithmetic, and the
one surface reading them is the one that happens to draw the window's furniture. It is also why
`ArgoLayout.minimapLane*` is not a
duplicate of anything in `ArgoMinimapLane`: those are the lane's width *against the feed*, which
is what `railLimits(in:)` spends against the deck, while the sheet holds the lane's internals.

A sheet outside the contract must not grow a spacing rhythm of its own, and that is mechanical
rather than a review note: `RhythmTests`' `every step a surface names is a step the rhythm
already carries` asserts each sheet's ladder-derived steps against `ArgoSpacing.all`. A step a
moved sheet spells as a literal off the ladder fails the suite.

A sheet that names **no** step gets held a different way. The five added by #773 are slots sized
to the sentences they hold, so the ladder has nothing to say about any of them;
`SurfaceMeasureTests` asserts the claim each declaration makes instead — a rail that collapses
below where its seam may be dragged, a guide column wider than the thresholds beside it. A measure
whose reason nothing can check is a number waiting to drift.

### Atoms — the views built out of those values (`Atoms/`)

One shared control or material per file, reached by type name or by the modifier beside it.
An atom holds no state of its own and reads every value it draws from the contract.

| File | Draws |
|---|---|
| `ArgoBadge` | a count carried on a control — a ground off the neutral ramp, no hue |
| `ArgoStateLabel` | a state said as a mark rather than as prose, coloured by the state it names |
| `ArgoKindedName` | a name with the glyph for its kind, cut in the middle |
| `ArgoGlyph` | a symbol at exactly one rung of the icon scale |
| `ArgoDisclosure` | the one disclosure chevron, its direction taken by rotation |
| `ArgoCodeLine` | one line of code: the host's number in a gutter, the characters beside it (#754) |
| `ArgoLabelStyle` | symbol beside title at the contract's rhythm (`.labelStyle(.argo(_:icon:))`) |
| `ArgoFocusRing` | the one keyboard cursor, as a view and as `argoFocusRing(_:in:)` |
| `ArgoFloatingGlass` | the material a surface takes when it floats over the deck (`argoFloatingGlass(in:rim:)`) |
| `ArgoChromeBar` | the window's fixed chrome: one tinted blur to the hairline where it stops |
| `ArgoAnimation` | `argoAnimation(_:value:)` — applies an `ArgoMotion` role, resolving Reduce Motion |

`Focus/ArgoFocusVisibility.swift` is in neither: it is runtime state, answering "would a focus
ring drawn right now be answering the keyboard?" from the last `NSEvent` the app saw (#533). A
service is not a visual value, so it does not live in the contract.

`Specimen/ContractSpecimen.swift` enumerates every role on the surfaces it is read against. It
is the living proof and the one non-disposable design artifact (`rules/designs.md`);
`Specimen/FoundationSpecimen.swift` is its companion, the same roles dressed onto a real shell.

**A role that is not in the specimen does not ship.** Each group's `all` array drives the
specimen, and a `Mirror` assertion fails the build when a stored role is missing from it — so a
colour cannot reach the app without a place it can be looked at.

**A role nothing draws yet says so.** The contract runs ahead of the build, so some roles are
specified before their surface exists. Those are listed in their family's `unwired` map with
what they wait on, and the specimen marks them in the attention ink — because a value that has
never moved a surface has not been judged, and a specimen that draws it identically to a live
role is how an unjudged value passes for a settled one. An entry naming no role fails the suite,
so the list shrinks as surfaces land and cannot rot.

Three things are **not** unwired, and telling them apart matters:

- **A value worth zero** (`ArgoRadius.deck`, the flat `ArgoElevation` rungs). Nothing references
  them because you honour them by drawing nothing. They are the difference between a deck that
  is flat because somebody decided and one that is flat because nobody thought about it — and
  they are the control group that gives `only genuinely floating surfaces cast a shadow`
  something to mean.
- **A value the system owns.** There was an `ArgoRadius.vessel` at 11pt; a toolbar vessel takes
  its shape from the toolbar's own material, so no view could ever apply it. That is deleted,
  not marked — a number that looks like a decision and cannot be honoured is worse than an
  absence.
- **A value nothing needs.** Delete it. Not every gap is a plan.

Which of the three a member is takes a sweep that follows extension-method reach, not a grep over
type names: `bun run contract:sweep`, with the method and the last sweep's judgements in
`docs/agents/contract-sweep.md`.

## Rule 1 — Tokens only, never magic numbers

Every visual constant is a named value, and a view reaches it by name — a token in
`VisualContract/`, or a measure on the sheet beside the surface it belongs to. What is banned is
the number written at the call site, not the number's address.

- **Never** write a colour literal, a font size, a duration, or a spacing number in a view.
- Need a value that doesn't exist? **Add it to the contract first**, with a comment saying what
  question it answers, then use the name. Don't inline the raw value "just here".
- Colour comes from the environment (`@Environment(\.argo) private var theme`), not from a
  static — a second appearance is a second `ArgoPalette` and an environment write, and every
  call site that reads a role moves with it for free.

### Write it so a light appearance costs nothing

A light palette is planned. Everything below already holds for it, and new work has to keep it
that way — the cost of getting this wrong is not a bug, it is a sweep through every call site.

- **A value belongs to a palette, never to a view.** `surface.marked` is white 7% on graphite
  and would be a translucent *black* on light; the view says `argo.color.surface.marked` and
  neither knows nor cares.
- **State a RELATIONSHIP between roles, not an arithmetic on values.** `TextRoles.marked(on:)`
  picks a rung; it does not lighten one. A rule phrased as "one step brighter" inverts under a
  light appearance and a rule phrased as "at least `secondary`" does not.
- **`ArgoTheme` carries its `scheme` beside its palette**, so `argoAppearance` sets the system's
  own scheme from the theme. Never write `.preferredColorScheme(.dark)` at a call site.
- **Assertions run over `ArgoPalette.all`, not over `.graphite`.** Add a palette and it inherits
  every legibility floor and separation rule the same day. Any claim you cannot phrase that way
  — anything true only of a dark appearance — is a claim about a value, and probably wrong.

`scripts/check-design-tokens-swift.sh` is the mechanical half: it reads colour construction,
the type ladder, and the modifiers that take a rhythm value. `VisualContract/` is exempt
because it IS the contract, and `Specimen/` because a specimen exists to show what a role is
worth. **`Atoms/` is not exempt** — an atom draws with the contract like any other view, so it
answers to the gate like any other view. Neither are the measure sheets, now that they live in
surface directories rather than the exempt one — though in practice a sheet declaring
`static let shotWidth: CGFloat = 168` matches none of the four patterns, so the gate covering
them is a loss of an exemption rather than a new guard. `RhythmTests` is the guard.

A finding is fixed by snapping to a token or promoting
one — **never by allowlisting**, unless it is pre-existing debt tracked in a ticket.

## Hue is rationed; loudness is not

A colour in this palette **means** something. Ion Blue is brand, selection and focus and nothing
else; four operational states are held apart by construction; two diff inks are held off both.
That is the whole budget, and every one of them is asserted.

### Where Ion Blue is actually spent

Rationing it is only half the rule: a hue reserved for selection and then spent nowhere the reader
meets selection buys a shell that reads as a stock, greyed-out Mac app. #875 put it back. Its
placements, and only these:

| Placement | Drawn by | Weight |
|---|---|---|
| A selected sidebar row — the roster's, and the Work room's view list | `interaction.selectionGround`, as a `listRowBackground`, via `.argoSelectedRowGround(isSelected:)` | `accent` at 0.18 over the rail, **resolved opaque** |
| The rooms picker's selected segment | the `AccentColor` **asset**, which `NSSegmentedControl` fills with | full |
| Focus rings and stock accented controls | the same asset | full |
| The selection indicator on a tab | `interaction.selectionIndicator` | full |
| A link, and the ink an interactive word takes | `interaction.accent` | full |

One hue, two weights: full strength where a control is the loud rung, a quiet ground where a row
is merely selected. The weight is not a taste — it is whatever leaves every voice a row is read
in above `TextRoles.contrastFloor`, which `SelectionGroundTests` asserts absolutely on both of a
row's grounds (#922). It replaced a relative claim against the neutral wash, which could not fail
while the ground it named was not the ground drawn.

**`selectionGround` is OPAQUE by contract** (#922). The capsule below is still drawn under it, so
a translucent value composites ONTO the capsule instead of replacing it — which is how a 0.10
wash shipped as a near-grey `#484E58` and took `text.tertiary` to 2.49:1. An opaque ground covers
it, so what the contract asserts is what the row draws. `ContractSpecimen` draws the role by hand
beside the full-strength rung, so the two weights can be judged together.

**The asset is app-wide and is the only route to the loud half.** It reads no palette, so
`AccentAssetTests` is what keeps the shipped file and `interaction.accent` one value — they had
already drifted once. Re-colouring it moves every stock accented control in the app at the same
time; that is the intent, not a side effect.

**The platform will not colour a sidebar's selection, and it will not stop drawing it either.**
On macOS 26 the `.listStyle(.sidebar)` capsule is a fixed neutral: neither `.tint` nor the asset
moves it. Draw the row's ground with `listRowBackground` — but that ground COVERS the capsule
rather than replacing it, so it must be opaque or the second highlight is still under it (#922).
Every sidebar, not just the roster (#906) — a new rail asks `.argoSelectedRowGround(isSelected:)`
for its ground rather than growing a second copy of the same ternary.

**Judge selection off a render, never off a preview.** A preview of an `ArgoUI` view builds the
package alone and cannot see the asset at all; and an inactive window draws the platform's own
selection in an unemphasized grey. The `selectedRow` specimen renders both weights in one frame,
in the app target.

So before adding a colour, say which of those it is. If the answer is "none — it marks a *kind*
of thing", it does not get a hue:

- **The text ramp is neutral, all of it.** A rung of it is a loudness, not a meaning. This rule
  is asserted (`every text rung is neutral`), and it exists because the exception happened: a
  lavender `code` ink sat in the ramp at five times the saturation of every rung around it,
  spending the app's loudest colour on "this run is machine text" — a thing the mono face
  already said. It is now a **ground** (`surface.marked`), which costs no hue.
- **A ground, a weight, a face, or a rule under the words** are the devices for a kind. Reach
  for one of those first; a hue is the last resort and it takes a role from something else.
- **Source code is the one exemption**, and it is total: a patch in the evidence panel is read in
  Xcode's own dark theme (`SyntaxTheme`), because the reader has the same files open in Xcode all
  day. That theme is sealed behind one constant and never leaks into the shell — a hue that is
  correct inside the panel is not licensed outside it.
- **A colour the provider itself set is a reading, not a claim of Argo's**, and is the second
  exemption. A tracker label's hue was chosen by the reader on the tracker, and dropping it makes
  Argo's list harder to scan than the page it mirrors — the colour IS how they find `bug` in a
  column of chips. It is drawn through `LabelInk`, which keeps the hue and spends none of the
  budget's loudness on it: a wash for the ground, a hairline's worth for the edge, and the word
  lifted only far enough to read. A label the provider gave no colour keeps the neutral chip —
  absence is a silence, never a hue Argo picked to fill it. Like the syntax theme, this is sealed:
  it applies to a colour READ from a provider, and licenses nothing Argo chooses for itself.

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

- [ ] No colour literal, font size, duration or spacing number in a view — every one of them a
      token in `VisualContract/` or a member of the surface's own measure sheet.
- [ ] Colour read from `\.argo`, not from a static or a system colour.
- [ ] Type set with `argoText(_:)` / `argoMono(_:)` or a named `ArgoTypography` role.
- [ ] Any new visual value added to the contract first, with its reason.
- [ ] `bun run check:design-tokens` passes (mechanical version of the above).
- [ ] The state RENDERED — a `Specimen` case, screenshotted and looked at
      (AGENTS.md → *Visual verification*). A view that only compiles has not been checked.
