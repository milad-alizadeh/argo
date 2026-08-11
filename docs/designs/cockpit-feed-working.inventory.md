# A Turn in flight — build inventory (#615, #616)

What assembling the two live states actually forced out of
[`cockpit-feed-working.md`](cockpit-feed-working.md), per ticket. Names were frozen at approval;
renaming one is a migration. Later tickets against the same design append their rows here rather
than starting a second inventory.

## Extracted — #615 (a call in flight)

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `FeedCallLineIon` | modifier | `ArgoUI/Shell/Deck/Feed/Call/` — the call row's own part, one caller (`FeedCallLine`) | `isRunning: Bool` | `ArgoPalette.ion.pass`, masked to the row's own type | frozen table, `FeedCallLineIon` |

Extraction evidence: the name is in the design's frozen-names table, and the whole row has to be
one painting surface — a modifier taking the whole sentence is the only shape that can be.

## Extracted — #616 (thinking)

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `FeedWorkingThread` | organism | `ArgoUI/Shell/Deck/Feed/` — the feed's own row, one caller (`FeedMarkLine`) | none; it reads `\.argoReduceMotion` and the theme | `ArgoPalette.ion.pass` in a capsule, its glow, and the travel modifier | frozen table, `FeedWorkingThread`; [`working/think.png`](working/think.png) |

Extraction evidence: the name is in the design's frozen-names table, and it carries a state the
happy path never renders — the Reduce Motion still, parked at the centre of the measure.

## What stayed inline

- **The rest ink of a pending call** — `FeedCallLine`'s own `restInk` and `markInk`, because it is
  a rung the row already chose per outcome rather than a second thing to draw.
- **The exclusivity split** — one line in `FeedProjection.inFlight`. A Turn goes pending and
  resolves many times over, so a component owning the swap would be a second place to get it
  wrong.
- **The lane's bleed** — a negative `ArgoFeedRow.inset` inside `FeedWorkingThread`. One caller,
  one gutter, and nothing else in the feed is allowed to cancel it.

## Contract changes these needed

Values, not components — settled at approval and promoted rather than inlined.

| value | ticket | what it answers |
|---|---|---|
| `ArgoMotion.repeats` · `Curve.linear` · `working` | #615 | the contract's first loop, and the amended `durationCeiling` |
| `ArgoPalette.ion` · `ArgoRamp` · `ramps` | #615 | the four-stop ramp, and the catalog that makes a ramp visible to the coverage guard |
| `ArgoElevation.bloom` · `glows` | #616 | a glow is an elevation with no offset; `castsShadow` now asks about the offset |
| `ArgoFeedRow.workingThreadShare` · `workingThreadTravel` · `workingThreadStillGlow` | #616 | the filament's length as a share of the column, where it enters and leaves, and how it glows parked |
| `EnvironmentValues.argoStillsMotion` · `argoReduceMotion` | #616 | `accessibilityReduceMotion` cannot be written, so a render of a still needs a door read *beside* it |
