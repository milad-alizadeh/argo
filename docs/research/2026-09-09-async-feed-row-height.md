# How much does an async-rendered Feed row cost, and can its height be known first?

**Date:** 2026-09-09 · **For:**
[#1793](https://github.com/milad-alizadeh/argo/issues/1793), filed by
[#1752](https://github.com/milad-alizadeh/argo/issues/1752) ·
**Status:** measured, real corpus plus a synthetic scaling arm, interleaved repeats, least-of-7

The ticket set the terms: *"Most of this is a measurement, not a debate. Build the cheapest thing
that renders the diagrams from a real transcript in a browser and time them. If the whole set
renders in tens of milliseconds, the pass simply awaits them and rule 3 stands untouched."*

**It is not tens of milliseconds.** Ten real diagrams cost 2 990 ms summing each one's least time
and 3 878 ms summing each one's median, on one warm Chrome with nothing else on the page. (Neither
is a measured total: no run rendered the set end to end, and a sum of medians is not the median of
a sum. They bracket it.) Between a quarter and a third of the ≤3 s budget for the whole
4 800-record shape goes on a single diagram: the worst of the twelve costs 744 ms at its best and
879 ms typically. So the
branch the ticket offered — await them and leave rule 3 alone — is closed, and the rest of this
document is about which of the remaining three doors to walk through.

## Inventory

| Question the ticket asked | Where the answer is | Verdict |
| --- | --- | --- |
| Render cost of every mermaid diagram in a real transcript, worst and total | [Every diagram, timed](#every-diagram-timed) | Measured. Seconds, not milliseconds. |
| How it scales with diagram size | [Scaling](#scaling) | Linear in node count, ~5 to 9 ms per node, shape-independent. |
| Can a height be computed from source without rendering? | [Height without rendering](#height-without-rendering) | Yes if you own the layout engine — Argo already does, in Swift. No by predicting mermaid's output. |
| Same numbers for a remote image | [The other async cases](#the-other-async-cases) | Not a cost, an unknown. Reserving the box removes it entirely. |
| Same numbers for a late web font | [The other async cases](#the-other-async-cases) | Real reflow, size set by how far the fallback's metrics sit from the face's. |
| Same numbers for a code block awaiting a highlighter | [The other async cases](#the-other-async-cases) | Not a height case at all. Zero delta in every sample. |
| What happens to a diagram that fails to render | [A diagram that cannot render](#a-diagram-that-cannot-render) | Throws, returns nothing, leaves a stray node. The row has no natural height at all. |
| May a diagram be given a fixed-height frame? | [The one call that is not the measurement](#the-one-call-that-is-not-the-measurement) | **Still open. Not the implementor's.** |

Dead ends and near-misses are in [What went wrong on the way](#what-went-wrong-on-the-way); two of
them produced numbers that looked publishable and were wrong.

## Method

The rig is `prototypes/feed-async-height/`, and its README says how to re-run it. Four things
about it decide whether the numbers mean anything.

**The corpus is mined, not written.** `mine-corpus.ts` pulls every fenced block out of the local
Claude Code transcripts: 3 308 distinct blocks, of which 12 are mermaid. A hand-authored diagram
set would have measured the author's taste in diagrams rather than the size distribution agents
actually emit.

**The machine is a variable.** Repeats are interleaved round-robin across diagrams rather than run
seven times each in a row, so a thermal or scheduling excursion lands on every diagram instead of
on whichever one was unlucky. Every row carries its least time as well as its median: the least is
the closest thing to the code's own cost, the median carries what the machine did to it.

**Cold and warm are different numbers.** mermaid 11 initialises a diagram type on first use, so the
first flowchart in a document pays something the second does not. The first render of each kind is
recorded separately and excluded from that kind's warm statistics.

**The measure happens where the contract says it happens** — inside a `content-visibility: hidden`
container, which is the technique css-contain-2 §4.2 sanctions and which #1752 already chose.

**Only the diagram sweep got that hygiene.** The image, font and highlighter arms run once each,
with no repeats and no cold/warm split, because what they were built to establish is a height
DELTA — does the box move, and by how much — not a time. Read their milliseconds as an order of
magnitude and nothing finer; the deltas are the findings.

## Every diagram, timed

| id | kind | source | drawn height | cold | warm least | warm median | measure |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `mermaid-fd84b1b1` | class | 3275 B / 145 lines | 267 px | — | 744 ms | 879 ms | 11 ms |
| `mermaid-c5d37259` (repaired) | class | 3359 B / 145 lines | 267 px | 912 ms | 824 ms | 864 ms | 13 ms |
| `mermaid-ad19b64a` (repaired) | state | 2230 B / 44 lines | 496 px | — | 242 ms | 407 ms | 4 ms |
| `mermaid-63dcd06d` (repaired) | flowchart | 1795 B / 49 lines | 2463 px | — | 190 ms | 317 ms | 6 ms |
| `mermaid-66a87a3d` | flowchart | 1714 B / 49 lines | 2463 px | — | 245 ms | 305 ms | 5 ms |
| `mermaid-5e1be72e` | state | 2176 B / 44 lines | 496 px | 357 ms | 182 ms | 282 ms | 3 ms |
| `mermaid-bbcafff5` (repaired) | flowchart | 1688 B / 55 lines | 1294 px | — | 157 ms | 243 ms | 5 ms |
| `mermaid-a339ff5b` (repaired) | flowchart | 3230 B / 53 lines | 366 px | — | 127 ms | 199 ms | 5 ms |
| `mermaid-cdd2c469` | flowchart | 3155 B / 53 lines | 366 px | — | 136 ms | 198 ms | 4 ms |
| `mermaid-409370ad` | flowchart | 1535 B / 55 lines | 1294 px | 439 ms | 143 ms | 184 ms | 4 ms |
| `mermaid-2019ae14` (unreadable) | sequence | 2266 B / 38 lines | 0 px | — | — | — | — |
| `mermaid-e1e4daa1` (unreadable) | sequence | 2122 B / 38 lines | 0 px | — | — | — | — |

Two of the twelve mined diagrams are unreadable by mermaid, and five more were only readable after
repair — see [The corpus is partly unrenderable](#the-corpus-is-partly-unrenderable), which is a
finding in its own right and not a defect in the rig.

**The cold/warm gap is not the story.** Where a cold number exists it sits inside the same spread as
that kind's warm medians, so mermaid's per-kind initialisation is not what costs; the graph layout
is. A pass therefore pays the full cost per diagram, not once.

**Measuring is free.** Reading the rendered SVG's height cost single-digit milliseconds in every
case, two orders of magnitude under the render. Nothing in this problem is about measurement; it is
all about producing the thing to measure.

## Scaling

| shape | nodes | source | drawn height | least | median | ms per node |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chain | 5 | 140 B | 492 px | 35 ms | 42 ms | 7.1 |
| fan | 5 | 141 B | 388 px | 39 ms | 44 ms | 7.7 |
| chain | 10 | 300 B | 1012 px | 60 ms | 139 ms | 6.0 |
| fan | 10 | 255 B | 385 px | 63 ms | 216 ms | 6.3 |
| chain | 20 | 658 B | 2052 px | 119 ms | 315 ms | 6.0 |
| fan | 20 | 504 B | 206 px | 114 ms | 128 ms | 5.7 |
| chain | 40 | 1378 B | 4132 px | 212 ms | 232 ms | 5.3 |
| fan | 40 | 1011 B | 104 px | 206 ms | 410 ms | 5.1 |
| chain | 80 | 2818 B | 8292 px | 506 ms | 839 ms | 6.3 |
| fan | 80 | 2024 B | 56 px | 414 ms | 847 ms | 5.2 |
| chain | 160 | 5936 B | 16612 px | 1339 ms | 1552 ms | 8.4 |
| fan | 160 | 4177 B | 30 px | 1140 ms | 1500 ms | 7.1 |
| chain | 320 | 12336 B | 33252 px | 2924 ms | 3293 ms | 9.1 |
| fan | 320 | 8657 B | 21 px | 2741 ms | 3084 ms | 8.6 |

Cost is linear in node count at roughly 5 to 9 ms per node, and the two shapes agree. That
matters: `chain` grows the rank count while `fan` grows the widest rank, and dagre's ordering pass
— the one with the worst complexity — has real work only in the second. Within this size range it
does not separate them, so the cost is not the crossing-reduction pass and there is no size below
which mermaid becomes cheap.

The drawn heights are worth reading beside the times. A 320-node chain is 33 252 px tall; a
320-node fan is 21 px. Diagram size and row height are unrelated, so nothing about a row's
appearance predicts what it costs to produce.

## Height without rendering

The ticket's framing — *"arithmetic over the same graph layout mermaid is already doing"* — is
right about what the job is, and the measurement says who has to do it.

`predict.ts` is the cheap version of that arithmetic: read the source, layer the graph, multiply by
mermaid's own configured node height and rank separation. It never renders and returns
synchronously.

| id | kind | predicted | drawn | error |
| --- | --- | ---: | ---: | ---: |
| `mermaid-409370ad` | flowchart | 740 px | 1294 px | -43% |
| `mermaid-5e1be72e` | state | 338 px | 496 px | -32% |
| `mermaid-63dcd06d` | flowchart | 998 px | 2463 px | -59% |
| `mermaid-66a87a3d` | flowchart | 998 px | 2463 px | -59% |
| `mermaid-a339ff5b` | flowchart | 482 px | 366 px | 32% |
| `mermaid-ad19b64a` | state | 338 px | 496 px | -32% |
| `mermaid-bbcafff5` | flowchart | 740 px | 1294 px | -43% |
| `mermaid-c5d37259` | class | 830 px | 267 px | 211% |
| `mermaid-cdd2c469` | flowchart | 482 px | 366 px | 32% |
| `mermaid-fd84b1b1` | class | 830 px | 267 px | 211% |

**A cheap predictor is not close enough to be a height.** Against a standing rule that 3 pt of drift
is a bug rather than noise, 211 % is not a rounding error — it is the wrong row. The errors are
not noise either, they are structural: mermaid's node heights depend on label text wrapping at
`wrappingWidth`, which is a real text measure, and its class layout packs boxes in ways a rank count
does not see.

**But the exact answer exists, and Argo has already built it once.**
`apps/macOS/Packages/ArgoMermaid` is a hand-written mermaid layout engine: 122 Swift files, 9 328
lines, eleven diagram kinds, and `MermaidLayout` produces a `MermaidPlan` whose `size` is the
diagram's height — computed headless, synchronously, with no renderer and no DOM. ADR-0030 rule 2
is written against exactly that. So the answer to the ticket's question is:

- **Yes**, if the height comes from a layout engine you own. That is Argo's current architecture and
  it has no async problem at all.
- **No**, if the height is a prediction of what a third-party renderer will do. You would be
  reimplementing dagre and mermaid's text measurement to agree with them, and any version bump
  silently invalidates it.

**One route between those two was not tried.** The ticket's phrase — "the same graph layout mermaid
is already doing" — also reads as *calling* it: driving mermaid's own bundled `dagre-d3-es` over the
parsed graph without ever producing SVG. That would inherit the constants and the text measure the
predictor here has to guess at, so its accuracy is not this table's. What it costs is unmeasured,
and the scaling numbers above suggest the layout IS the cost, so it is unlikely to be cheap. It is
the first thing to measure if neither of the outer answers is acceptable.

This reframes the migration question that #1752 left open. The choice is not "mermaid.js, awaited or
framed". It is whether the DOM Feed hosts mermaid.js at all, or whether ArgoMermaid is ported.

## The other async cases

| case | cost | what happened to the height |
| --- | ---: | --- |
| image, no reserved box | 128 ms | height at insert 21px, settled 125.5px |
| image, box reserved | 173 ms | height at insert 125.5px, settled 125.5px |
| late web font | 143 ms | fallback 64px → real face 77.5px, delta 13.5px |
| highlight ts ts-85637ffe | 483 ms | plain 1998px → highlighted 1998px, delta 0.0px |
| highlight swift swift-5cbac963 | 270 ms | plain 4014px → highlighted 4014px, delta 0.0px |
| highlight json json-e51564d7 | 349 ms | plain 107604px → highlighted 107604px, delta 0.0px |
| highlight bash bash-1b702c14 | 24 ms | plain 954px → highlighted 954px, delta 0.0px |
| highlight tsx tsx-46b61ec6 | 333 ms | plain 954px → highlighted 954px, delta 0.0px |

**A remote image is not slow, it is unknown.** With no reserved box the element measures a bare line
box at insert and jumps to the real size when the bytes land; with `width`/`height` set, the height
at insert already equals the settled height and there is nothing to await. The milliseconds are the
served delay plus the network stack and are not a property of the browser worth quoting.

**A late web font is a real reflow, and its size is a design decision.** The delta is entirely a
function of how far the fallback's metrics sit from the arriving face's. At 14 px over a 600 px
column the recorded sample moves a paragraph from 64 px to 77.5 px — 13.5 px, a fifth of its
height — when Courier New replaces `-apple-system`. A separate probe with Georgia as the arriving
face moved the same paragraph by 0 px, which is why Georgia is not the served face: a
metric-matched fallback removes this case entirely, and an unmatched one reflows every prose row in
the document after the pass has declared it settled.

**A highlighter is not a height case.** Five languages, plain `<pre>` against shiki's output at the
same font and width: the height delta was 0 px every time. Highlighting recolours a fixed number of
lines, which is the finding; one sample per language is enough to establish a zero.

Its milliseconds are not, and should not be quoted as a per-block cost. The 483 ms worst is the
**first** call in the run, on a 1 998 px TypeScript block, while a 107 604 px JSON block later in
the same run cost 349 ms and a 954 px bash block cost 24 ms — that ordering says the number is
mostly shiki's first-call initialisation, not the block. Either way the pass can pay it after the
first paint without moving anything.

## A diagram that cannot render

The ticket asks for this explicitly, and it is the case with the sharpest consequence.

```
threw:           true
returned:        no SVG, nothing to measure
stray node left: div#dfeed-async-height-failure
message:         Parse error on line 2: ...lowchart TB  A --> ((( bad
                 Expecting 'AMP', 'COLON', 'PIPE', ... got 'DOUBLECIRCLESTART'
```

Three things follow. `mermaid.render` **throws**, so a pass that does not catch per diagram loses
the whole document to one bad fence — the first version of this rig did exactly that. It returns
**no SVG**, so there is nothing to measure and the row has **no natural height at all**. And it
leaves a **stray `div` in `document.body`** that the caller has to clean up.

That last consequence is the important one for the product call below: **whatever is decided about
diagrams in general, the failure case has to be given an invented height.** There is no version of
this where every row's height comes from its content.

### The corpus is partly unrenderable

Five of the twelve mined diagrams carry `&gt;` where they mean `>` — the transcripts hold them
HTML-escaped — so mermaid refuses them as written. Two more fail for unrelated syntax reasons and
are unreadable by any route. **Seven of twelve real diagrams do not render as found.**

This is not a rig artifact: the escaping is in the transcript bytes, the miner does no encoding, and
unescaping repairs exactly the five. It is a fact about what a Feed will be handed, and it means the
failure path is not an edge case to be sketched — it is a majority of the sample.

## The one call that is not the measurement

The ticket reserves this, correctly: **may a diagram be given a fixed-height frame it draws inside,
scaled or scrolled, instead of its natural size?** That is what a reader sees, so it is not the
implementor's. Nothing below is a decision; it is what each answer now costs, given the numbers.

The measurement does change the shape of the question in one way. A fixed frame removes the
dependency of the ROW's height on the render — it does not remove the render. The diagram still
costs its seconds; the frame only decides whether the document has to wait for them.

| Door | Rule 3 | What the reader gets | What it costs |
| --- | --- | --- | --- |
| **Fixed frame, render after first paint** | Intact | A stable box that fills in a moment later, at a size the reader did not choose | Cheapest to build. Diagrams are scaled or scrolled inside a frame forever. |
| **Port ArgoMermaid to TypeScript** | Intact | Natural size, settled before first draw, as today | A port of ~9 328 lines of Swift, and the eleven kinds' tests with it |
| **Host mermaid.js and await it in the pass** | Broken | Natural size | Seconds of blocked main thread for ten diagrams (2 990–3 878 ms measured), before any prose is typeset |

The third door is the one the ticket hoped for and the numbers close.

Two things are true whichever door is taken. The failure case needs an invented height regardless.
And a late web font reflows settled prose unless the fallback is metric-matched, which is a
stylesheet decision nobody has made yet.

## What went wrong on the way

Recorded because two of these produced numbers that looked publishable.

- **A corrupt inline PNG.** The image arm carried a hand-typed base64 blob that Chrome refused to
  decode. It fired `error` rather than `load`, and the arm reported a settled height of 21 px for a
  240×120 picture — a plausible-looking number for a broken-image placeholder. The fixture is now
  generated by `png.ts`, which cannot be wrong about its own dimensions.
- **A font arm that could not detect a font.** The first version set `line-height: 1.5`, which pins
  every line box to a multiple of the font size and hides the face's metrics entirely, and it never
  checked that the face had applied. It reported a 0 px delta, which was true and meant nothing. It
  now uses `line-height: normal`, reports whether the face applied, and picks a face whose metrics
  differ from the fallback — because the first one chosen, Georgia, genuinely does not.
- **`content-visibility: hidden` measures zero.** The measurement container's own
  `getBoundingClientRect().height` read 0 px for all 24 rendered rows, because size containment
  is active on the container itself. The inner element measures correctly. A pass that measures the wrong
  element gets a clean, confident, useless answer.
- **One bad diagram killed the sweep.** `mermaid.render` throws, and the first version caught it
  only at the top level, so the first unreadable fence ended the run. Fixed per diagram, which is
  also the shape a real pass needs.
- **The predictor had no `LR` case.** It returned one node's height for every left-to-right diagram
  and was 96 % low on the corpus's worst. That looked like evidence that arithmetic cannot do this;
  it was a missing branch. The [Height without rendering](#height-without-rendering) verdict is
  written against the fixed version.

## What this does not settle

- **No Electron number.** These are Chrome 152 on macOS at DPR 2. Electron is Chromium,
  so the engine is the same, but nothing here is pinned to the version Argo will ship.
- **No cost for the whole pass.** This measures diagrams, not a Feed. What 459 rows of mixed shapes
  cost together is #1752's open ≤3 s gate, which still has no home.
- **Two figures are not in the committed artefacts.** "3 308 distinct blocks" is the miner's
  console output over `corpus.json`, which is gitignored, so it cannot be checked from this repo;
  and the run recorded `mermaidVersion: "unknown"` because mermaid 11 does not expose one on its
  default export, so "mermaid 11" rests on the lockfile rather than on the run.
- **The port is unpriced.** "Port ArgoMermaid" is a line in a table, not an estimate. Nobody has
  looked at how much of those 9 328 lines is layout and how much is Swift ceremony.
