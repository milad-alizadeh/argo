# 0029 · A feed opens at its tail only once a height is cheap, and never by discovery

Status: proposed · 2026-08-31

Binding on `apps/macOS`. Read against `argo/perf-60fps` at
`92f3726556a4ba75c20d6d578efd31a53f0dd74b`. It answers the tail-first open proposed against the
21.7 s settle, and **recommends against building it now**. It extends
[ADR-0028](./0028-cost-is-a-gate.md), whose Rules 3, 4, 5 and 7 are what most of the objections
below are made of, and it settles the Minimap's whole-document contract either way.

## Recommendation

**Do not build the tail-first open.** Not because it would not work — a snapped tail boundary is
reachable and the contracts for it are written out in Part 3 below — but because its entire win is
the removal of N per-row measurements, and the change already in flight on
`argo/coretext-heights` removes the *cost of one measurement* instead. Measured on the very
transcript the 21.7 s was recorded on: the Feed draws about **987 rows**, not 4 086, and the
median prose row in it is **16 characters** long. A 16-character row costing ~22 ms is
`NSHostingController.sizeThatFits` overhead, not text — so the constant is the defect and the row
count is not. Tail-first attacks the wrong factor, and it pays for the attack by re-creating the
estimated-height document that #473, #476, #477 and the seam shake were all one bug about, by
renumbering `FeedRow.ID` under every store keyed on it, and by owing the Minimap a new visual
state that has no design.

Two things should be built regardless, and neither is tail-first: **a height that costs no layout
pass** (Step 1, already in flight) and **one whole-document walk per reshape rather than one per
layout** (Step 2, small and local). If those two together do not bring the walk inside a frame
budget, come back to Part 3.

## Context

The report: opening a Session shows the whole document, and a 4 086-row / 55 MB real transcript
measured a **21.7 s** settle after the click — Release, surface-settle being the accessibility
tree unchanged for 300 ms.

Both of those numbers describe the transcript **file**, and neither describes the Feed. Measured
here on that transcript, with a throwaway probe over the JSONL:

| figure | value | why it matters |
| --- | --- | --- |
| file lines | 4 086 | the "4 086 rows" — it is the line count, not a Feed row count |
| Feed rows before the folds | 1 148 | `prompt`, `message`, `thought`, `toolCall`, `turnEnded` |
| Feed rows after the folds | ~987 | the call-run, survey, gallery and unreadable folds take ~14% |
| file bytes | 56.8 MB | of which the Feed's prose is **162 KB — 0.29%** |
| p99 line | 624 KB | the 50 largest lines are 59% of the file: tool results, not prose |
| Turns | 197 | `turnEnded` fires on 61 of 910 assistant records, not on all of them |
| Turn size | median 3 rows, p90 15, max 39 | a Turn varies thirteenfold and is not a unit of size |
| prose row length | median 16 chars, p90 343, max 20 192 | most rows are one short line |
| last 10 Turns | 65 rows, 6.6% of the document | what a tail-first open would actually show |
| spend in the last 20 Turns | 13.3% of the document total | the roll-up is not tail-local — see Finding 3 |
| basenames needing a parent to tell apart | 0 of 86 paths | `toldApart` did not diverge here, which is worse than if it had |

So ~987 rows against 21.7 s is roughly **22 ms a row**, on rows whose median content is sixteen
characters. That is the shape of a per-row constant, not of a document-length problem.

And the whole-document walk is not where the chunked machinery is.
`FeedTableCoordinator+Remeasure.swift` yields between batches of 50 and states plainly that it
"runs to the end rather than leaving the rest to be measured as they scroll in: the minimap is a
miniature of the WHOLE document". But the Minimap does not wait for it:

| cost | site | trigger |
| --- | --- | --- |
| ~987 synchronous `sizeThatFits` | `MinimapLaneView.refresh()` → `FeedTableHandle.reading()` → `FeedTableCoordinator.reading()` | `layout()`, and every reshape notice |
| ~987 more, chunked | `remeasureEverything` → `measureTail` | every `.all` re-measure, which every settle fires |

`reading()` builds a `MinimapRow` per row and each one calls `measuredHeight(at:in:)`, which
**measures on a miss**. It is called from `NSView.layout()`. The lane is therefore not a consumer
of whole-document geometry — it is what forces it, eagerly, on the main thread, inside a layout
pass. Any honest account of the 21.7 s has to say how many times that walk ran, and this document
cannot: see Consequences.

There is a second whole-document cost above the table, and it is the one place the proposal has a
real case. `SessionsRoomReading.init` runs `FeedProjection.rows(from:)` synchronously on the main
actor inside `CockpitView.body`, and a cache miss there costs **four** whole-stream walks, not one
— `FeedProjection`, `PlanProjection`, `SessionHeaderProjection.Worked.read(across:)` and
`FeedAgentReadings`. `SessionsRoomReadingCache`'s `Stamp` keys on `events` as a **count**, and its
own soundness note is a prefix argument: "the streams are append-only within a Session … so a
count names a prefix and a count that has not moved names the same prefix". Which means an append
is always a miss, and the whole array is re-projected through eleven passes on every transcript
batch. Tail-first would make each of those passes shorter. It would not make them fewer, and the
row-level walk below is where the milliseconds are.

## Decision

Six parts. Part 1 is the recommendation, Part 2 is what to build instead, Part 3 is the set of
contracts that bind **if** tail-first is ever built, Part 4 goes through the folds one at a time,
Part 5 says what tail-first would do to the work already on this branch, and Part 6 is what any of
it is measured with.

### Part 1 · The tail-first open is not built now

**Finding 0 · The row id defeats the proposal on its own, before any fold.** `FeedRow.id` is a
dense position — assigned by the `enumerated()` at the foot of `FeedProjection.rows(from:)`, and
`FeedReading.swift` states the consequence: "row 12 of a Session is row 12 of the next one". The
reader's folds, the open row, the wash, `FeedGeometry`'s index, `FeedAnchor.row`, `FeedTableDelta`
and `MinimapRow` are all keyed on it. **Prepending renumbers all of them.**
`FeedTableDelta.between` returns `.reload` for anything that is not a suffix-preserving append,
and `FeedTableCoordinator.execute` drops **every** measured height on a `.reload`. So extending
backwards in K chunks costs K whole-document re-measures rather than one — strictly worse than the
21.7 s it was meant to remove, and worse in proportion to how gently the head is discovered.
Tail-first cannot be built at all until `FeedRow.ID` is stable under prepend, which is a change to
the identity ADR-0028 Rule 5 has only just finished re-keying everything onto.

And there is nothing to key it on. `TranscriptEvent` carries **no** id, no file offset and no line
number; the only identity in the stream is `case recordIdentity(uuid:)`, which the reader emits as
a *sibling* event ahead of a record's others, plus `ToolCall.id`. So a stable row id is not derived
from the event — it has to be **invented**, in `ArgoEngine`, on a public enum that the Hub, the
plan ledger and the join all read. That is the first cost of tail-first, it is paid in the engine,
and it buys no frame on its own.

### Part 2 · What is built instead, smallest first

**Step 0 · The refutation test.** For the long fixture and for every candidate boundary, the
suffix of `FeedProjection.rows(from: events)` from that boundary must equal the rows projected
from `events.suffix(from: boundary)` with the non-local facts handed in — row for row, content
included. It lands alone, changes no behaviour, and it is what says whether Steps 3–6 are possible
at all. Write it first; if it cannot be made green, Part 3 is refuted and this ADR is closed.

**Step 1 · A height is measured without a layout pass.** `argo/coretext-heights`. Not this ADR's
work and not this ADR's to gate, but it is where the win is: the constant, not the count. The
machinery already exists — `MinimapProseBlock.laid(ink:across:)` already computes a CoreText
height for the lane's own band off `ProseReading.structure(of:)`, so the row height and the lane's
height can come from one measurement instead of two. **If this alone brings the whole-document
walk inside a frame budget, Steps 3–6 are never built.** That is the most useful sentence in this
document.

**Step 2 · The whole-document walk happens once per reshape, not once per layout.**
`MinimapLaneView.refresh()` holds a `reshapedTo` stamp for exactly this, and the rects layer
already skips a build on a matching `paintedAt`. But `refresh()` calls `feed?.reading()` — the
walk — *before* it consults either. Gate the walk on the stamp. Local, leaves the app correct, and
if the settle turns out to be many walks rather than one long walk, this is most of it.

**Step 3 · `FeedRow.ID` becomes stable under prepend.** Which means an identity on
`TranscriptEvent` first, since there is none today, and then everything keyed on position — the
folds, the open row, the wash, `FeedGeometry`'s index, `FeedAnchor`, `FeedTableDelta`, `MinimapRow`
— moved onto it. Nothing user-visible. This is the price of admission for tail-first and it is a
larger change than tail-first, spanning both packages.

**Step 4 · The projection takes its non-local facts as parameters.** The working directory, the
spend total, the rivalry index and the asking offer, each computed over the whole event stream and
handed in rather than folded out of what is shown — see Findings 2, 3, 5 and 9. Nothing
user-visible, and independently good: it turns three facts the projection currently *discovers*
into facts it is *told*, which is the only way a boundary can be tested at all. It is what Step 0
asserts against.

**Step 5 · The lane learns an unmeasured extent**, with a design in `docs/designs/` — see
Contract 1. **Step 6 · The feed opens at a snapped tail boundary** — see Contract 3.

Steps 0, 1 and 2 land whatever happens. Steps 3–6 are conditional on Step 1 failing to close the
gap, and the expectation recorded here is that it will not fail.

### Part 3 · The contracts, if tail-first is ever built

**Contract 1 · The Minimap draws no miniature of a region it has not measured.** Of the three
routes, (c) blocking the first paint is what happens today and is the defect; (b) cheap
whole-document geometry by another route is Step 1, and it keeps the lane's contract *unchanged*,
which is why it is the recommendation. Only if (b) fails does the lane take route **(a), a lane
whose extent grows** — and (a) has a shape, not a hand-wave.

What the reader sees: the measured tail drawn at its true scale, and above it a single
**unmeasured extent** — one flat band in the quiet ink, with no rects, no Turn blocks, no
annotations and no per-row shapes. The lit rectangle is confined to the measured region. Nothing
in the band maps to a row; a click inside it scrolls to the boundary and asks for more of the
document. That is degrade-down: a region Argo has not measured is drawn as **one shape at the
lower tier** rather than as a confident miniature at the higher one, and the reader can read the
admission — *the map stops here because Argo has not read that far*.

Forbidden, and this is the whole of the honesty argument: deriving `MinimapGeometry.scale`,
`laneTravel` or `documentHeight` from a `starts` array that covers only the tail while presenting
the result as a proportion of the Session. `MinimapLaneView` sets `hasVerticalScroller = false`
and its own comment says why — "the lit rectangle IS this scrollbar". A wrong document height is
therefore not a cosmetic error in a decoration; it is the reader's only means of knowing where
they are in the Session, drawing a lie. DIRECT is what Argo owns; a height nothing measured is not
owned, and degrade-down says it resolves to the quieter state, which here is *no shape per row*
rather than *a smaller shape per row*.

**Contract 2 · The reading never grows above the reader's offset without the offset moving with it
in the same frame.** This repo has closed this category once. #473, #476, #477 and the seam-drag
shake were one bug: `LazyVStack` handed the scroller an estimated height for every undrawn row,
the offset was points against those estimates, and anything that re-laid the column out
invalidated them. Each was patched locally — the resize-time pin refusal, the row-id anchor
replacing a point offset, `defaultScrollAnchor` while following — and none removed the cause. What
removed it was exact heights for every row. **A tail-first feed re-creates the cause by
construction**, because everything above the boundary has no height at all.

So: do not re-propose an estimated head with an id anchor. `FeedAnchor` is a row id already,
precisely because "an id survives a re-measure (#476)", and it did not fix this. Two routes
remain, and only two. Either **(i)** rows are prepended and the clip origin is advanced by exactly
the height of what was prepended, inside one `CATransaction` with actions disabled, before any
layout the reader can see — which is the manoeuvre `measureTail` already performs per batch
(`anchor()` before, `land(held?.landing ?? .stay)` after) and which is the reason that method
exists — or **(ii)** the head's extent is reserved from a height computable without a layout,
which is Step 1 again, which means no tail-first is needed. Under (i) the per-chunk manoeuvre is
run with the row ids renumbering underneath it, which is the harder version of the problem the
repo solved by deleting the estimates.

**Contract 3 · N is a floor on ROWS, snapped outward, with no ceiling.** Not bytes: 99.7% of this
transcript's bytes are tool-result payload the Feed never draws, and the 50 largest lines are 59%
of the file — an N in bytes opens a Session at one Turn or at four hundred depending on whether
somebody `cat`'d a lockfile. Not Turns either: `turnEnded` is emitted "only where the record's
reason SAYS the turn is over", which is 61 of 910 assistant records here, giving 197 Turns whose
size runs median 3, p90 15, max 39 — a unit that varies thirteenfold is not a unit.

So N counts rows, and the boundary is then snapped **outward only**, in this order: back past the
start of any run the boundary landed inside (call-run, survey, gallery, unreadable — Findings 4,
6, 7, 8); back past the oldest pending ask (Finding 9); and back to the nearest Turn head, so the
lane's blocks and Copy Turn are whole. The figure: enough rows to fill the viewport twice, floored
at 60. **No ceiling**, and that is the honest degradation for a Session whose last Turn is itself
enormous: a 400-row final Turn opens all 400 rows at today's cost. It must not be capped by
cutting *inside* the Turn — that re-breaks three folds and the lane's blocks at once. Which is to
say: **tail-first buys nothing in the worst case it would be asked about**, and nothing at all on
a Session under ~400 rows, which is most Sessions.

### Part 4 · Fold locality, one fold at a time

`FeedProjection.rows(from:)` makes ten passes over the stream or the rows it read from it, plus
the three inputs that arrive beside it. A pass that needs the head cannot run on a tail; a pass
that silently produces *different rows* for a tail is a correctness bug and not a perf trade. Both
kinds are present, and one pass is neither — it is worse.

**Finding 1 · `outcomes(in:)` — TAIL-LOCAL.** An outcome is written after its call, never before,
so a suffix that holds a call holds its outcome. An orphaned outcome contributes no row —
`content(of:)` answers `nil` for `.toolCallOutcome`. One dictionary pass, no layout.

**Finding 2 · `workingDirectory(in:)` — NOT TAIL-LOCAL, repaired by a scalar.** `TranscriptEvent`
says `.cwd` is "emitted on its first reading and again only when it changes", so a tail slice
normally holds **none**, `FeedPath(cwd: nil)`, and every call subject is captioned as an absolute
path instead of a relative one — a different row, a different width, a different height. Measured:
3 distinct cwds in the sample, the first at row 0. Repair: it is one string; compute it over the
whole stream and hand it in. Tail-local **only** as a parameter.

**Finding 3 · `rolledUp(_:)` — NOT TAIL-LOCAL, and a rendered lie.** It sums `Usage` over the
whole stream and draws the total at the foot of the reading. Measured: the last 20 Turns hold
13.3% of this document's reported spend, the last 10 hold 6.1%. A tail-only roll-up would draw a
**DIRECT** fact — Argo owns the sum of what the record reported — at a seventh of its value.
Degrade-down does not rescue it, because there is no quieter state available: a smaller number is
not a quieter number, it is a wrong one, and the projection's own comment says a Session that
reported no spend gets no marker at all rather than a zero. Repair: a scalar reduce over the whole
stream, handed in. Never recomputed from the tail.

**Finding 4 · `FeedCallRun.collapsed` — local in the interior, WRONG at the seam.** A run
straddling the boundary is split, so the tail's first row reads `×2` where the document says `×7`,
with a different `Churn`, a different `Ending` and a different `Usage`. Extending the head in
re-merges it, so a row the reader is looking at changes content **and** height. Not theoretical:
the folds take 1 148 rows to ~987 on the sample, so 161 rows sit inside a collapsed or surveyed
run.

**Finding 5 · `toldApart` / `DistinguishingLabel.labels` — NOT TAIL-LOCAL, and silent.** The
label is the shortest suffix that tells a path apart "from the others it is listed beside", and
*beside* means the whole feed — the doc comment says so: "whether a name is ambiguous is a fact
about the feed it sits in, not about the file". A tail-only pass returns the leaf alone where the
document needs `parent/leaf`. Different row, different width, different height, and when the head
arrives every affected row re-labels — including rows above and below ones the reader has already
read. Measured: 86 distinct paths, **0** ambiguous basenames, so it did not fire on this
transcript, which makes it the worst kind of hazard — absent from the fixture, present in the
type. Repair: the rivalry index is O(paths) over 86 paths; compute it over the whole stream and
hand it in.

**Finding 6 · `FeedSurveyFold.folded` — seam-wrong, and it changes the row COUNT.** Same class as
Finding 4, plus `surveyed` refuses to fold a run of one ("`Read 1` loses the only address the row
had"). A boundary inside a run of six therefore yields `Read` plus `Read 5` — **two rows where the
document has one** — so every id below the seam shifts.

**Finding 7 · `FeedGalleryFold.galleried` — seam-wrong, same count defect.** `gathered` emits one
row for any non-empty run, so a gallery straddling the boundary becomes two galleries. The fold's
own comment is that it runs last "over a stream the survey has already left every picture out of";
a boundary that splits one fold and not the other breaks that ordering guarantee too.

**Finding 8 · `FeedUnreadableRun.folded` — seam-wrong, and likeliest to be hit.** Its own comment
says a truncated write leaves a tail of unreadable lines — which is precisely a run a *tail*
boundary lands inside. The label is a count ("7 lines could not be read"), so a split makes the
count wrong on both halves, in the one row whose entire job is to be honest about what could not
be read.

**Finding 9 · `offering(_:_:)` — NOT TAIL-LOCAL in the failure direction, and functional.** It
attaches the gate's live question to the **last** pending ask matching by value. If that ask sits
above the boundary, no row carries the offer and the reader cannot answer a question the Session is
blocked on. `isDriveable` is per-feed and fine. Repair: the boundary may never cut above the oldest
pending ask — Contract 3's second snap.

**Finding 10 · `inFlight`, `unanswered(expired)`, `chained(handedOff)` — TAIL-LOCAL.** All three
are inputs beside the stream and all three land at the foot. `inFlight` reads the tail for a
pending call, and a pending call is by construction the newest thing in the record.

Verdict on Part 4: **the proposal does not break outright, but nothing survives untouched.** Four
of the ten passes are seam-wrong and three of those can change the row count; three of the
remaining facts are whole-document scalars that must be computed over the whole stream anyway — so
the tail never saves the walk over the events, only the walk over the *rows*. That is exactly the
walk Step 1 makes cheap.

### Part 5 · What a tail-first open would do to the work already landed

**`FeedGeometries` — complicated, then invalidated.** Its whole correctness is that "a height is
kept with the whole of what it is a fact ABOUT, and answers only a question that matches", and the
question is indexed by `Int` position with a `Ground` holding the row, the row above, the fold and
the open flag. Under a prepend the index is not stable, so every entry **misses**. It would never
answer *wrong* — the `Ground` check saves that — but a store that answers nothing turns "coming
back to a Session already read measures not one row again" into the #858 defect arriving by the
road ADR-0028 Rule 5 closed. The LRU's capacity of 4 is untouched; its usefulness is not.

**`SessionsRoomReadingCache` — helped, and this is the proposal's strongest card.** Its `Stamp`
keys `events` as a count and argues soundness from the append-only prefix, which is exactly the
invariant an incremental *suffix* projection needs; it is fair to say the memo layer is already
shaped for this. Two costs against it. The reading becomes multi-valued — a reading is now
(Session, boundary), so either the key grows a boundary and the hit rate falls as the boundary
walks back, or the entry is mutated in place and stops being the value the memo's correctness rests
on. And the walks it fails to save are four, not one; shortening `FeedProjection` alone leaves
`PlanProjection`, `Worked.read(across:)` and `FeedAgentReadings` at full length.

**The incremental `HubJoin` — neutral, and it caps the ceiling.** It made a Session's own batch
write into its row instead of folding the world (Rule 1), and it is indifferent to how much of a
row's events the Feed draws. Two facts from it bound what tail-first could ever win: the
**backfill** batch still takes the whole-world `rebuild()` path, so a first open pays that
regardless; and `transcriptLines` drains the entire file on that backfill while `TranscriptReader`
parses every line, 624 KB tool results included, off the main actor. Whatever engine-side share the
21.7 s has, tail-first does not touch a byte of it.

**The `ProseCache` bound — complicated, and partly invalidated.** Its ceiling is raised by
`ProseReading.holding(rows: shown.count)` from inside `FeedTableCoordinator.reading()` — the bound
is derived *from the whole-document walk the proposal removes*. Sized to a tail, the store is then
crossed by a backward extension larger than its ceiling and empties itself mid-walk, which is
verbatim the defect Rule 4 was written for ("a 4 000-row reading against a 512 literal emptied
itself seven times a pass and hit nothing"). The bound would have to come from the document's own
length, which means knowing the length before showing any of it.

**`FeedScope` is not a precedent for this, though it looks like one.** Scoping the rail onto a
Subagent does not filter the Session's stream — it *substitutes* the Subagent's own
`[TranscriptEvent]`, a different document, projected by a second full `rows(from:)`. So the
whole-feed facts in Part 4 stay correct there by construction. What is reusable is only the memo
shape: `scoped: [FeedScope: [FeedRow]]` inside one cache entry, because `DeckContentRow` asks for
the scoped rows inside a `GeometryReader` — once per layout pass, and so once per frame of a seam
drag.

**The frame probe and switch-settle instrument (`91dad0c2`) — helped.** It is what would measure
any of this, and it is the reason Part 6 can be written as counts rather than as a stopwatch.

### Part 6 · What is measured

The 21.7 s is a **recorded witness, not the gate**. It is wall-clock on the whole app, which
ADR-0028 Rule 7 forbids as a budget, and reproducing it needs a click. The gates are counts and
ratios, all in `ArgoUITests`, none needing the app:

1. **Counts, extending `FeedMountCostTests`** — which already asserts `table.layouts == 1` and
   `coordinator.measurements == 0` for a reading that opens at its end. Add: on a 2 000-row
   fixture, the measurements taken before the first `reading()` returns are at most
   `2 × viewportRows`, and `MinimapLaneView.geometryDerivations == 1`. Counts and not the clock,
   because the mount, re-measure and switch paths are all deliberately gated by counts already.
2. **Rule 3's shape ratio on the walk** — `leastCPUSeconds` of one
   `FeedTableCoordinator.reading()` at 2 000 rows over the same at 300 rows, under
   `1.3 × (2000 / 300)`. That is what says the walk stayed linear, and it is the number Step 1
   moves.
3. **The `FeedGeometries` invariant, unchanged** —
   `FeedReadingSwitchTests.coming back to a Session already read measures not one row again` must
   stay green. Any step that reddens it has renumbered the rows, and that is Finding 0.
4. **Fold locality as correctness** — Step 0's equality test, per boundary, contents included.

What cannot be measured, now that synthetic input is forbidden: the 21.7 s itself and any
after-figure for it, since surface-settle is defined on the accessibility tree after a click;
whether the lit rectangle stays under the reader's thumb while the head is discovered, since that
is a hand on the lane; and how many times `reading()` actually ran during the recorded settle,
which is the single fact that would most change this document's arithmetic. `geometryDerivations`
exists to answer it and can only be read from a running app.

## Why

**Because the constant is the defect and the count is not.** Nine hundred and eighty-seven rows at
22 ms is a per-row cost problem wearing a document-length costume. The median row in this
transcript is sixteen characters and still pays a full SwiftUI layout against a hosting
controller. Halving the rows halves a number that should be two orders of magnitude smaller;
making the measurement cheap fixes both the open and the reshape, the seam drag, the theme flip
and the scope switch — every path that fires a `.all` re-measure — and it fixes them without
touching a single fold, a single row id or the Minimap's contract.

**Because this repo has already paid for estimated heights once, and bought exactness on
purpose.** The scroll-anchoring category was closed by giving every row a real height, not by
patching the five surfaces that jumped. A tail-first open is a document whose height above the
reader is unknown, which is the same premise with a different container, and it arrives in a
Minimap whose lit rectangle is the only scrollbar the reading has. Re-opening a closed category to
win a factor that a cheaper change wins outright is the trade this ADR refuses.

**Because a growing lane is honest and still the wrong first move.** The unmeasured extent in
Contract 1 is a real answer — it degrades down, it says out loud what Argo has not read, and it
would be defensible. But it is a new state in the surface #382 and #402 have only just landed, it
needs a design and a `pixel-review`, and every one of Part 4's repairs must ship before it can be
correct. That is the invasive change the question asked about, and it is worth building only if
the cheap one fails. It has not been tried yet.

## Consequences

- **The 21.7 s is not yet explained, and this document says so rather than guessing.** Whether it
  is one whole-document walk at 22 ms a row or several walks at fewer,
  `MinimapLaneView.geometryDerivations` decides it, and only a running app can be asked. Step 2 is
  worth landing on the reasoning alone, but its *size* is unknown until that count is read.
- **Step 1 may not be enough, and then Part 3 is the plan.** If a CoreText height leaves the walk
  above a frame budget, the contracts here are written and the staged path is ordered. Nothing in
  Part 2 is wasted work in that case: Steps 0, 3 and 4 are exactly what Part 3 needs first.
- **Part 4's repairs are good on their own terms.** Handing the projection its cwd, spend total,
  rivalry index and asking offer as parameters turns three whole-feed facts it currently discovers
  into facts it is told, which is what makes the projection testable at a boundary at all — and it
  is the shape any future incremental projection needs, tail-first or not.
- **The best case for the proposal is upstream of the table, not in it.**
  `SessionsRoomReadingCache` already keys on an append-only prefix count and argues its own
  soundness from that; a suffix projection is the natural next move for the four whole-stream
  walks a miss pays on every transcript batch. That case is real and this ADR does not answer it.
  It is a separate change from opening the *view* at a tail, it needs none of Contracts 1–3, and
  should be argued on its own.
- **The measured figures here are honest about shape and worthless as absolutes.** They come from
  a Python probe over one JSONL file, reconstructing the projection's row rules rather than
  running them. The row counts, the byte shares and the Turn distribution are the file's own; the
  ~22 ms is a division, not a measurement.
- **Recommending against a change one was asked to plan is the outcome, not a failure of it.** The
  refuted version is Finding 0: dense positional row ids make a backward extension cost more than
  the open it replaces. That is checkable from `FeedProjection.rows`, `FeedTableDelta.between` and
  `FeedTableCoordinator.execute` alone, without measuring anything.
