# 0028 · Cost is a gate, not a review note

Status: proposed · 2026-08-29

Binding on `apps/macOS`. Extends `scripts/swift-boundaries.sh` with edges 7–11 and adds a cost
suite to `bun run quality`. It completes [ADR-0022](./0022-swift-native-macos-runtime.md), whose
premise it makes checkable.

## Context

ADR-0022 moved this app to Swift for one reason, and
[ADR-0023](./0023-the-electron-runtime-is-retired.md) restated it as settled: the runtime left
because of what it cost per frame. Nothing in the tree has checked that claim since.

`bun run quality` is biome, jscpd and `quality:swift` — SwiftFormat, SwiftLint,
`swift-boundaries.sh`. Every one of them measures **shape**: a file over 150 lines, a function over
50, an init over its parameter cap, a duplicated block, an illegal import, a fact missing from the
projection. Not one measures **work**. A gate exists for a fact so cheap to check that arguing
about it in review would be silly; cost was left to review, and review cannot see it — a re-walk of
the whole event stream per body reads like an accessor.

The one budget that exists proves the point rather than disproving it. `MinimapCostTests` records
its own measurement at 142 ms and then asserts `#expect(cost < 4)` — 28× looser than the thing it
measures, and it would stay green through a twentyfold regression in the exact path it was written
to hold. It also warms the caches before timing (`_ = Self.laidOut()` and then the measured call),
over a 301-row fixture. It is live on the `macos` CI job. It saw none of what follows.

Two `sample(1)` profiles of the running cockpit — one 20 s of scrolling, one 20 s of switching
sessions — plus a 128-agent static sweep, found eighteen defects of one shape. The three largest,
in main-thread milliseconds per 20 s window:

| cost | site | trigger |
| --- | --- | --- |
| 835 ms switching, 693 ms scrolling | `HubJoin.rebuild()`, `HubJoin.swift:67` | a few bytes appended to **one** subagent's transcript rebuild **every** Session and the whole `HubChainGraph` |
| 1 530 ms scrolling | `FeedTableCoordinator.paneChanged`, `+Scrolling.swift:120` | a clip-view frame notification forces a full synchronous table layout |
| 227 ms scrolling | `MinimapLaneView.readingReshaped`, `+Pointer.swift:199` | a document-view frame notification rebuilds whole-document geometry |

The largest correlates with neither interaction. It is background tax: three agents writing to
their own transcripts, and the app rebuilding the world for each write. Beneath those sit
`ProseCache` emptying itself whole at 512 entries under a walker that touches every row — a cache
whose stated working set ("the visible rows of a long turn several times over") was true when
written and was invalidated by a caller added later — and `CockpitView.evidenceReading`
(`CockpitView+Evidence.swift:14`) taking a second whole `SessionsRoomReading` in the same body pass
that `CockpitView+Detail.swift:20` warns against taking twice.

Every one is the same mistake: **an event with local scope causing work with global scope.** No
existing gate has an opinion about that, and no ADR forbids it, so each arrived as an ordinary
change that reviewed cleanly.

The gates that exist are trusted because they are mechanical. This extends that trust to cost, and
holds itself to the same standard as edges 1–6: **checkable from the code alone**, and loud when it
is not.

## Decision

Eight rules. Each states what it **forbids** and names the mechanism that catches it. A rule with
no mechanism is not a rule and does not belong here.

**Rule 1 · Work is scoped to what changed.** Forbidden: a mutation keyed to one transcript,
Session, or row rebuilding a collection that spans all of them. Concretely — a `mutating` method
taking a single id may not call a rebuild that reads every element, and an `@Observable` publish may
not replace a whole collection when one member changed. *Mechanism:* edge 7 greps `@MainActor
@Observable` types for a stored collection assigned whole inside a method whose parameters name a
single member; each exemption is a `rebuilds-all:` line with a reason, and the list may only shrink.
*What it kills today:* `HubJoin.apply(_:ofSubagent:to:)` → `rebuild()` → `HubSessionChain.sessions`,
the largest single cost in the app.

**Rule 2 · A notification handler does no work proportional to the document.** Forbidden: an
`@objc` handler registered for `NSView.frameDidChangeNotification` or `boundsDidChangeNotification`
that reaches a whole-document walk, a `layoutSubtreeIfNeeded()`, or a re-measure of rows it did not
name. A handler decides; it does not compute. *Mechanism:* edge 8 walks the call graph from every
`addObserver(_:selector:name:object:)` selector in `apps/macOS` and fails on a reachable
`layoutSubtreeIfNeeded`, `reloadData`, or any function whose name matches `refresh|rebuild|reading`
that takes no index set. *What it kills today:* `FeedTableCoordinator.paneChanged` and
`MinimapLaneView.readingReshaped`, together 1 757 ms per 20 s of scrolling — and the feedback loop
where forcing layout re-fires the notification that forced it.

**Rule 3 · Per-frame, per-keystroke and per-body work does not scale with the transcript.**
Forbidden: any such path whose cost at 2 000 rows exceeds its cost at 300 rows by more than 1.3×.
*Mechanism:* the cost suite carries both fixtures for each path and asserts the **ratio**, never the
seconds — a ratio survives a change of machine and of build configuration, which is what makes it
the only honest budget for a laptop-measured number. A path with no ratio case is uncovered, and its
comments may not describe it as bounded. The two fixtures are **the same work at two sizes**, and
Rule 8 is why that is not merely the convenient way to write one.

**Rule 4 · A cache reached by a whole-document walk evicts by age; an unbounded cache is
forbidden.** Forbidden: `removeAll` as an overflow policy in any type whose name ends `Cache`; an
`NSCache` with neither `countLimit` nor `totalCostLimit`. Also forbidden: a cache whose doc comment
states a working set that a caller in the same module exceeds — if a whole-document walker reaches
it, the comment says so and the ceiling derives from the document rather than from a literal.
*Mechanism:* edge 9 greps those shapes; the working-set claim is held by a cost case that walks past
the ceiling **cold**. *What it kills today:* the `ProseCache` cliff at 512 entries, and
`MediaPicture`'s unbounded full-resolution bitmaps.

> **Amendment — 2026-09-01 (#1001).** Rule 4's forbidden list was not enough. An `NSCache` *with*
> a `totalCostLimit` is still not a cache anything may claim about: its removal policy is
> documented as a hint, and on Darwin it empties itself wholesale on a memory-pressure
> notification. The picture-plate suite asserted that a plate filed one statement ago was still
> held, and it went red in 33 runs out of 40 on a quiet desk with no load generator anywhere.
> **A cache whose behaviour any test asserts holds its entries in a store Argo owns, evicting by
> its own stated policy.** Foundation's is for pixels nobody has promised anything about.
> `MediaStore` is the first of them.

**Rule 5 · A room or session switch destroys no measured geometry.** Forbidden: `.id(` on any view
hosting an `NSViewRepresentable` under `Shell/Deck/`, and storing measured row heights in a type
whose lifetime is a `switch` branch. The height store lives above every switch that does not
invalidate it, keyed by Session, and is dropped only by what actually changes a height — pane width
and `FeedCellEnvironment` re-inking. *Mechanism:* edge 10 greps the `.id(` shape under
`Shell/Deck/`; a cost case switches A → B → A and asserts the second A costs a stated fraction of
the first. Mounting both rooms is **not** a fix: a hidden deck is handed an empty feed, which
`FeedTableDelta` reads as `.reload`, which drops every height.

**Rule 6 · The main actor opens no file, spawns no process, and resolves no path.** Forbidden in
any `@MainActor` type: `Data(contentsOf:)`, `String(contentsOf:)`,
`FileManager.default.contentsOfDirectory`, a `JSONDecoder` reached from a file read, `Process(`,
`realpath`. *Mechanism:* edge 11, with a shrink-only exemption ratchet in the idiom
`.swiftlint.yml` already uses. *What it kills today:* the composer's per-keystroke skills-directory
walk and JSON decodes (`ComposerMenus.swift:86`), and two `realpath(3)` syscalls per Session per
scene read (`ArgoApp.swift:120`).

**Rule 7 · Budgets are gates, stated once, no looser than 3× the recorded figure.** Forbidden: a
bare seconds literal in a cost assertion; a budget more than 3× the figure recorded beside it; a
warm-cache-only case on a path a cold walk reaches; wall-clock timing in any budget. Recorded
figures live in one file, each carrying the machine and configuration it was taken on, and warm
budgets use the least of N trials — CPU noise is one-sided. The suite joins `bun run quality` on the
`macos` job.

**Rule 8 · A CPU figure is a last resort, and a ratio of two CPU figures is only sound when its
halves are the same KIND of work.** Forbidden, in order of preference for the fix:

1. **A CPU figure where a count exists.** Prefer the count — a ruler measure, a Core Text pass, a
   whole-document walk, a geometry derivation. A count is *exactly* the same idle and loaded; thread
   CPU is only approximately so.
2. **A ratio whose two halves are different kinds of work — a different memory profile, one
   continuous and one fragmented, one cold and one warm — held to a bound inside what those halves
   can differ by.** `CLOCK_THREAD_CPUTIME_ID` drops the time the scheduler took the thread away but
   still charges the cycles it stalled while on-core, so it is load-independent only for
   compute-bound work at a steady clock. Unlike halves inflate by *uncorrelated* factors, the
   factors do not cancel, and the quotient moves while the work does not. **3.8× is the working
   figure** for how far one half can move on its own, measured on this hardware; a cross-kind
   quotient gated at 0.5 or at 3 is therefore unsound, and one gated at 160 is not. Where the shape
   is available, prefer Rule 3's two fixtures — the same work at two sizes — which makes the halves
   alike by construction.
3. **A ratio over a block of work near the clock's own floor.** Repeat the work until the block is
   milliseconds, then divide; a budget that fails because the instrument cannot see the thing is
   fixed by a coarser instrument, never by a looser bound.

*Mechanism:* the suite itself. Every cost case states its unit in its own doc comment, and a case
gating a CPU quotient names the work each half does — which is the review question this rule
replaces with a greppable one: *are those the same thing?* Where the answer is no and no count
exists, the claim is dropped and the recorded figures stay as figures, gated by nothing.

*What it kills today:* `FeedTypesetCostTests`, which divided a Core Text typeset walk by an
`NSHostingController` layout walk and gated the quotient at 0.5 — it read 0.42 idle and failed 3 of
4 isolated runs at load average 130; the CPU half of `MinimapWalkCostTests`, which divided a
thirty-fragment AppKit burst by one continuous streaming walk and read 1.85 to 3.14 over 24 runs of
unchanged code, while every count beside it stayed exact; every seconds literal in
`MinimapCostTests`, the suite this ADR's own Context holds up as the thing it exists to replace; and
the 100-pass blocks in `CockpitPresentationCostTests` and `FeedRowsCompareCostTests`, 185 µs and
30-50 µs of work under a 1.3 bound, the second of which failed 2 of 25 full-suite runs.

## Why

**Because the alternative was tried and is what produced this list.** Every defect above passed a
review by people who cared about performance, in a codebase whose comments are unusually careful —
several of them *state* that a cost was measured and accepted. `ProseCache`'s comment is correct
about its own working set and wrong about its callers. `MinimapCostTests` measures the right path
and asserts nothing. Cost is not a thing careful reading catches, because the expensive call and the
cheap one look identical at the call site.

**Because the rules are about scope, not speed.** Rules 1, 2 and 5 forbid a *shape* — local event,
global work — rather than a duration. That is what makes them greppable, and it is why they will
still be true when the machines get faster. A rule that says "under 16 ms" encodes the speed of
whoever wrote it; a rule that says "a handler for one row may not touch every row" does not.

**Because a laptop number cannot be a gate.** The measurements behind this ADR were taken on a
debug build with thirty agents competing for CPU. They are honest about *shape* and worthless as
absolutes, which is exactly why Rule 3 asserts a ratio and Rule 7 demands the figures be re-recorded
on CI before they bind.

**Because a ratio is not automatically load-independent, and the first draft of this ADR assumed it
was.** Rule 8 is the correction, and it was established by measurement rather than by argument. On
the machine this was written on, against twenty-four spinners: a fixed arithmetic loop reads within
0.4% of its idle figure, and a fixed pointer-chase over 64 MB swings 3.8×. The same work split into
thirty fragments after sleeps reads up to 1.19× the continuous version. So two halves of the same
quotient can inflate by 1.0 and by 3.8, and the gate then measures the box. Three of the five cost
suites written under the first draft were unsound for that reason, and all three failed under load
while the code they gate did not change. The fix in every case was to find the count the seconds
were made of — a ruler measure, a Core Text pass — and gate that instead.

## Consequences

- **The `macos` job gets slower.** The suite gains a 2 000-row fixture and cold cases. That is the
  point: the 301-row warmed fixture is why Rule 4's defect stayed invisible.
- **The figures must be re-recorded on `macos-26`, in release, before the budgets bind — but only
  the ones made of SECONDS.** #991 established the split, and it is narrower than this bullet first
  assumed. A COUNT is control flow: a ruler measure, a Core Text pass, a whole-document walk, a
  geometry derivation, a cache miss and a retained byte happen the same number of times under
  `-Onone` and under `-O`, so debug costs those claims nothing and Rule 8's sweep is what made that
  most of the suite. Ten claims are CPU quotients and they are what a release run re-records.
  Seven were named when this bullet was written — `HubRosterCostTests` (1),
  `CockpitPresentationCostTests` (2), `FeedRowsCompareCostTests` (2),
  `SessionsRoomReadingCostTests` (2) — and four more only by the #1065 amendment below, which is
  the second time this census has been short; one of those four is a count now, leaving
  `ProseTextSizeCostTests` (2) and `FeedRowShapeTests` (1) beside the seven. Five others were
  quotients and are now counts, because Rule 8's first instruction had a count available in all
  five: the roster memo's own fold count and the prose store's hit rate when #991 swept, the join's
  own rebuild count in #1064, the roster's fold count again for `SubagentCostTests` in #1065, and
  the labelling pass's own count of the paths it looked at in #1066. All seven named above
  hold unchanged optimised, and so does every count beside them: `ArgoEngine` 1 222 tests
  and `ArgoUI` 2 035 tests pass in release with no budget touched.

  > **Amendment — 2026-09-02 (#1064).** `HubJoinCostTests` was the eighth quotient and is now a
  > count, because #991's sweep left it in place and it turned `main` red on unchanged code. Its
  > arms differ by fifty times the resident working set while the measured work is a fixed row, so
  > `CLOCK_THREAD_CPUTIME_ID` charges the large arm cache, TLB and memory-bandwidth stall the small
  > one never pays — the same fact this ADR's own Consequences already record of
  > `FeedTypesetCostTests`, where 4 000 rows against 300 read 3.98 to 4.10 warm. **A bias present
  > in every trial is not something a minimum over trials can remove**, which is the part the
  > `least of 15` in that suite was standing in for. The defect it exists to catch was already
  > named as a count in its own doc comment — "restoring `rebuild()` on this path takes it to 36x"
  > is a count of `HubJoin.rebuild()` calls — so Rule 8's first instruction applied unchanged, and
  > `HubJoin.rebuilds` follows `HubRosterMemo.folds`. The seconds stay in `PerfBudgets` as figures
  > gated by nothing.
  >
  > The census above is still short by one, and naming it is the point of saying so:
  > `SubagentCostTests` gates a CPU quotient of the same 4-against-200 shape, at a `1.3` written
  > inline rather than in `PerfBudgets`, and it runs on the same hosted runner. It is not migrated
  > here — the count it wants is the roster's, not the join's — and until it is, it is the next
  > suite that can redden `main` without a regression under it.

  > **Amendment — 2026-09-02 (#1065).** That one is migrated. `SubagentCostTests` now counts
  > `HubRosterMemo.folds` — the roster's counter, which `HubRosterCostTests` already gates on —
  > across 2 000 Subagent batches at 4 rows and at 200, and reads zero at both. The roster is read
  > beside every batch on purpose: a fold is only ever paid on a READ, so a batch that republished
  > the whole roster would cost nothing until something looked, and the cockpit looks once per
  > scene pass. Its inline `1.3` is RETIRED rather than moved, because a bound left in place reads
  > as live; the readings it was taken at sit beside `PerfBudgets.subagentReadingFolds` as figures
  > gated by nothing, which is also where Rule 7 says a figure lives.
  >
  > **Half of the old quotient's claim is dropped rather than restated,** which is what this rule
  > says to do when no count can see it. A fold is only ever paid on a read, and a read moves no
  > stamp — so the WRITE half is held (a child's batch routed back into the join moves
  > `joinRevision`, which is in the stamp, and the count goes to one per batch) while a
  > `subagentReading(of:)` re-implemented over `hub.sessions` would be a memo HIT: zero folds, green
  > gate, and the whole roster walked per read. The suite's own doc comment says so, because a gate
  > that is quietly narrower than its name is worse than one that admits it.
  >
  > **The census was short by more than one, and the reason is that `*CostTests` is a convention
  > rather than a mechanism.** Swept on the clock and the division instead of on the file name —
  > `cpuSeconds`, `leastCPUSeconds`, `pairedCPUSeconds`, `threadCPUSeconds`, over two measured
  > halves — four more gated quotients appear that no revision of this bullet has ever named:
  > `ProseTextSizeCostTests` (2), which landed after the census and whose halves are the same warm
  > read of the same fixture, and `FeedScaleTests` (1) and `FeedRowShapeTests` (1), which sit
  > outside the naming convention entirely and gate on a bare `40` and a bare `1.1` — two more
  > bounds Rule 7 wants in `PerfBudgets`. What none of them was is NAMED, which is a fact about
  > this bullet rather than about that run: they are ordinary cases with no release gating, so
  > #991's `ArgoUI` figure counted them while its census did not.
  >
  > One quotient the census DOES name is this same shape at a smaller factor, and it is left
  > standing deliberately: `HubRosterCostTests`'s `session(id:)` case divides 20 000 lookups over
  > 8 rows by the same 20 000 over 64, an eightfold difference in resident set under a 1.3 bound.
  > It HAS gone red on a runner — it read 1.89 in #1005 — and what rescued it was deepening its
  > arms from 500 lookups to 20 000, which fixes the resolution and not the bias. It has held
  > since, and the count that would replace it is the fold count the case beside it already
  > asserts, so it stands. Named here so the next red run is read as this, and not as a busy box.

  > **Amendment — 2026-09-02 (#1066).** Of the four that sweep found, the two written on a bare
  > inline literal are taken up here, and only one of them could be migrated. The other two stand
  > where #1065 left them: `ProseTextSizeCostTests`, both its halves being the same warm read of
  > the same fixture, and `HubRosterCostTests`'s `session(id:)`, for the reason stated there.
  >
  > **`FeedScaleTests` is the one that could.** Its claim — cost grows with the record and not with
  > the square of it — is about the pass that tells two same-named files apart, and that pass now
  > reports the paths it LOOKED AT: one per path to build its index, then one per DISTINCT
  > same-named path — itself included — at each address it labels. Ten copies of a reading name the
  > same distinct paths, so an indexed pass reads exactly ten times the looks where one that asked
  > every path which others share its name reads a hundred — 754 against 7 540 today, and 207 936
  > against 20 793 600 with the index taken out. `DistinguishingLabel.labelling` hands the count
  > back per call, which is the same per-value rule `HubJoin.rebuilds` and `HubRosterMemo.folds`
  > follow for a stored one. The recorded 754 is gated exactly as well as the fold, because a fold
  > alone would hold a tally that had stopped seeing the rivalry term — the term the quadratic is
  > in. Its inline `40` is RETIRED rather than moved, because a bound left in place reads as live;
  > the 9.1–9.9 it was written against sit beside `PerfBudgets.labellingLooks`, gated by nothing.
  >
  > **What the count cannot see is stated on the case rather than implied.** The old assertion ran
  > `FeedProjection.rows(from:)` on both arms, so the projection stage, the four folds and
  > `offering` were held against superlinear growth as a side effect; this one measures the
  > labelling pass alone. And a rewrite that scanned the whole list per address without counting
  > its own looks would not be seen. The second is the limit every count in this suite carries —
  > `HubJoin.rebuilds` is
  > equally blind to a rebuild that stops bumping it, and #1065 said the same of a
  > `subagentReading(of:)` re-implemented over `hub.sessions`. What a count holds is the pass that
  > reports it, and that is a smaller claim than a quotient over the whole projection made. It is
  > also the only one of the two that is exact, which is the trade this rule asks for.
  >
  > **`FeedRowShapeTests` is the one that could not, and it is left standing with its inline
  > `1.1`.** Its arms are one `NSHostingController` re-rooted per row against one per shape, and
  > the whole of the saving is a rebuilt SwiftUI view graph against a diffed one. Both arms call
  > `sizeThatFits` exactly once a row, so every count Argo can take is EQUAL across them: what is
  > measured happens inside the framework, and it is irreducibly a duration. The claim is also not
  > a regression gate — `a reading is measured through one ruler per shape it lays out` is that,
  > and it is already a count — but the argument for keeping the split at all. #1007 had been here
  > already: `1.4` was a dev Mac's figure, the runner read 1.19, and what landed was the paired
  > SIGN over interleaved trials with `1.1` as a floor under both readings. **A sign over paired
  > arms is not a quotient held inside what its halves can differ by**, and the bias runs the safe
  > way — the split holds a controller per shape against the shared arm's one, so
  > `CLOCK_THREAD_CPUTIME_ID` charges the cheaper arm the larger resident set. Rule 8's own remedy
  > where no count exists is to drop the claim and keep the readings as figures, which would take
  > the split's justification out of the tree; that is a decision and not a migration, so it is
  > named here and not made.
  >
  > **The census is now ten CPU quotients across six suites**, and this sweep — on the clock plus a
  > division, as #1065's was — found nothing that one did not. `ProseCacheCostTests` and
  > `MediaMemoryCostTests` each read two clocks and gate on neither: the first says so in its own
  > assertion message, and the second's two divisions are of BYTES. `MinimapFigureRecording` is the
  > recording harness rather than a gate.

  > **Amendment — 2026-09-02 (#1024).** "Before the budgets bind" assumed that a `macos-26`
  > recording would make a SECOND bindable. It does not, and this bullet is the last place in the
  > ADR that reads as though it might. A GitHub-hosted runner is a shared, virtualised box with no
  > clock guarantee of its own — quieter than the laptop these were taken on, and still not a
  > machine an absolute may be asserted against; that is Rule 8's own argument applied to the box
  > rather than to the quotient. So a recording on `macos-26` ends the figures' PROVISIONAL status
  > and nothing more. **What binds, then, is the fold between the two configurations of one
  > figure** — same fixture, same call, same cold-or-warm state, `-Onone` against `-O` — which is
  > alike by construction and so the one quotient Rule 8 admits without an argument. The seconds
  > stay figures, gated by nothing, exactly as Rule 8's last paragraph says of a claim no count can
  > see. `.github/workflows/figures.yml` is the run, `apps/macOS/scripts/record-figures.sh` the
  > harness, and `PerfBudgets.figureMachine` is the switch that arms the fold check.
- **What `-O` is actually worth on these paths: 1.0x to 1.3x on six of the seven measured, and
  3.7x on the seventh** (#953, and #998 for the same seven against `main`). So the whole epic being
  sized in debug did not inflate its figures by an order of magnitude, and the fixes it justified
  are not artefacts of the build. The exception is the rule's reason. Six of the seven are mostly
  **not this app's code** — a ruler measure is SwiftUI hosting plus Core Text, a band paint is Core
  Text, and framework code is optimised in both configurations, so `-Onone` inflates only Argo's
  own share of the pass. The seventh, a warm whole-session walk, is almost entirely Argo's own
  Swift: every row visited over warm caches, exactly where retain/release traffic and bounds checks
  are the whole cost. **A 1.2x average is therefore not a licence to size the next budget in
  debug** — the next hot path that is pure Swift will read 3x, which is why Rule 3 asserts a ratio
  and Rule 7 demands the figures. The per-path figures are `ArgoUITests/PerfBudgets`, still
  provisional until they are taken on `macos-26` (#1024).
- **A release run is `ARGO_TEST_CONFIGURATION=release`, and it defines DEBUG on purpose** (#991).
  What blocked release was never an instrument. Every counter the count claims read is `#if DEBUG`,
  so `swift test -c release` failed to COMPILE `ArgoUITests` — exiting 0 as it did, the #918 hazard
  again — and took the seven CPU quotients in that target down with the count assertions that share
  the module. Defining DEBUG in the optimised build is honest exactly while every `#if DEBUG` under
  `Packages/*/Sources` stays additive: 18 sites in 7 files today, not one with an `#else`. An
  `#else` added there would make a release run measure debug behaviour, and nothing checks for one.
- **Release is not on the `macos` job.** Cold on the machine this was written on, both packages:
  289.6 s optimised against 106.3 s in debug, 2.7x, for the same 3 257 tests — whole-module `-O`
  re-optimises ArgoUI entire on every change. It is a re-recording tool, run when a seconds-side
  figure is written or challenged. The counts, which are most of the suite, gate on every push
  already, and they are the half a debug build cannot get wrong.
- **Rule 3's ratio can be gamed by making both ends slow.** It catches regressions in *scaling*, not
  in constants; Rule 7's recorded figures are what hold the constants.
- **Rule 1 will bite legitimate work.** Some rebuilds genuinely must span everything —
  `HubChainGraph` exists because a resume chain is a global fact. The `rebuilds-all:` line is how
  those stay legal, and the shrink-only list is what stops it becoming the default.
- **Rule 8 removes claims rather than restating them.** Where a CPU quotient was the only
  expression of a claim and no count can see it, the claim goes and the doc comment says so — see
  `FeedTypesetCostTests`, where even the same-kind repair (typeset per row at 4 000 rows against 300)
  reads 3.98 to 4.10 warm, because the larger working set does not fit the caches the smaller one
  does. That is a fact about memory, not about the routing, and there is no honest bound to put on
  it. A gate that cannot be made sound is worse than no gate: it teaches the next session that a red
  suite means a busy machine.
- **Six edges become eleven, and `swift-boundaries.sh` grows a call-graph walk it does not have
  today** (Rule 2). That is the most expensive mechanism here and the one most likely to need a
  narrower first version — reachability from a fixed selector list, before anything general.
