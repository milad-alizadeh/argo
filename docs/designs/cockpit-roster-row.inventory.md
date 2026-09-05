# The Sessions roster row — build inventory (#1343, #1344, #1345, #1346, #1347, #1348, #1349)

What each ticket's build actually extracted from
[`cockpit-roster-row.md`](cockpit-roster-row.md). Names are frozen at approval; renaming one is
a migration. Every ticket against this design writes its section here rather than starting a
second inventory, and the sections stand in **ticket order** — the order the design's own
children table gives — so the file reads as one build rather than as the order the lanes
happened to land in.

## Extracted — #1343

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `SessionMarker` | molecule | `ArgoUI/Shell/Sidebar/` — one caller (`SessionRow`) | `row: SessionRosterProjection.Row`, whole | `ArgoDisclosure` on a fold, `SessionStateIndicator` otherwise, and (from #1344) `SubagentDots` under it | frozen table, `SessionMarker`; [`roster-row/running.png`](roster-row/running.png), [`roster-row/fold.png`](roster-row/fold.png) |

Extraction evidence: the leading column is the design's own frozen name, and it draws two shapes
the happy path never renders together — a Session's state dot and a fold's chevron. It takes the
whole row rather than a state and a fold separately, so no caller can hand it both: the column
holds one mark, and which one is the row's to say, not the caller's.

### What stayed inline

- **The three lines themselves** — `VStack` markup in `SessionRow`. Each line appears once, none
  of them is a cross-screen shape, and every state the row has is a state of the whole row rather
  than of one of its lines. A `RosterTitleLine` would have been a component wrapping one `Text`.
- **The mark's vertical centring** (`SessionMarker.inset(for:)`, `.titleLineBox`) — two `static`s
  on the view, derived off `ArgoTypography.rowTitle.rung.drawnLineBox` rather than off a measured
  constant, so the mark cannot drift when the type scale moves. The face the platform resolves and
  the rung's documented size differ by an amount with no fixed sign, and the mark is centred
  against what is on the screen.

### Contract changes these needed

None. `ArgoSpacing.hair`, `ArgoTypography.rowTitle` / `rowMeta` / `machineCaption` and
`ArgoRadius.control` all predate the design; line 3's extra `hair` is the same rung spent twice.

## Extracted — #1344

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `SubagentDots` | molecule | `ArgoUI/Shell/Sidebar/` — one caller (`SessionMarker`) | `reading: SessionRosterProjection.SubagentReading` (`.none` · `.running(Int)` · `.landed` · `.unresolved`) | `Circle` dots at `ArgoIconSize.subagentDot`, a `Capsule` dash, a `Circle` outline pip, and the `+n` overflow label in `machineCaption` | frozen table, `SubagentDots`; [`roster-row/running.png`](roster-row/running.png), [`roster-row/ceiling.png`](roster-row/ceiling.png) |
| `SessionRosterProjection.SubagentReading` | value | `ArgoUI/Shell/Sidebar/SessionRosterProjection+Subagents.swift` | four cases, one per fact the column can draw | reads `FeedAgents.all(in:of:)` / `FeedAgents.running(of:)` off `FeedProjection.rows(from:)` — the same reading the Agents rail takes, so the two counts cannot disagree (#1269) | `SessionRosterProjection+Subagents.swift`, `SessionRosterProjectionSubagentsTests.swift` |

Extraction evidence: `SubagentDots` draws four distinct readings plus a ceiling the happy path
(one running Session) never exercises, and it is the design's own frozen name. The reading itself
stayed a value on the projection rather than living inside the view — `SessionMarker` already
reads `row.state` the same way, and a component computing its own delegation state would be a
second place the honesty rule (`SessionState.role` returning `nil`) could go wrong.

### What stayed inline

- **The ceiling arithmetic** (`SubagentDots.drawnDots(for:)`, `.overflow(for:)`) — two `static`
  functions on the view itself, not a value type: the number 5 has no other caller and no other
  reading to disagree with.
- **The fold's own reading** (`SessionRosterProjection.foldedSubagents(of:)`) — a fold pools the
  RUNNING count across every Session it hides and draws none of the other three readings (rule
  9), so it is a different function, not a mode of the same one.
- **The overflow label's overflow** — `Text("+\(overflow)")` needed `.fixedSize()` ahead of the
  6pt `.frame(width:)`: the frame is a LAYOUT proposal, and without `fixedSize` first, `Text` took
  it as a wrap width and truncated `+7` to `+`. Caught by the specimen render, not by a projection
  test, which is exactly the split `pixel-review` exists for.

### Contract changes these needed

Two, both promoted at their first and only caller:

- `ArgoIconSize.subagentDot = 4` — half of `statusDot`, beside it in `ArgoIconSize.swift`.
- `ArgoSpacing.subagentGap = 3` — off the rhythm ladder, in `ArgoSpacing.swift`, for the reason
  the design gives: the stack has to read as one column, not as a list of separately-spaced dots.

The dash and the outline pip snap to existing tokens (`ArgoStroke.border`, `ArgoStroke.hairline`)
rather than promoting new ones.

### A known gap against rule 1

`SubagentReading` reads `FeedAgents.all(in:of:)` off the Session's own record — three of the
rail's four facts, matching `FeedAgentReader.agents(in:)` before its `told(_:)` step. It never
calls `told`, because that step answers off a Subagent's own file growing
(`Hub.subagentGrewAtMs`), and that reading exists only for whichever Session the deck currently
has open, never for every row on the roster at once. A row that is not open can therefore lag
the rail by exactly the gap #1269 closed: an open delegation past `DelegationCeiling` whose
child is still visibly writing reads `.unresolved` on the roster and `.running` on the rail,
until the row is opened and the fourth fact reaches it too. Flagged rather than fixed here:
wiring live per-child file-growth into every roster row is a larger change than this ticket's
scope, and the issue's own acceptance criteria are written against `FeedAgents.running(of:)`
alone.

## Extracted — #1345

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `PlanBar` | molecule | `ArgoUI/Shell/Sidebar/` — one caller (`SessionRow`) | `plan: PlanReading`, `isStill: Bool` | one `Capsule` per Plan step at `ArgoSpacing.hair`, the in-progress one wrapped in `BreathingMark` | frozen table, `PlanBar`; [`roster-row/running.png`](roster-row/running.png), [`roster-row/ready.png`](roster-row/ready.png) |
| `PlanBarFill` | value | `ArgoUI/Shell/Sidebar/PlanBar.swift` | three cases (`done` · `doing` · `pending`), from `PlanBarFill.reading(status:isStill:)` | `PlanEntryStatus` folded in with whether the whole bar has stopped moving | `PlanBarFillTests.swift` |

Extraction evidence: `PlanBar` is the design's frozen name, and it draws three readings the happy
path renders one of — a finished plan (`ready`) and a stopped one (rule 3) are states a running
row never shows. `PlanBarFill` came out as its own type because rule 3 is arithmetic, not
drawing: a step caught mid-flight reading as pending once the Session stops is asserted without
standing a view up.

### What stayed inline

- **The segment width** (`PlanBar.segmentWidth`) — `(64 − hair × (n−1)) / n`, floored at 2, on the
  view that draws it. The 64 has no other caller, and a plan of one step and a plan of twelve
  occupy the same width precisely because nothing else may state it.
- **The breath** — `BreathingMark(parkedAt: 1)`, the shared `SharedIonPass` the state dot already
  breathes on (rule 8). The two live marks on a row must not be two loops started at two moments;
  what differs between them is only where each one's breath ends, which is the `parkedAt` argument
  and not a second component.

### Contract changes these needed

None. `progress.still`, `interaction.accent` and `interaction.accentBright` were promoted ahead of
this build by #1341.

### What #1345 also changed

`PlanRing` in `PlanPill.swift` stroked its arc with `state.running`. Rule 2 is written against
both surfaces — the pill and the row draw the same fact about the same list — so the ring moved
to the accent in the same change rather than leaving two colours for one fact.

Rule 3 then had to follow it there, and did not at first: the ring took the accent fix without
the running gate, so an idle Session's dock pill kept drawing bright accent while the same
Session's row had already dropped to `progress.still`. `PlanShowing` now carries `isStill` too,
read off the same `stamp.status` the row reads, so the two freeze together. Caught by that
ticket's own code review rather than by its render — the pill and the row are two surfaces, and
no single frame holds both.

## Extracted — #1346

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `DeliveryAddresses` | molecule | `ArgoUI/Shell/Sidebar/` — one caller (`SessionRow`) | `ticketNumber: Int?`, `pullRequest: DeliveryPullRequest?` | `ArgoGlyph(.ticketsRoom)` + `Text`, two custom `Shape`s (`OpenPullRequestMark`, `MergedPullRequestMark`) + `Text` | frozen table, `DeliveryAddresses`; `roster-row/{running,merged,spent,unknown}.png` |

Extraction evidence: `DeliveryAddresses` is the design's frozen name, and it is a known
cross-screen unit already exercised by the two states the happy path (`running`) never renders —
merged and closed/draft.

The pull request's own mark has no SF Symbol: `checklist` is already spent on the Ticket, and
nothing on `ArgoSymbol`'s ladder is a fork-and-merge shape. Two private `Shape`s draw it, the way
`PlanRing` draws the plan's arc rather than reaching for a symbol that does not exist.

### What stayed inline

- **The branch-to-Delivery join** — `CockpitPresentation.Readings.pullRequest(forBranch:)`, one
  lookup over the array `DeliveryLedger.deliveries(of:)` already reads. A component wrapping a
  single array lookup would be a second place for the "no Project read yet" rule to drift from
  the ledger's own.
- **The ink switch** (`DeliveryPullRequest.ink(in:)`) — four `if`s over
  `isMerged` / `isDraft` / `state`, beside the type it reads rather than inside the view that
  draws it (`ArgoOperationalState.tint(in:)` is the same split for a Session's own state).
  Splitting it into a second file would be a second place for a rule the contract
  (`DeliveryRoles`) already states in one.

### Contract changes these needed

None. `delivery.open`, `delivery.merged`, `state.failure` and `state.idle` were promoted ahead of
this build by #1341; `machineCaption` and `text.tertiary` are pre-existing roles.

### What #1346 left for later tickets

- **Nothing populates `Readings.deliveries` in production yet.** `DeliveryLedger` and
  `DeliveryDerivation` exist and are tested, but no caller in the app target polls a code host and
  records into the ledger — that is #389's "Build the Code room and Delivery in Swift". Until it
  lands, every row draws its Ticket mark (where one is linked) and no pull request, which is the
  honest reading of an unread Project (`cockpit-roster-row.md`: "a row whose branch has no
  Delivery … draws no pull request — never a placeholder").
- **Rule 7** ("a ready claim with an open pull request never draws") has no `Ready` state to
  conflict with yet — that arrives with #1335/#1348. **Closed by #1348 below.**

## Extracted — #1347

**Nothing.** The ticket removes markup rather than adding it: once the Ticket number moved to line
3 with #1346, `IssueReading.words` had nothing left to join, and the em dash went with it. What
remains is the sentence, drawn by the title slot that already existed.

None of the three extraction tests fires: nothing appears a second time, no new shape entered the
row, and the states the change touches are the ones `DeliveryAddresses` was extracted for by
#1346.

### What stayed inline

- **The title's own spelling** (`SessionTitle`, `IssueReading`) — one reading, narrowed. A
  component would have been a second place for the rule that a title is a sentence.
- **The rival-ticket resolution** (`SessionRosterProjection+RowDerivations`) — which Ticket a row
  addresses when the branch and the record disagree. It answers off the row's own facts, beside
  the derivations that already read them.

### Contract changes these needed

None.

## Extracted — #1348

**Nothing.** The word slot already had its component: `ArgoStateLabel` (`ArgoAtoms`) is nothing
but the word, upper-cased there so no caller can draw one in sentence case, and it takes its ink
from the caller because *which* ink a state spends is the state's to say. `Ready` is a third word
through it, at `delivery.open`. A `ReadyBadge` beside it would have been a second component
drawing the same slot, and the slot's whole rule is that only one thing is ever in it.

None of the three extraction tests fires: the markup appears once, the shape is `ArgoStateLabel`
rather than a new cross-screen unit, and the unexercised states are the ones the badge slot
already had a component for.

### What stayed inline

- **The rank between the state word and `Ready`** — `SessionRosterProjection.Row.badge`, a
  two-case enum (`.state(String, ArgoOperationalState?)` · `.readyToShip`) resolved on the
  projection, not in the view. A row waiting on the reader or reporting a failure has more to
  say than that it is done, and the slot holds one thing, so the two cannot both be present:
  making them one optional is what stops a surface drawing both.
- **The staleness resolution** — `CockpitPresentation.Session.Work.Delivery.init(pullRequest:claim:)`,
  which takes the CONVENTION claim RAW and resolves it against the DERIVED pull request once.
  Downstream there is only a `Bool`, so no surface and no fixture can state the pair rule 7
  forbids. `DeliveryPullRequest.isFinished` is the degrade-down: a host word Argo cannot place
  is not evidence the pull request is over, so the claim stays off the row.
- **The ink** — `SessionRow.ink(of:)`, one `switch` over the badge's own case. Read off the case
  rather than off the row, so the word and the ink cannot come from two different readings.

### What #1348 changed

The reading, the ink and the suite all landed whole with #1335. What #1348 found missing was the
**shape** the design pairs with the word: `roster-row/ready.png` draws a completed Plan bar and no
pull request mark, and the ticket says the shape says it before the word does.
`ReadyToShipRosterSpecimen` carried no Plan at all, so the state rendered at half. Both claiming
rows now carry the same claim and the same finished Plan, so the pull request is the only thing
the badge slot answers to differently — the one fact the specimen exists to show.

### A correction to the design

`cockpit-roster-row.html` drew `Ready` behind a ship glyph. It never rendered: `.badge svg`
carried no size rule, unlike `.addr svg` and the chevron, so every `roster-row/ready.png` in the
repo has been the word alone. The word is also what the design's own prose asks for — the
measurements table calls the slot "the one word", and the two states sharing it draw words alone.
The glyph is gone from the explorable. Re-rendering all ten states after the removal changed no
byte of any PNG, which is the proof it drew nothing.

### Contract changes these needed

None. `delivery.open` was promoted by #1341 and `ArgoStateLabel` predates all three tickets.

## Extracted — #1349

**Nothing.** The epic owns no slot of its own: its seven children built the row, and what was left
was to judge the row as **one shape** rather than as seven slices, and to close the design out.
Each child's `pixel-review` looked at what that child drew; none of them looked at the assembled
column, which is where the miss below had been sitting since #1344.

### What the whole-row judgement found

- **The Subagent stack was drawn in `text.tertiary`.** The explorable draws a running pip in
  `--state-running` and the dash and the outline pip in `--text-disabled`; the design's *prose*
  named an ink for the `+n` label and for nothing else in that column, so the build read the prose
  and spent one grey on all three. Measured on `roster-row/ceiling.png`, every one of the five
  dots is `#46D3A8` = `state.running`; the app drew `#929AA1` = `text.tertiary`, the same grey as
  the landed dash — so a stack of five live Subagents and a stack that has all gone home read in
  one voice, which is the distinction rule 4 exists to hold. Fixed in `SubagentDots`, and the
  three inks are now **in the measurements table** so the next build reads them where it reads
  every other number.
- **The row padding was a false alarm, and is recorded as one.** The app's ground is a
  `listRowBackground` and the explorable's is a padded `div`; comparing their heights says 68
  against 71.5 and means nothing. Measured ink-to-ground instead, the 3.5pt is 1pt of margin —
  11.0 / 10.0 against 10.5 / 11.5, half a point at each end — and 2.5pt of the three lines' own
  leading, which the `drawnLineBox` row already covers. Re-derivable: render the `roster`
  specimen (`sh apps/macOS/scripts/specimens.sh <dir> roster`) and measure the selected row's
  ground against the ink inside it, at 2x, beside `roster-row/running.png` at 1x.
- **The padlock is a gap in the explorable, not drift in the row.** It answers to `Access`, which
  the explorable does not model at all. Recorded in the design under "What did not change".

### Contract changes these needed

None. `state.running` and `text.disabled` both predate the design; the fix spends tokens the row
was already reaching for one rung away.
