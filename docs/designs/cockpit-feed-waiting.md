<!-- status: approved
     approved-at: 879e7140
     prototype: worktree-ticket-1246-feed-loading-row -->

# A wait Argo is holding — the plinth

The approved design for the ONE thing the cockpit draws while Argo is doing something and the
reader is waiting for it. It gives `/handoff` and a resume the rendering neither has ever had
(#1229, #1246), and it re-bases the period of the ion that
[`cockpit-feed-working.md`](cockpit-feed-working.md) already ships.

**The renders in [`waiting/`](waiting/) are the spec.** The measurements below are the numbers a
ticket must carry — prose that omits them cannot be failed for getting them wrong.

**This is Markdown and renders, not an HTML design.** `prototype-to-design` asks for an HTML
file that speaks only the token contract; ADR-0022 retired committed HTML studies from this
folder when the runtime locked to Swift, and `docs/designs/README.md` records that the contract
itself lives in `ArgoDesign`. So the design is written the way every other approved design here
is — measurements, frozen names and renders — and the explorable stays on its throwaway branch.

The study lives on the throwaway branch `worktree-ticket-1246-feed-loading-row`
(`docs/designs/prototypes/feed-loading-row-prototype.html`), where the two rejected variants are
still switchable and every state is reachable by URL. It is there to be re-explored, not built
from.

## The wait stands at the foot, and it is not a row

A wait is **not** written into the reading while it runs. It stands on a **plinth** between the
feed and the composer, one at a time, and when it ends it **drops into the reading as a settled
row**.

That split is the whole design. A transcript is written after the fact, so the whole of a wait is
exactly the part of it no record can carry — and a row appended while the wait runs is a row that
has to be *edited* when the wait ends. The reading is written once.

| | while it runs | when it ends |
|---|---|---|
| the plinth | carries the wait | clears |
| the reading | unchanged | gains one settled row |

**A failure is not an exception to that.** The plinth clears and the row lands in failure ink.
An earlier draft kept the plinth up with a dismiss, and [`failed.png`](waiting/failed.png)'s
first cut showed the plinth and the row saying one sentence twice, stacked. #1229 asks for the
failure to be said *in the feed rather than in an alert alone*; a plinth standing over the row
that already says it **is** that alert.

## The four waits

Each is DIRECT — Argo started the thing and Argo is waiting on it. **Nothing DERIVED may take
this surface.** A Session observed from outside can be `running` for reasons Argo did not cause,
and a plinth over that would claim an act nobody performed.

| The wait | Words | Symbol | Settles to | Render |
|---|---|---|---|---|
| the CLI has started and has not spoken | `Starting the agent` | `ArgoSymbol.startSession` | `Started the agent` | [`starting.png`](waiting/starting.png) |
| `/handoff` is running | `Handing off the current session` | `ArgoSymbol.handedOff` | `Handed off to <title>` | [`handoff.png`](waiting/handoff.png) |
| a Session resumes from orphaned | `Resuming the session` | `ArgoSymbol.retry` | `Resumed the session` | [`resume.png`](waiting/resume.png) |
| a Turn is in flight | `Waiting for the agent to answer` | **none** | nothing — see below | [`turn.png`](waiting/turn.png) |

**The unnamed wait takes no mark, and no default is invented for it.** A mark is a claim about
what happened, and "thinking" is not something that happened. `FeedCallLine` already draws an
empty mark column for a call whose kind Argo could not read; this is the same answer.

The symbols are the acts, not the states: `startSession`'s play triangle is what Argo did,
`handedOff`'s arrow is the mark the settled handoff row already carries, and `retry`'s
clockwise arrow is the chain picked up again.

## A Turn in flight says it twice, deliberately — `turn.png`

The thread stays in the reading **and** the plinth names the same wait in words.

This is the one place the design says a thing twice, and the split is not decorative: the thread
is a live signal where the work is, drawn wordless because a caption on every turn breaks the
reading into pieces (#1248); the plinth is where **every** wait is reported, so a reader who has
learnt to look at the foot finds this one there too. A Turn that dropped out of the plinth would
be the commonest wait missing from the one place waits are named.

Both ions are the same substance at the same length, so they read at one speed. See below —
that is a measurement, not a preference.

**A Turn in flight settles into nothing.** The agent's answer *is* the record of it, so no row
lands. Only a Turn that ended without one is news, and that lands as a failed row.

## The plinth — `starting.png`

| Measurement | Value | Source |
|---|---|---|
| Lane | `ArgoFeedRow.column` 720pt, centred, inset `ArgoFeedRow.inset` 24pt each side | the feed's own measure — the plinth is the feed's foot, not the composer's head |
| Ground | `surface.raised` `#252729` | above the deck, below the composer vessel |
| Border | `ArgoStroke.border` 1pt in `edge.hairline` | |
| Radius | `ArgoRadius.control` 6pt | a chip's radius, not a popover's: this is not a surface that floats |
| Inset | `ArgoSpacing.base` 8pt vertical, `ArgoSpacing.comfortable` 12pt horizontal | |
| Gap, mark to words | `ArgoSpacing.comfortable` 12pt | |
| Words | `ArgoTypography.body` in `text.secondary` `#A8AEB5` | the live rung, one step above the settled calls |
| Mark | `ArgoIconSize.inline` in `interaction.accent` `#3E9BFF` | |
| Elapsed | `ArgoTypography.machineCaption`, monospaced digits, `text.disabled` `#4E545A`, trailing | the quietest thing on the plinth: it is there to be *checked*, not read |
| Step to the composer | `ArgoSpacing.base` 8pt | |

The elapsed reading is what makes a stuck wait visible, which is #1245 from the other side. It
counts from the moment the wait's **identity** changes, not from the Session's start.

## The settled row — `settled.png`

The row that lands in the reading when the wait ends. It is a **call row's shape**, because that
is what the reading already spends on "a thing that happened":

| Measurement | Value | Source |
|---|---|---|
| Mark column | `ArgoFeedRow.callSymbolWidth` 15pt, drawn empty where there is no mark | so every verb in a run starts on one vertical |
| Gap | `ArgoFeedRow.callGap` 6pt | |
| Words | `ArgoTypography.body` in `text.tertiary` `#929AA1` | a step below the plinth's live ink: it is finished |
| Mark ink | `text.disabled` `#4E545A` | |
| What it took | `machineCaption`, monospaced digits, `text.disabled` | |
| Line | one, at `ArgoFeedRow.lineHeight` 20pt, whatever happened | as `FeedCallLine` is |

## A failed wait — `failed.png`

The whole line in `state.failure` `#F2555C` — mark, words, duration and reason alike — with the
reason appended in `machineCaption`. That is exactly how `FeedCallLine` draws a call that failed,
and it is drawn that way **so the two are told apart by nothing but their words**: a reader
scanning a column of red should not have to learn a second grammar for a wait.

The render puts it under a Turn ending in a failed call row on purpose. A failure judged on a
clean screen is not judged.

| The wait | What a failure says |
|---|---|
| starting | `The agent did not start` |
| handing off | `The handoff failed` |
| resuming | `The session did not resume` |
| a Turn in flight | `The turn ended without an answer` |

## The ion — one length, one speed

**The filament is `ArgoFeedRow.column × ArgoFeedRow.workingThreadShare` = 216pt, wherever it
runs.** Its length is read off the COLUMN and never off the lane it happens to be in. The thread
crosses the 720pt measure; the plinth's rail is 670pt — the column less the feed's inset and
the plinth's own border; a share of each would be two different
filaments, and `ArgoFeedRow.workingThreadTravel` states travel in multiples of the filament's
**own** length — so a shorter filament covers less ground per pass and reads slower at the same
period. One length is what makes one period one velocity.

`workingThreadShare` is unchanged and still tracks `column`. What changes is where the share is
applied: to the column, once, rather than per lane.

| Measurement | Value | Source |
|---|---|---|
| Filament length | 216pt | `column × workingThreadShare` |
| Thickness | `ArgoStroke.indicator` 2pt | |
| Ends | capsule | |
| Ramp | the four-stop ion, unchanged | [`cockpit-feed-working.md`](cockpit-feed-working.md) |
| Glow | `ArgoElevation.bloom`, opacity per age | |
| Travel | `ArgoFeedRow.workingThreadTravel` −105% … 340% of its own length | clear of the lane at both ends |
| The plinth's rail | the plinth's full inner width, at its **bottom edge**, 2pt tall, clipped | the ion runs along the edge the composer is on — the direction the work is going |

### The period, re-based — `aged.png`

`ArgoMotion.working` was 1.9s. At one length beside the plinth it read as dawdling. **1.2s**, and
the `ArgoWaitAge` ratios are held and re-based on it, rounded to a tenth — a period is something
a person feels, not a figure anything computes against.

| Age | Period, shipped | Period, approved | Glow |
|---|---|---|---|
| under 10s | 1.9s | **1.2s** | 0.60 |
| 10s – 60s | 2.8s | **1.8s** | 0.49 |
| 1m – 5m | 3.8s | **2.4s** | 0.40 |
| over 5m | 4.9s | **3.1s** | 0.30 |

It still **cools and never warms**: `state.attention` means *something needs you*, and a long
wait needs nothing. 3.1s is still slow enough to read as patient and fast enough to read as
travel, which is the pair `ArgoWaitAge.coldest` exists to hold.

A still cannot show a period. `aged.png` shows only what a still can — the glow fallen to 0.30,
and the `6m 41s` beside it, which is what makes the age legible with no motion at all. The
periods are the table above; there is no render that can be failed for getting them wrong, so a
ticket carries the numbers rather than the picture.

## Reduce Motion — `still.png`

The ion parks at the centre of its lane at glow `ArgoFeedRow.workingThreadStillGlow` 0.4, and the
plinth keeps its words, its mark and its elapsed reading. **The elapsed reading is what carries
the state with movement off** — it is the one part of this surface that says "still going" without
moving, which is why it is on the plinth and not only in a tooltip.

## The frozen names

These become component files and ticket titles.

| Name | What it is |
|---|---|
| `FeedWait` | **exists** — which wait the reading is showing, as an identity. Gains `.starting`, `.handingOff`, `.resuming` beside today's `.thinking` and `.call(id)` |
| `FeedWaitPlinth` | the plinth at the foot |
| `FeedWaitRow` | the settled row that drops into the reading |
| `FeedWaitWords` | the words, the mark and the past tense per case — where `FeedWorking.startingWords` goes |

## Every value snaps; nothing is promoted

The raw-value sweep over the approved variant, family by family. A **promotion** is a contract
change, and this design earns none — which is the point: a surface that needs a value the
contract lacks is usually a surface that has drifted.

| Raw in the study | Snapped to |
|---|---|
| `#252729` | `surface.raised` |
| `rgba(255,255,255,.08)` | `edge.hairline` |
| `#A8AEB5` · `#929AA1` · `#4E545A` | `text.secondary` · `text.tertiary` · `text.disabled` |
| `#3E9BFF` | `interaction.accent` |
| `#F2555C` | `state.failure` |
| `#1E6FD4` `#3E9BFF` `#6FB6FF` `#46D3A8` | `ArgoPalette.ion`, the four-stop ramp |
| 4 · 6 · 8 · 12 · 16 · 24 | `ArgoSpacing` tight · snug · base · comfortable · loose · section |
| 6pt radius | `ArgoRadius.control` |
| 1pt · 2pt | `ArgoStroke.border` · `ArgoStroke.indicator` |
| 13pt | `ArgoTypography.body` |
| 11pt mono | `ArgoTypography.machineCaption` |
| 15pt mark column · 20pt line | `ArgoFeedRow.callSymbolWidth` · `ArgoFeedRow.lineHeight` |
| 216pt filament | `ArgoFeedRow.column × workingThreadShare` |
| blur 4, opacity 0.6 | `ArgoElevation.bloom` |
| −105% … 340% | `ArgoFeedRow.workingThreadTravel` |
| 0.4 parked | `ArgoFeedRow.workingThreadStillGlow` |
| `999px` | a capsule — height ÷ 2, as the thread's ends already are |

**Exactly two values in the study were neither a token nor a derivation**: the failed plinth's
ground and border. Both died with the dismissible plinth, before they could be promoted. A raw
value that survives to the promotion table is worth re-reading as a question about the design,
not only about the contract.

The four periods below are **edits to existing roles**, not promotions.

## The contract changes this needs

1. **`ArgoMotion.working`** — period 1.9 → **1.2**. Everything else about the role is unchanged.
2. **`ArgoWaitAge.all`** — re-based to 1.2 / 1.8 / 2.4 / 3.1. The glows are untouched, so the
   ladder's *shape* is exactly what #615 approved.

That is all. The plinth's own measures are a surface's, not the contract's (`rules/swift.md`), so
they live beside `FeedWaitPlinth` and promote nothing. Both changes above are edits to existing
roles rather than new ones, so no `all` array grows and `VisualContractTests`' `Mirror` assertion
is unaffected.

## What the study exposed that the renders don't show

1. **Matching the period does not match the speed.** The plinth's ion at the same period read
   visibly slower than the thread, and the period was never the reason —
   `workingThreadTravel` is stated in the filament's own lengths. A still cannot show this and a
   period table cannot either; it took two lanes side by side at one period to see it.
2. **The failure duplicated itself.** The plinth-with-a-dismiss looked right in isolation and
   was obviously wrong the moment the settled row was under it. That is the case for rendering a
   failure *against the reading it lands in* rather than alone.
3. **The double-saying survives being looked at.** A Turn in flight showing both the thread and
   the plinth was the design's weakest claim on paper and its most defensible on screen: the two
   are far enough apart, and different enough in kind, that neither reads as a repeat of the
   other.

## Not settled here

The spoken form for a screen reader. `FeedWorking.spoken` and `FeedMark.spoken` are where those
live, and a shape crossing the column carries nothing to a reader who cannot see it. Every wait
above needs a sentence; that is prose, and it belongs in the tickets.
