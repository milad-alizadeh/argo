# Navigating a long session — throwaway prototype (#1174)

**This branch is a primary source, not a starting point.** It exists so the question in
[#1174](https://github.com/milad-alizadeh/argo/issues/1174) can be *used* rather than argued
about. It is deliberately not on `main`: prototype constraints, no tests, no abstractions, and the
validated decision belongs in `docs/designs/`, not here.

The ticket asks what a Turn's **mark** should be. Halfway through, the question widened to the one
underneath it: **how do you get around a 400-Turn session at all?** Nine of the thirteen variants
answer the first question; four answer the second, and those four are where the interesting
results are.

## Run it

```sh
node docs/designs/prototypes/turn-lane-specimens.mjs   # only to re-read the transcripts
python3 -m http.server 8974 -d docs/designs/prototypes
open http://127.0.0.1:8974/turn-lane-prototype.html
```

A server rather than `file://` only because Chrome's automation refuses `file://`; the page has no
build, no dependency and no network call, so `open …/turn-lane-prototype.html` works too.

`←`/`→` or the letter keys switch variant, `1`/`2`/`3` switch specimen, `⌘K` opens the jump
palette from anywhere. There is no **I** — it reads as a `1` beside the specimen keys.

| Parameter | Effect |
|---|---|
| `?variant=A…N` | Which lane or surface. |
| `&s=ordinary\|lopsided\|longtail` | Which specimen. |
| `&starved=1` | Light every mark drawn at the 1pt floor, in red. Prototype instrument, not design. |
| `&ink=0` | Take the colour away — the shape-only reading. |
| `&gamma=0.2…1` | E's compression exponent. |
| `&deck=<pt>` | The deck's height. 800 by default, the height every figure in #1173 is quoted against. |

The feed on the left is the real reading at real scale, so the lit rectangle, the click and the
drag are judged rather than described.

## The two families

### A–E, J: what a Turn's MARK is (the ticket's own list)

- **A — Proportional bars.** One bar per Turn at its true extent, floored at 1pt.
- **B — Proportional, banded.** The same bars split into prompt / work / prose shares.
- **C — Equal ticks beside a rail.** Even marks; a rail keeps position and the viewport rectangle.
- **D — Proportional + boundary comb.** Bars plus a 1pt tick per boundary at its true position.
- **E — Adaptive compression.** `extent^γ`, renormalised. The rectangle maps through the same curve.
- **J — Density field + your own ticks.** *Stop drawing marks.* The lane is a continuous field, so
  nothing can be starved — there is no rect and therefore no floor. The only marks left are the
  Turns you opened by typing, at their true positions. **Fully linear, always fits.**

### F–H, K–N: how you NAVIGATE

- **F — Work ticks, magnitude across.** Equal weight down the lane, size *across* it on a log
  scale. Turns that did no work stop being marks and become punctuation in a 6pt gutter at their
  true position — the gutter is the proportional rail, made of the same Turns.
- **G — Chapters, one open.** Turns group into chapters at the gaps where somebody left the
  keyboard; each keeps an equal band **named by what it opened with**; only the chapter the
  reading is in opens into per-Turn ticks. Fits by construction at any length.
- **H — Worked time, not document.** Maps the clock. A Turn stands as long as it ran; an absence
  over 20 minutes is a drawn seam rather than mapped lane.
- **K — Outline.** Not a map. Every Turn as a line you can *read* — what was asked, what it did,
  how long — searchable and filterable to "I asked" / "did work". The lane shrinks to a rail.
- **L — Loupe.** The lane stays compressed and stops pretending to be legible; hovering opens a
  loupe on the **real rows** under the pointer, at a scale chosen locally so a dozen rows fit.
- **M — Jump palette (⌘K).** Type a word you remember; Turns rank by it, arrow, enter.
- **N — Ribbon.** The map turned ninety degrees: a 64pt strip across the head of the deck, one
  column per Turn, height for size, chapters named underneath, your own Turns pipped on the
  baseline.

## What the prototype found

Every figure is the page's own, re-derived at a 120 × 800pt lane over modelled heights.

1. **No vertical lane can navigate #650.** The lane holds 400 distinguishable marks
   (`800 / (rectMinimumHeight + rectGap)`); the session has 413 Turns. A, B, D and E window it;
   C's even spacing lands at 1.9pt a mark; H fits but floors 71% of them. Turn granularity does
   not remove #650's fold — it moves it from 5,000 rows to 413 Turns. **Only F (231 marks, work
   only), G (chapters), J (a field) and the three non-lane surfaces fit.**
   Re-derived over drawn geometry, coverage at Turn grain reads **21%**, against #1173's
   floor-model **74%** — that gap is #1173's figure at stake, not this one's, and it should be
   settled before that ticket builds.
2. **The deck is wider than it is tall, and the map was in the wrong dimension.** 800pt of lane
   against ~1030pt of deck width: **N gets 30% more room and a width per Turn the lane never
   had.** 413 Turns come out at 2.5pt columns with real height for magnitude, chapter names
   underneath, and the reading keeps its full height.
3. **Failure is not a Turn's ink.** A call fails all day — a `cd` into the wrong folder, a grep
   that matched nothing — and none of it is news. 18% of #650's Turns hold one, so loudest-wins
   would have painted a fifth of the lane red for errands. The feed inks the failed *line*, where
   the reader is looking at that line; the lane inks what the Turn **was**. A *question* still
   wins — it is the one state waiting on somebody. `dominantInk` carries the rule.
4. **Reading found a data bug that looking never would.** The first outline render was full of
   `<task-notification>`, `<command-name>` and `<local-command-stdout>` — the CLI writes into the
   user's side of the record and the record does not flag it. **27 of #650's 440 Turns were opened
   by text nobody typed.** A slash command is now unwrapped to its name, the rest is punctuation,
   and the Turn count fell to 413. Every variant was wrong before that and none of them showed it.
5. **The clock is not more even than the document.** H fits the whole session, and 71% of its
   marks still land on the floor: Turn *durations* are as power-law as Turn *extents*. Time
   buys the seams (a 10-hour night drawn as a mark, not as lane) and nothing else.
6. **Half of every session does not deserve a mark.** 44% of #650's Turns did no work and
   asked nothing — 50% of the lopsided one's, 68% of the ordinary one's — a
   question and an answer. Dropping them is what makes F fit, and the ticket's own open question
   ("is a conversational exchange better drawn as punctuation?") answers **yes** on the arithmetic.
7. **The slivers on a session that fits are smaller than feared** — ordinary: 19% of marks at the
   floor, 27% under 2pt. The lopsided specimen inverts rather than degenerates: **three Turns hold
   97% of its document.**

## The data is real; the heights are modelled

`turn-lane-specimens.mjs` reads the three transcripts #1174 names, off this machine, and restates
`FeedProjection` + `TurnExtents` in JS. **Real:** every row's existence, kind, order, words and
wall clock, and every Turn boundary. **Modelled:** every row's height — the app measures with Core
Text (`FeedRowMeasure` → `FeedProseFrame`); this wraps at an average advance.

| specimen | #1173 rows / Turns | this projection, unfolded | folded |
|---|---|---|---|
| `0ec3b3b6` ordinary | 592 / 85 | 540 / 93 | 436 |
| `bb7ebce2` lopsided | 552 / 11 | 452 / 6 | 323 |
| `b541025d` #650 | 5,017 / 543 | 3,933 / 413 | 2,848 |

Chased far enough to know the class of the gap and no further — the ask/gallery/unreadable rows
this reader does not model, and the meta records it drops. **Nothing above rests on matching those
counts:** every figure the page prints, it re-derives from what it drew. The specimens are read
**unfolded**, as #1174 asks.

## What it is faithful to, and what it is not

Every measure is transcribed from the app and named where it is used:
`ArgoMinimapLane.rectMinimumHeight` / `.rectGap` / `.rectInset` / `.runOpacity` /
`.viewportMinimumHeight` / `.labelWidth`, `ArgoLayout.minimapLaneShare` and `minimapLaneWidths`,
`ArgoFeedRow.column`, `ProseRhythm.lineHeight`, and `GraphitePalette`'s inks through
`FeedInk.role(in:)`. `MinimapGeometry` — `columnScale`, `fitScale`, `grain`, `laneTravel`,
`viewportY`, `offset(forLaneY:)` — is transcribed line for line, so A, B, D, J and the rails use
the shipped mapping unchanged and every departure from it is visible as a departure.

It is **not** a component structure and nothing here is to be ported. The winner is rebuilt in
Swift under #1173, against the design `prototype-to-design` lands.

## Not decided here

The threshold rule and the live-crossing latch are #1173. The work fold is #1172.
