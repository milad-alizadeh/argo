# Turn-granularity overview lane — throwaway prototype (#1174)

**This branch is a primary source, not a starting point.** It exists so the question in
[#1174](https://github.com/milad-alizadeh/argo/issues/1174) — *what should a Turn's mark in the
overview lane be?* — can be looked at rather than argued about. It is deliberately not on `main`:
prototype constraints, no tests, no abstractions, and the validated decision belongs in
`docs/designs/`, not here.

## Run it

```sh
node docs/designs/prototypes/turn-lane-specimens.mjs   # only if you want to re-read the transcripts
python3 -m http.server 8974 -d docs/designs/prototypes # a server, not `open`: see below
open http://127.0.0.1:8974/turn-lane-prototype.html
```

A server rather than `file://` only because Chrome refuses `file://` to the extension that drives
it; the page itself has no build, no dependency and no network call. The data is a
`<script src>`, so `open docs/designs/prototypes/turn-lane-prototype.html` works in a plain browser
too.

## Reading the URL

| Parameter | Effect |
|---|---|
| `?variant=A…E` | Which lane. Also `←`/`→`, the letter keys, or the floating bar. |
| `&s=ordinary\|lopsided\|longtail` | Which specimen. Also `1`/`2`/`3`. |
| `&starved=1` | Light every mark drawn at the 1pt floor in the failure ink. |
| `&ink=0` | Take the colour away — the shape-only reading. |
| `&gamma=0.2…1` | E's compression exponent. |
| `&deck=<pt>` | The deck's height. 800 by default, which is the height every figure in #1173 is quoted against. |

The feed on the left is the real reading at real scale, so the lit rectangle, the click and the
drag are judged rather than described. Hovering the lane names the Turn under the pointer and the
words it opened with.

## The data is real; the heights are modelled

`turn-lane-specimens.mjs` reads the three transcripts #1174 names, off this machine, and restates
`FeedProjection` + `TurnExtents` in JS. **Real:** every row's existence, kind, order and words, and
every Turn boundary. **Modelled:** every row's height — the app measures with Core Text
(`FeedRowMeasure` → `FeedProseFrame`); this wraps at an average advance. So the shape of the
distribution is the record's and any single bar is within a line or two.

The JS projection comes in under the counts #1173 published, by 9–22%:

| specimen | #1173 rows / Turns | this projection, unfolded | folded |
|---|---|---|---|
| `0ec3b3b6` ordinary | 592 / 85 | 540 / 93 | 436 |
| `bb7ebce2` lopsided | 552 / 11 | 452 / 6 | 323 |
| `b541025d` #650 | 5,017 / 543 | 3,933 / 440 | 2,848 |

Chased far enough to know the class of the gap and no further: the meta records this reader
drops (`isMeta` without a skill body) and the ask/gallery/unreadable rows it does not model. The
Turn counts differ in both directions, which is what a boundary rule reading slightly different
rows does. **Nothing below rests on matching those counts** — every figure the page prints, it
re-derives from what it drew.

The specimens are read **unfolded**, as #1174 asks: #1172's work fold shortens the reading this
lane is asked to draw, and the variants are judged at the harder length. The folded count is
carried beside it so the two lengths can be compared.

## What the five variants are

- **A — Proportional bars.** One bar per Turn at its true extent, floored at 1pt. The honest
  baseline; the panel counts the slivers rather than arguing about them.
- **B — Proportional, banded.** The same bars, each split into prompt / work / prose in the Turn's
  own proportion. A Turn's character survives a compression its height does not.
- **C — Equal ticks beside a rail.** Evenly spaced marks; a 3pt rail on the trailing edge keeps the
  true proportional position and carries the viewport rectangle. A press on the marks names a
  **Turn**; a scrub on the rail names a **place**. Two gestures, one lane.
- **D — Proportional + boundary comb.** Bars stay proportional; every boundary also draws a 1pt
  tick in a leading comb at its true position, so a run of trivial Turns is countable.
- **E — Adaptive compression.** Each Turn drawn at `extent^γ`, renormalised to the lane. The
  rectangle and the drag map through the same curve — the cost is what it feels like under a hand,
  which is why the rectangle is deliberately **not** drawn linearly here.

## What the prototype found before anyone looked at it

Every number below is the page's own, at a 120 × 800pt lane, over modelled heights.

1. **440 Turns do not fit an 800pt lane either.** The lane holds 400 distinguishable marks
   (`800 / (rectMinimumHeight + rectGap)`). #650 has 440 Turns by this reading, 543 by #1173's.
   **Every variant fails on that specimen** — A and D window, C's even spacing lands at 1.8pt a
   mark, E floors 68% of its marks. Turn granularity does not remove the fold on #650; it moves it
   from 5,000 rows to 440 Turns. #1173's "74% coverage" is a floor model over counts; re-derived
   over drawn geometry this page reads **24%**, because the document is 310,000pt and the lower
   quartile of a Turn extent is not the lower quartile of a row height. **That gap is the first
   thing to resolve, and it is #1173's figure that is at stake, not this one's.**
2. **The sliver problem is real but smaller than the ticket feared** — on a session that fits.
   Ordinary: 19% of marks at the 1pt floor, 27% under 2pt. Not "half the lane is stipple".
3. **Loudest-wins ink would paint the lane red.** A Turn holding one failed call reads as a failed
   Turn: 17% of #650's Turns and 33% of the lopsided one's. Whatever a Turn's single ink is, it
   cannot be "the loudest state anywhere inside it" — which the ticket did not ask, and which is a
   real decision for #1173.
4. **The lopsided specimen is worse than its label.** Three Turns hold **97%** of the document.
   Equal weight there does not degenerate quietly; it inverts — six marks of equal size standing
   for 1, 10 and 319 rows.
5. **Half of every specimen's Turns are 3 rows or fewer** — 71% ordinary, 50% lopsided, 49%
   #650 — and about half hold no work
   at all — the ticket's "is a conversational exchange better drawn as punctuation?" is the live
   question, not a rhetorical one.

## What it is faithful to, and what it is not

Every measure in the page is transcribed from the app and named where it is used:
`ArgoMinimapLane.rectMinimumHeight` / `.rectGap` / `.rectInset` / `.runOpacity` /
`.viewportMinimumHeight`, `ArgoLayout.minimapLaneShare` and `minimapLaneWidths`,
`ArgoFeedRow.column`, `ProseRhythm.lineHeight`, and `GraphitePalette`'s inks through
`FeedInk.role(in:)`. `MinimapGeometry` — `columnScale`, `fitScale`, `grain`, `laneTravel`,
`viewportY`, `offset(forLaneY:)` — is transcribed line for line, so A, B and D use the shipped
mapping unchanged and C and E's departures from it are visible as departures.

It is **not** a component structure and nothing here is to be ported. The winning variant is
rebuilt in Swift under #1173, against the design `prototype-to-design` lands.

## Not decided here

The threshold rule and the live-crossing latch are #1173. The work fold is #1172. This page only
asks what a Turn's mark should be.
