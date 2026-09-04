# One loading row for the feed — throwaway prototype

**This branch is a primary source, not a starting point.** It exists so the six questions in
[#1246](https://github.com/milad-alizadeh/argo/issues/1246) can be *looked at* rather than read.
It is deliberately not on `main`: written under prototype constraints — no tests, no
abstractions, one file — and the validated decision lands in the spec, not here.

## Run it

```sh
open docs/designs/prototypes/feed-loading-row-prototype.html
```

No build, no server, no dependencies.

## The question

*What shape does the ONE row take that says "Argo is doing a thing and you are waiting for it"?*

Today there are three shapes for that idea and one case with no shape at all:

| the wait | what the feed shows today |
|---|---|
| the CLI has started and has not spoken | `starting the agent`, a caption in the rule |
| a Turn is in flight | an ion crossing the column, no words |
| `/handoff` runs | **nothing** — only the header button (#1229) |
| a Session resumes from orphaned | nothing named |

## Reading the URL

| Parameter | Effect |
|---|---|
| `?variant=A\|B\|C` | Which shape the wait takes. Also `←`/`→`, or the floating bar. |
| `&case=starting\|handoff\|resume\|turn` | Which of the four waits. |
| `&state=running\|done\|failed` | Where that wait got to. |
| `&age=0\|10\|60\|300` | The `ArgoWaitAge` ladder — period and glow move with it. |
| `&speed=1.2\|1.5\|1.9\|1.0\|0.8` | The ladder's base period. **1.2s is approved**; 1.9s is what shipped. |
| `&still=1` | Reduce Motion. |

Every state is reachable by URL, which is the point: a state you cannot link to is a state
nobody re-checks. The panel on the right prints what the current variant is *asserting* about
each of the six questions, so a screenshot carries its own argument.

## The three variants

- **A — the wait is a call row.** The call row's own metrics: the 15pt mark column, the body
  rung, one line, and the same ion washing the type left to right. It **keeps its place** when
  the wait ends: the row settles to tertiary and gains what it took.
- **B — the wait is a rule with its words let into it.** Today's `starting the agent` shape,
  given a symbol and a pass travelling along the rule. It **goes** when the wait ends well;
  only a failure keeps its place.
- **C — the wait stands at the foot.** Not a feed row at all: a plinth above the composer, one
  at a time. It **arrives** in the feed at the end, so the reading is written once and never
  edited.

## What each variant answers

| # | question | A | B | C |
|---|---|---|---|---|
| 1 | the shape | a call row | a rule across the column | a plinth outside the reading |
| 2 | after it ends | keeps its place | goes, unless it failed | arrives only at the end |
| 3 | the ion | the thread stays as it is — this row is for waits with WORDS | the thread joins: it is this rule with the caption left out | the thread stays AND the plinth names the same wait |
| 4 | the symbol | one per named wait; the unnamed wait draws an EMPTY mark column | one per named wait, caption size; the unnamed wait draws the rule alone | one per named wait, body size |
| 5 | a failed wait | the whole line in failure ink, as a failed call row, plus the reason in mono | the caption AND the rule in failure ink | the plinth turns failure and stays until dismissed; the row lands failed |
| 6 | the tier | DIRECT only, in all three — every wait here is something Argo STARTED and is waiting on. Nothing DERIVED may take this row. | | |

Question 3 is the one to watch in C. The plinth and the thread are on screen together at
`?variant=C&case=turn&state=running`, saying one wait twice. That is either the honest split —
a wordless signal in the reading, a worded one at the foot — or a duplication. The prototype
does not decide it; it makes it visible.

The failed states are drawn under a Turn that ends in a **failed call row**, on purpose: a failed
wait has to be told apart from a failed call at a glance, and that comparison cannot be made on
a clean screen.

## The symbols, from `ArgoSymbol`

| wait | symbol | why |
|---|---|---|
| Starting the agent | `startSession` — `play.fill` | the act Argo performed |
| Handing off | `handedOff` — `arrow.right.circle` | the mark the settled handoff row already carries |
| Resuming | `retry` — `arrow.clockwise` | the chain picked up again |
| Waiting for the agent | **none** | a mark is a claim about what happened, and "thinking" is not something that happened. `FeedCallLine` already draws an empty mark column for a call of unknown kind — the same answer |

An unnamed wait therefore gets **no default symbol** in any variant. The three that differ are
what they do with the empty column.

## The ion's speed, settled here

One filament of **216pt** — `0.3 × ArgoFeedRow.column`, stated as a **length and not a share** —
wherever the ion runs: the thread across the measure, the plinth's rail, the rule's own pass.
That is the whole of why the plinth read slower than the feed at one period:
`ArgoFeedRow.workingThreadTravel` is stated in multiples of the filament's OWN length, so a
shorter filament in a narrower lane covers less ground per pass. One length is what makes one
period one velocity.

The base period drops from **1.9s to 1.2s**, and the `ArgoWaitAge` ratios are held and rebased
on it. Rounded to a tenth: a period is something a person feels, not a figure anything computes
against.

| Age | `ArgoMotion.working` shipped | approved | Glow |
|---|---|---|---|
| under 10s | 1.9s | **1.2s** | 0.60 |
| 10s – 60s | 2.8s | **1.8s** | 0.49 |
| 1m – 5m | 3.8s | **2.4s** | 0.40 |
| over 5m | 4.9s | **3.1s** | 0.30 |

The cooling still cools and never warms, and the floor is still a floor — 3.1s is slow enough to
read as patient and fast enough to read as travel, which is the pair `ArgoWaitAge.coldest`
exists to hold.

## What it is faithful to

Every colour, radius, spacing step and type role is transcribed from
`apps/macOS/Packages/ArgoDesign/Sources/ArgoDesign/` (`GraphitePalette`, `ArgoSpacing`,
`ArgoRadius`, `ArgoStroke`, `ArgoWaitAge`) and from `ArgoFeedRow.swift`. The ion ramp is
`docs/designs/cockpit-feed-working.md`'s, stop for stop. Nothing is invented — except the two
numbers this study was run to re-judge: the ion's length and the ladder's base period, both
settled above.

Two things it is **not** faithful to, both known:

1. The wash is a **second copy of the sentence** laid over the first and clipped to its glyphs.
   In Swift it is one mask over one painting surface — `FeedCallLineIon` already does that, and
   is what a build should port, not this.
2. The pass is animated on `background-position` rather than on a transform. The approved design
   says **animate `transform` only**; the CSS shortcut is a prototype convenience and would be a
   defect in the app.

The SF Symbols are traced as SVG paths. They read at 12–13px, which is all this needs; a build
takes the real symbol by its `ArgoSymbol` name.

## Not settled here

The spoken form for a screen reader. Every wait needs a sentence — `FeedWorking.spoken` and
`FeedMark.spoken` are where those live, and a shape crossing the column carries nothing to a
reader who cannot see it. That is prose, and prose is decided in the ticket.
