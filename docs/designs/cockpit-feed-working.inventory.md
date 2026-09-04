# A Turn in flight — build inventory (#615, #616, #617)

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
| `FeedWorkingThread` | organism | `ArgoUI/Shell/Deck/Feed/` — the feed's own row, one caller (`FeedMarkLine`) | none; it reads the theme, and #617 moved the Reduce Motion read down into `FeedIonLoop` | `ArgoPalette.ion.pass` in a capsule, its glow, and `FeedIonLoop`'s phase | frozen table, `FeedWorkingThread`; [`working/think.png`](working/think.png) |

Extraction evidence: the name is in the design's frozen-names table, and it carries a state the
happy path never renders — the Reduce Motion still, parked at the centre of the measure.

## Extracted — #617 (the age of the wait)

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `FeedIonLoop` | driver | `ArgoUI/Shell/Deck/Feed/` — three callers (`FeedWorkingThread`, `FeedCallLineIon`, `SessionStateIndicator` since #1291) | a content closure taking the pass's phase and its rung | `ArgoWaitAge`, and a `.task` that runs one pass at a time | [`working/aged.png`](working/aged.png) |
| `FeedWait` | value | `ArgoUI/Shell/Deck/Feed/` — one caller (`FeedView`) | `showing(in: [FeedRow])` | `FeedRow.Content.isCallInFlight`, `FeedMark.working` | — |

Extraction evidence: the ladder applies to BOTH live states, so the second caller existed before
the first line was written — the alternative was the same clock spelled twice, drifting.
`FeedWait` is separate because the age is the reading's to hold and not the row's: the feed's
table recycles cells, so a clock inside a row restarts whenever the reader scrolls it off and back.

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
| `ArgoWaitAge` · `all` · `rung(at:)` · `coldest` · `cooling` | #617 | the four rungs a long wait cools through, and the one place a call site asks which it is on |
| `ArgoMotion.resolvedPass` · `passReentry` | #617 | a loop driven a pass at a time needs one traversal rather than the repeat, and a tick of its own to re-enter on |
| `EnvironmentValues.argoAgesWait` · `argoWaitStarted` | #617 | a render cannot sit through six minutes, and a recycled cell cannot hold the clock |
