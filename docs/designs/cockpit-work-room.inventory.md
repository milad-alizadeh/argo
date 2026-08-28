# The Work room — inventory

What `design-to-code` extracted while building [`cockpit-work-room.md`](cockpit-work-room.md), and
what it deliberately left inline. One row per component the assembled screen forced out.

**Scope: #812, #814, #815, #816, #817, #818, #819 and #273** — the views sidebar, the flat backlog list
and the ticket (#812), the nesting that turned the list into a tree (#814), the ticket's fact strip
and its three sections (#815), the room's toolbar row (#816), the Next-up hero and its four tiers
(#817), the room's two vacancy pages (#818), and the priority bands over the backlog's roots
(#819), and the ranking that decides which ticket the hero holds (#273). The design freezes 31
names across the whole room; the names below are the ones these tickets built. The rest (the Route)
belongs to its own ticket and is absent rather than stubbed.

The tables below cover #812, #814, #815 and #818; #817's, #816's and #273's own sections are at the
foot.

## Extracted

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `WorkRoom` | organism | `ArgoUI/Shell/Work/` | `room: Room`, `cockpitRoom: Binding<CockpitRoom>`, `ticket: Binding<Int?>`, `view: Binding<WorkView>` | `WorkSidebar`, `BacklogList`, `TicketDetail`, `DeckSeparator` | `WorkRoom` |
| `WorkSidebar` | organism | `ArgoUI/Shell/Work/Sidebar/` | `room: Room`, `cockpitRoom: Binding<CockpitRoom>`, `view: Binding<WorkView>` | `RoomStrip`, `GroupLabel`, `ViewRow`, `ProviderFoot` | `WorkSidebar` |
| `RoomStrip` | atom | `ArgoUI/Shell/Work/Sidebar/` | `selection: Binding<CockpitRoom>` | stock `Picker(.segmented)` | `RoomStrip` |
| `ViewRow` | molecule | `ArgoUI/Shell/Work/Sidebar/` | `symbol: String`, `name: String`, `count: Int` | `ArgoGlyph` | `ViewRow` |
| `ProviderFoot` | atom | `ArgoUI/Shell/Work/Sidebar/` | `provider: WorkProvider` | `SessionStateIndicator` | `ProviderFoot` |
| `BacklogList` | organism | `ArgoUI/Shell/Work/Backlog/` | `rows: [Row]`, `selection: Binding<Int?>`, `shut: Binding<Set<Int>>` | `BacklogOutline` | `BacklogList` |
| `BacklogOutline` | molecule | `ArgoUI/Shell/Work/Backlog/` | `rows: [Row]`, `shut: Binding<Set<Int>>` | `BacklogRow` | `BacklogOutline` |
| `BacklogRow` | molecule | `ArgoUI/Shell/Work/Backlog/` | `drawn: Drawn`, `isOpen: Bool`, `toggle: (() -> Void)?` | `BacklogTwist`, `DeliveryDot` | `BacklogRow` |
| `BacklogTwist` | atom | `ArgoUI/Shell/Work/Backlog/` | `toggle: (() -> Void)?` (nil = leaf), `isOpen: Bool` | `ArgoDisclosure` | `BacklogTwist` |
| `DeliveryDot` | atom | `ArgoUI/Shell/Work/Backlog/` | `reading: DeliveryReading` (5 states) | — | `DeliveryDot` |
| `TicketDetail` | organism | `ArgoUI/Shell/Work/Detail/` | `ticket: Ticket?`, `open: (Int) -> Void` (#815) | `TicketHead`, `TicketFactStrip`, `TicketBody` | `TicketDetail` |
| `TicketHead` | molecule | `ArgoUI/Shell/Work/Detail/` | `ticket: Ticket` | `StatusPair` | `TicketHead` |
| `StatusPair` | atom | `ArgoUI/Shell/Work/Detail/` | `word: String`, `bucket: WorkItemState` (4 states) | — | `StatusPair` |
| `WorkRoomVacancy` | molecule | `ArgoUI/Shell/Work/` | `vacancy: WorkRoomProjection.Vacancy` (`unbound` \| `nothingOpen(provider:)`), `project: String?`, `connect: () -> Void` | stock `ContentUnavailableView` | `.vacant` |

### #815 — the fact strip and the sections

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `TicketFactStrip` | molecule | `ArgoUI/Shell/Work/Detail/` | `ticket: Ticket` (reads `priority`, `type`, `bucket`, `labels`) | `GroupLabel`, `LabelChip`, `WrapFlow`, `ArgoRule` | `TicketFactStrip` |
| `LabelChip` | atom | `ArgoUI/Shell/Work/Detail/` | `label: String` | — | `LabelChip` |
| `DeliveryChip` | molecule | `ArgoUI/Shell/Work/Detail/` | `delivery: DeliveryFacts` (`checks` 3 states; `url` optional) | stock `Button(.plain)` + `openURL` | `DeliveryChip` |
| `TicketLinkList` | molecule | `ArgoUI/Shell/Work/Detail/` | `links: [Link]`, `open: ((Int) -> Void)?` | `TicketLinkRow` → `DeliveryDot` | `TicketLinkList` |
| `TicketBody` | molecule | `ArgoUI/Shell/Work/Detail/` | `ticket: Ticket`, `open: (Int) -> Void` | `GroupLabel`, `DeliveryChip`, `TicketLinkList` | not frozen — see below |

`TicketLinkList` is **one** component, per the ticket: `blockedBy` and Children are two callers of
it. What separates them is the trailing fact each `Link` carries — the provider's status word on a
child, nothing on a blocker — and whether the caller passes an `open`. A blocker may be closed and
out of the backlog, so its row is text rather than a control that would lead somewhere empty.

`WrapFlow` grew a second gap for this. `.fact-strip` is one flex with `column-gap: 24` and
`row-gap: 8`, and the layout carried a single `gap` for both axes; it now takes a `Gaps` pair, with
`init(gap:)` kept for the three callers that want one step on both. Without it the strip would have
been two stacked runs, which reads the same at 480 and breaks a line the design would keep whole on
a ticket with one short label.

`TicketBody` is the one name here the design does not freeze. It was forced out by the file
ceiling, not by taste: `TicketDetail` with the three sections inline is over 150 code lines, and
the design's own table says anything unlisted is "stock used directly" — a `ScrollView`'s content
is exactly that.

Two names the design does not freeze were extracted anyway:

| name | tier | location | why |
|---|---|---|---|
| `ArgoRule` | atom | `ArgoUI/Atoms/` | The hidden-`Divider`-drawn-over trick, which `DeckSeparator` already owned and both `ProviderFoot` and `StatusPair` then needed. Three copies of one shape, so all three now call it and `DeckSeparator` keeps its name as the deck's own caller. |
| `GroupLabel` | atom | `ArgoUI/Atoms/` | `Section("…")` takes the platform's sidebar header — title case at the body rung — and the contract froze `sectionLabel`, uppercase at `subheadline` with tracking. Both groups need it, which is the repetition that forced it out. In `Atoms/` rather than under `Work/`: a group label is not the Work room's. |

## Stayed inline

- **The deck's two-pane split.** One `HStack` in `WorkRoom.deck` with `DeckSeparator` between —
  single-use, single-state, and `SessionsDeck` already owns the shape it would be extracted into.
- **The ticket's body.** A `Text` at `ArgoFeedRow`'s line spacing inside `TicketDetail`, behind
  `argoFeedMeasure()`. Its section headings are #813's role, so there is no markup to render yet
  and nothing an extracted view would hold.
- **The room strip's row in the sidebar's scroll.** One `previewSafeListRow()` call.
- **A section heading.** `Text` at `ArgoTypography.bodyHeading` with one lift above it, three
  callers in one file. A view whose whole body is a primitive with a role is not a component.
- **The Deliveries heading.** `GroupLabel("Deliveries")` — #812 already extracted that atom, and
  this is its fourth caller.
- **`TicketLinkRow`.** Private to `TicketLinkList`, its only owner. Same tier, one caller: it is
  that molecule's part, not its peer (`ui-components.md` — naming follows the tree).
- **Both vacancy pages, as separate views.** ONE `WorkRoomVacancy` serves them, because the point of
  the pair is the contrast: two views would let the two sentences drift until only one of them still
  said which nothing it was. The design freezes one name for both, and this is why. Which of the two
  it is is decided in `WorkRoomProjection.Vacancy`, beside the counts it is judged against, and not
  in the view.
- **The unbound room's missing sidebar.** A `NavigationSplitViewVisibility` in `CockpitView`, not a
  view — the column, its divider and its toggle are the split view's, and an `EmptyView` in the slot
  leaves all three drawn.

## Where the design and the code disagree

Three, each a defect in the design rather than a decision made here. The third was fixed
in the design itself; the first two stand.

- **`ArgoLayout.statusDotSize` does not exist.** The dot is `ArgoIconSize.statusDot`, same value
  (6), and the design names the wrong enum. No token moved.
- **`ArgoTypography.sessionTitle` did not exist.** The design's table calls the ticket title's
  17-semibold an "exact tuple" of a role the contract never had; `identityHeading` is 15. Added as
  `interface · title2 · semibold` — a second contract promotion beside #813's `bodyHeading`, which
  the design *did* flag.
- **The sidebar's counts did not add up.** `rest.png` read 12 open, 6 unblocked, 8 blocked —
  #160 and #185 are `bucket:'blocked'` with no edges, so the design's own `viewCount` counted
  them in both views. Fixed at the source: `unblocked` now excludes them, the design records the
  partition rule, and the nine renders that draw a non-zero `Unblocked` were re-shot. Both the
  render and the code now read 12 / 4 / 3 / 8.

A fourth, found by `pixel-review` on #818's pair and left standing:

- **The provider chip's dot is grey in the build and mint in `empty.png`.** The dot is the Binding's
  `ArgoOperationalState`, and the contract defines mint — `state.running` — as *a turn is in
  progress*. A Binding sitting there having answered is `idle`, "the quiet end of the vocabulary",
  and painting it mint would assert a poll nobody is running. The design's green is the web's
  connected-light convention, which this palette deliberately does not carry: `nil` is already the
  Binding Argo cannot establish, and `idle` is the one it can. #818's own criterion — the chip is
  quiet when unbound and present when bound — is about the chip's presence, which is what the
  design's prose says too ("the connection chip goes quiet with it"), and it holds.

## What #815 decided that the design left open

- **An empty `blockedBy` is the section ABSENT, not an empty section.** The design's explorable
  distinguishes `null` (no edges) from `[]` (edges read, none found) and draws `Nothing.` for the
  second. Swift cannot tell them apart — `WorkItem.blockedBy` is one array either way, and no port
  carries a "this provider has dependency edges" capability — so degrade-down resolves it to the
  quieter reading and the section is drawn only when there is a blocker to name. If a port ever
  learns to say which it is, that becomes a real tri-state and the rule changes with it.
- **A blocker with no title renders its number alone.** The design's `titleOf` falls back to
  `'Closed elsewhere'`; a stand-in a reader cannot tell from a real title is worse than a short
  row. Closed blockers the poll DID reach keep the tracker's name, which is the ticket's own
  acceptance criterion and what the four closed rows in `deep.png` are testing.
- **Priority and type are reading-side facts, not `WorkItem` fields.** No port reads either
  (#388), and #160 has not settled the type vocabulary, so they arrive beside the item the way a
  body does and are ABSENT rather than defaulted. `unreadTicket` is the render of the floor.
- **`checks` has three readings, not two.** The design draws `checks passing` or `checks failing`;
  a chip that has not heard from the checks now leaves the slot empty rather than claiming a pass.
- **A Delivery's deep link is optional.** `URL(string:)` is failable and `force_unwrapping` is a
  build error here, so a chip with no page is a fact that stays put rather than a control that
  opens nothing.
- **A truncated link title keeps its whole self behind a hover**, which is the design's own lesson
  about narrow columns — "the fix there is the id plus a hover, not a wider column".
- **`edgeless` strips every edge, so the sidebar's counts move with it.** `edgeless.png` shows
  `Unblocked 4 / Blocked 8` unchanged, because the explorable's state flag only reached the detail
  pane. A provider that cannot say what blocks what cannot fill those two views either. The
  divergence is the prototype's seam, not a number invented here.

### Two numbers this build did not take from the design

- **`labelInsetY` is `ArgoSpacing.hair` 2, where `.label` sets `padding: 1px`.** The rhythm has no
  1, and `rules/design-system.md` says snap rather than promote a rung for one call site.
  `ArgoBadge` spends the same step for the same reason. Not in the measurement table.
- **The head-to-strip gap is `ArgoSpacing.section` 24.** The design reaches ~20 there as two
  stacked CSS paddings rather than as a step, and 24 is the rung under the measurement off
  `deep.png`. Also not in the table.

### Still not drawn

`deep.png` and `edgeless.png` both show an `Acceptance criteria` heading inside the ticket's prose.
That is the provider's own Markdown, and nothing renders a body's markup yet — the three sections
BELOW the body are what `bodyHeading` (#813) has a caller for. Rendering the body's own headings is
its own ticket.

## What the views actually do

Opening a view **filters the deck**, and one predicate does it: `WorkView.admits(_:claimed:)` both
counts a view in the rail and fills the list beside it, so the two cannot answer the same question
differently. The counts are always over the whole open set — a rail recounted against its own filter
would read `Blocked 8` and every other view zero. `blockedWorkView` is the render of it.

Charts are deliberately **untagged**: a chart opens the Route (#334), which is not built, and the
list's selection is a `WorkView`. A tag would make the row look selectable and then filter the
backlog to something nobody asked for.

## How the tree is actually drawn (#814)

The design freezes `BacklogOutline` as `OutlineGroup(children:)`. It is built as a **flattening**
instead: `WorkRoomProjection.tree` derives the nesting from the child edge, `WorkRoomProjection.drawn`
flattens it to `[Drawn]` in draw order with a depth, and the outline is a `ForEach` over that inside
the list's own `List`. Three things the stock control cannot give forced it:

- **A `List` counts rows.** Selection and the 30pt row floor are both answers about rows, and
  nesting the views hands a subtree to a control that counts them.
- **The twist's hit target has to be its own.** `OutlineGroup` owns its chevron, and a chevron the
  list owns cannot be pressed without pressing the row under it.
- **A leaf keeps the slot.** `OutlineGroup` gives a leaf no chevron at all, so every dot would land
  on a different vertical.

The nesting itself is unchanged by this: `Row.children` comes from `WorkItem.children`, never from a
literal, and `Drawn.depth` is what the row is inset by.

Two ways a provider's edges can lie are resolved rather than trusted, because a tree that loses a row
to a bad edge is worse than one that flattens it: a child claimed by two parents hangs under the
first, and an edge that would make an item its own ancestor is refused.

### What #814 left inline

- **The fold itself.** `BacklogOutline` owns the toggle and `BacklogList` holds the seed; there is no
  disclosure *model* between them, because a `Set<Int>` of folded ids is the whole state.
- **A link row's `dot · id · title`.** `TicketLinkRow` (#815) reads like `BacklogRow`'s middle and is
  deliberately NOT shared with it: the two diverge at the twist, the indent and the roll-up's hover,
  and the duplication gate holds across both.

`ArgoTypography.unwired` is now **empty**. `bodyHeading` was disclaimed as unset; #815's `TicketBody`
draws it on the Children and Blocked-by headings, so the disclaimer became the lie and went, and
`BodyHeadingContractTests` asserts the role is wired rather than excused.

## Not reproduced from `rest.png`

The render carries the whole room, and `workRoom` now reproduces all of it: the sidebar, the
backlog banded and nested (folded in `collapsedWorkBacklog`), the toolbar row, the hero and the
ticket pane. The Route is the one thing still absent, because it is #334's.

## The two vacancies (#818)

`unboundWorkRoom` and `emptyWorkBacklog` are the renders, and both reproduce their design PNG's own
line breaks at a 1280×800 window. What is absent from `empty.png` is the Next-up hero's
backlog-clear tier; the toolbar's surviving `New ticket` is #816's, below.

Three things this ticket had to settle that the renders do not state:

- **Where the vacancy is judged.** Over the whole open set, never over `backlog` — which is already
  filtered to the open view, so opening `Blocked` with nothing blocked would otherwise announce that
  the backlog is clear. `Room.hasOpenWork` is that fact, and it is the one thing the room's other
  fields cannot answer.
- **What a finished backlog IS.** Every item closed, not an absence of items. `WorkFixture
  .answeredEmpty` is now the same twelve tickets resolved, which is what makes `empty.png`'s charts
  read `0` rather than vanish. A reading with no items at all reaches the same page — the two are
  one state, not two — but it cannot draw the charts the design's render carries.
- **Who the sentences name.** The provider that answered, and the Project the window is scoped to.
  `WorkReading.project` carries the second, and the shell overrides the fixture's copy of it with
  the window's real active Project — the one fact a fixture does not get to invent.

# #817 — the Next-up hero and its four tiers

## Extracted

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `NextUpCard` | molecule | `ArgoUI/Shell/Work/Sidebar/` — one caller, so it is `WorkSidebar`'s part rather than its peer | `nextUp: NextUp` (`.pick(Pick)` · `.nothingUnblocked` · `.allRunning` · `.backlogClear`) | `GroupLabel`, `NextUpChip` | `.hero-card` |
| `NextUpChip` | atom | `ArgoUI/Shell/Work/Sidebar/` | `reason: NextUp.Reason` (`.highPriority` · `.unblocked` · `.next(chart:)`) | — | `.chip` / `.chip.pri` |

`NextUpCard` came out on two of the three triggers at once: it is the design system's
empty-state-card shape, and it carries three states the happy path never draws. `NextUpChip` came
out on repetition inside its one caller, and is the only place in the room a state hue is drawn as
an edge rather than as an ink.

## Stayed inline

- **The id-and-title stack** inside the card — one `VStack` of two `Text`, single-use and
  single-state.
- **The three tier sentences** — a `switch` in the card's own body, which is what makes "every
  tier owns a sentence" a compile error to break rather than a review note.
- **The chip run** — `WrapFlow`, the design's `flex-wrap` which #815 had already spelled as a
  `Layout`. The first cut hand-rolled a `ViewThatFits` fallback; merging with #815 replaced it.

## What the hero refuses to say

Three suppressions, and they are the substance of the ticket rather than caveats on it.

- **`unblocked` is suppressed unless THIS ticket's edges were read.** Unknown is not the same as
  true, and `#388` has not landed, so `edgeless` is the *first* state rather than an edge case. The
  input is `WorkReading.edgesRead`, an explicit set: the first build inferred it from the backlog
  carrying edges anywhere, and review caught that a provider serving edges for other tickets would
  then assert `unblocked` for a pick nobody had asked about (`CONTEXT.md` L2 · degrade-down).
- **`oldest untouched` has no case at all.** The design lists it fourth; it is earned by a ranking
  that picks by age (#273), and nothing reads an age. A card can honestly carry zero chips — the
  chips are the reasons, and having none is a true rendering. Inventing the claim to avoid a bare
  card is the one thing the hero must never do.
- **`high priority` matches the provider's own word; it does not rank the ladder.** The chip is
  earned when `WorkReading.priorities` — #815's verbatim word, which Argo "neither ranks nor
  recases" — spells this ticket `high`, and echoes that word back. Which words a provider actually
  spells is #388's; which of them outrank the rest is #273's.

## Where the design and the code disagree

Two values the design's reconciliation table did not carry, snapped here and recorded there:

- **The empty-tier sentence, 12 regular** — no role sits at 12 regular. Snapped DOWN to `rowMeta`
  (11), the same direction the view name above it took, because the sentence is *why there is no
  ticket* rather than a ticket.
- **The urgent chip's border, amber at .28** — no role at .28. Snapped UP to
  `state.rim(attention)` (.5), the contract's named role for a state hue drawn as an edge. It is
  the louder of the two and pixel-review is where it is judged.

## Which specimen reproduces which render

| design render | specimen | note |
|---|---|---|
| `one-chip.png` | `oneEarnedChip` | #388's title, the longest in the backlog, so the render also proves the three-line wrap |
| `pool-blocked.png` | `nothingUnblocked` | |
| `pool-running.png` | `everythingRunning` | |
| `empty.png` | `emptyWorkBacklog` | #812's specimen, which now draws the backlog-clear tier |
| `edgeless.png` | `oneEarnedChip` | edgeless by construction — the suppression it exists to show is already the state being shot, so it earns no second entry |

The tiers are shot from `WorkPanesSpecimen`, which gives up the titlebar the room does not decide —
the same trade `#812`'s `unbound` and `empty` specimens make.

## What review changed

Two claims the first build got wrong, both caught before the PR:

- **`nothingUnblocked` fired with no open leaf at all.** A backlog of parents alone yielded an
  empty leaf set, and the card said "every open leaf is waiting on something still open" about a
  set with no members. It now degrades to `backlogClear`.
- **The edges probe was global.** See above — it is now per-pick, off an explicit `edgesRead`.

---

# #816 — the room's toolbar

The eight names the design freezes for the toolbar row, plus the two values the row is built from.
`RoomStrip` above moved out of `Work/Sidebar/` and into `Shell/Sidebar/`: it is every room's
picker now, not this room's.

## Extracted

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `WorkToolbar` | organism | `ArgoUI/Shell/Work/Toolbar/` | `reading: Reading`, `intents: WorkToolbarIntents`, `held: Held` | `BacklogToolbarLabel`, `NewTicketButton`, `StartControl`, `BacklogSearchField` | the `.titlebar.three` grid |
| `BacklogToolbarLabel` | molecule | `ArgoUI/Shell/Work/Toolbar/` | `reading: Reading`, `narrowing: () -> Void`, `grouping: () -> Void` | `ToolbarVessel`, `ToolbarIcon` | `.tb-list` |
| `ToolbarVessel` | atom | `ArgoUI/Shell/Work/Toolbar/` | `content: Content` | `argoFloatingGlass(in: .capsule)` | `.icap.glass` |
| `ToolbarIcon` | atom | `ArgoUI/Shell/Work/Toolbar/` | `symbol: String`, `label: String`, `act: () -> Void` | `ArgoGlyph` | `.ibtn` |
| `NewTicketButton` | atom | `ArgoUI/Shell/Work/Toolbar/` | `act: () -> Void` | `ToolbarVessel`, `ToolbarIcon` | `ibtn('compose')` |
| `StartControl` | molecule | `ArgoUI/Shell/Work/Toolbar/` | `verbs: Verbs`, `mode: Binding<SessionMode>` | `ToolbarVessel`, `ModeMenu`, `DeckSeparator`, `ToolbarIcon` | `.icap.split` |
| `ModeMenu` | molecule | `ArgoUI/Shell/Work/Toolbar/` | `mode: Binding<SessionMode>` (4 rungs) | stock `Menu` + `Picker(.inline)` | `.menu` / `MODE_MENU` |
| `BacklogSearchField` | atom | `ArgoUI/Shell/Work/Toolbar/` | `query: Binding<String>` | stock `TextField`, `argoFloatingGlass` | `.search.glass` |
| `WorkToolbarProjection` | value | `ArgoUI/Shell/Work/Toolbar/` | `reading(of:in:showing:) -> Reading` | — | the `titlebarHTML()` branches |
| `WorkToolbarIntents` | value | `ArgoUI/Shell/Work/Toolbar/` | four closures plus a `Verbs` triple, all inert by default | — | the buttons' `title=` strings |

`ArgoWorkToolbar` beside them is the surface sheet, not a component: the block width, the icon
button's slot, the vessel inset, the split rule and the search field's measure.

## What stayed inline

- **The two link verbs.** `ToolbarIcon` twice inside `StartControl`, single-use each.
- **The `Start` verb itself.** A `Button` with a glyph and a word, in the one control that spends
  a word. Extracted it would be a `ToolbarIcon` with a label bolted on.
- **The row's flexible spacer.** `ToolbarSpacer(.flexible, placement: .primaryAction)`, stock.

## The column-placement question — answered wrongly, and what the render showed

**This build's answer does not hold, and the branch ships it anyway so the evidence is on the
record.** What was tried: every item at `.primaryAction`, with the list block claiming
`ArgoBacklogList.width` 520 at that region's leading edge, on the premise that `.primaryAction` is
the region the detail pane draws.

**The premise is false.** macOS lays `.navigation` and `.primaryAction` out as ONE continuous band,
so `ShellToolbar`'s sidebar toggle, New Session and the scope vessel are drawn first and eat about
270pt before the block starts. Measured off `ARGO_SPECIMEN=workRoom` at the 1280 window:

| | design (`menu.png`) | this build |
|---|---|---|
| `Backlog` heading | ~306, just past the sidebar | ~700, onto the ticket column |
| filter / group-by | trailing edge of the 520 block | pushed to the window's trailing edge |
| New ticket · Start · links · search | over the ticket column | behind an unlabelled `»` overflow |

That last row breaks the design's own rule — nothing in this room is behind an unlabelled control.
`ARGO_SPECIMEN=workToolbar` renders the same row in isolation and it IS the design, so the
components are sound and only the mounting is wrong.

**The two routes left are the ticket's own, and the render is evidence for the one it preferred.**
A three-column `NavigationSplitView` gives real per-column regions at every width, and costs a
shell fork plus a per-room state reset — the objection that produced this build in the first place.
A sticky header inside the list pane removes the 520 arithmetic and the overflow together, and
costs the room a second chrome band and New ticket's placement over the column it opens.
`.principal` stays closed for the reason `ShellToolbar` records.

## Where the design and the code disagree

The heading and its sub-line take the roles the design's own snap table names —
`ArgoTypography.windowTitle` and `rowMeta`, both marked "exact" there. The first build reached for
`rowTitle` and `caption` instead, which is a weight too light and a rung too small.

- **`iconSize` 14 is not a rung.** 14 is the SVG box the study drew its icons into.
  `ArgoIconSize.control` 13 is the rung the contract gives "a control's own mark", and a fourth
  rung would be a token change this room has no standing to make. No token moved.
- **The Mode rows carry the composer's boundary words, not the study's.** The study writes
  `reads, never writes` / `writes a plan, not the code` / `edits the worktree` /
  `runs the gates too`; `SessionMode.boundary` writes `no writes` / `no writes, proposes` /
  `the Workspace` / `no boundary`, and `SessionModeReading.help` already puts them on the
  composer's control. One fact said two ways is one of them waiting to go stale, so the menu reuses
  the contract's. A native `Menu` row is also one line of text, so the study's two-column layout —
  the word, its boundary set right in the machine caption — is not reachable through the `Picker`
  the frozen-names table itself specifies; the em dash carries the same pair.
- **The subtitle dropped `by priority` until #819.** The middle term names the GROUPING in force
  and until #819 the list had none: #814 nested it into a tree, which is not a grouping. A heading
  reading `by priority` over an ungrouped list is the exact lie the second line exists to prevent,
  so the term arrived with the headers it describes.
- **`RoomsVessel` is deleted, not merely unused.** The AC asks for one rooms picker; `RoomStrip` is
  it, so the titlebar's vessel and the flexible spacer that only ever pushed it to the trailing
  edge are gone, and `ShellSidebar` draws the strip so Sessions and Code keep a way back to Work.
  `ToolbarSegment` lost its mark-shaped fit and the two slot measures with it — a `Picker` draws
  its own segments — and `ToolbarSegmentTests`, which asserted only that arithmetic, went too.
- **New Session stays on the bar in the Work room.** The study's `.tb-lead` is the traffic lights
  and the scope vessel alone. Removing an app-wide verb per room is a decision #816 does not make,
  and the room's own call-to-action is New ticket, over the column it opens.
- **The menu offset 40 is not implemented, and cannot be.** `ModeMenu` is the stock `Menu` the
  frozen-names table specifies, and AppKit positions and draws its own popover. Recorded in the
  measurement table rather than silently dropped.

## Still not measured

**That search clears the trailing edge at the 1280 window.** The 210 is in the code, but in the
shell the field is inside the overflow above, so nothing yet shows it uncollapsed. It settles with
the placement, not before.

## Not reproduced from `menu.png`

`ModeMenu` is a native `Menu`. AppKit owns the open popover, so it cannot be put on screen by a
specimen and the open state has no headless render — `menu.png` stays the study's drawing of it.
The row it hangs from is `workToolbar`, and the two vacancies are `emptyWorkToolbar` and
`unboundWorkToolbar`.

# #819 — priority groups the backlog roots

## Extracted

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `PriorityHeader` | atom | `ArgoUI/Shell/Work/Backlog/` | `band: Band`, `count: Int` | `GroupLabel` | `.pri-head` |

One name, and the design froze it. Nothing else came out: the odd priority a child states is a
`Text` in the slot `BacklogRow` already had, and the banding is arithmetic rather than a view.

## Stayed inline

- **The odd-priority caption.** It is `BacklogRow`'s existing trailing slot with a second thing
  that can fill it, not a second component. `BacklogRow` now picks between the roll-up and the odd
  word in one place, which is the only place either can be drawn.
- **The band itself.** `WorkRoomProjection.Band` is a value on the projection, not a view.
  `BacklogList` iterates it directly; a `BacklogBand` view between the list and the outline would
  have one caller and no state.

## What this ticket had to settle that the render does not state

- **Priority is a relation between a row and its header, not a fact of the row.** `Row.priority`
  is the provider's word; `Drawn.odd` is that word only where the band's header disagrees with it,
  and it is set when the band is flattened rather than when the tree is built — a row's `odd`
  depends on which header it ended up under, which the tree does not know.
- **The header counts the array the list drew.** `BacklogList` flattens the band ONCE and hands the
  same array to `PriorityHeader` and `BacklogOutline`. Two calls to `drawn` could come to disagree
  about what is under the fold, which is exactly the lie the drawn-count rule exists to prevent.
- **A parent's roll-up wins the trailing slot.** #334 is a `medium` under `HIGH` and also a parent,
  and it draws `0/2`. The design's own explorable does the same (`t.kids ? rollup : odd`): two
  numbers in one slot is worse than an odd priority left unsaid, and the roll-up is the fact the
  reader cannot reconstruct from anything else on the row.
- **Roots with no priority read band under a header that says so.** No port reads a priority yet
  (#388), so a reading with none is the state that ships — and the three headers the design draws
  would have dropped every one of those rows. They band last, under `NO PRIORITY READ`, which
  names the TIER rather than claiming the tracker set none (`CONTEXT.md` L2 · degrade-down). A
  child under that header whose own priority is also unread states nothing: it has nothing honest
  to say, and the quieter reading is the one degrade-down picks.
- **The three words are MATCHED, not ranked.** `WorkReading+NextUp` already matches `high` this
  way. A word Argo has no band for keeps a header of its own, in the order the provider served it,
  rather than being sorted into one of the three — Argo does not own this ladder.
- **The match folds case; the word does not.** A tracker spelling one of its own words `Low` would
  otherwise open a second band beside `low`, headed with the same word, and a child under it would
  be told it disagrees with a header it agrees with. `Band.priority` is still the provider's word
  verbatim — `GroupLabel` is what uppercases the header, and Argo recases nothing.
- **A band's key is not its word.** `Band.id` distinguishes the unread band from one whose word is
  empty. Two bands sharing a `ForEach` key draws one and drops the other, which is a row lost to an
  id rather than to an edge — the same failure `WorkRoomProjection+Tree` refuses.

## Not a `Section`, and why

The frozen-names table says `PriorityHeader` stands in for a `Section` header. It is drawn as an
ordinary row instead, with `selectionDisabled()`.

`List(.inset)` spends about **52** between one section and the next section's word, where the
design draws `comfortable` 12 — and macOS exposes no lever on it: `listSectionSpacing` is
unavailable there, and zeroing the header's `listRowInsets` moves nothing. Two things the `Section`
was buying, and only one comes back:

- **A header outside the selection and outside keyboard traversal** — `selectionDisabled()` gives
  this back exactly.
- **Pinning.** The explorable draws `position: sticky`, and a row does not pin. At twelve tickets
  the list does not scroll and it costs nothing; on a real backlog the band a reader is inside
  stops being named. That is the price paid for the measurement, and it is the thing to revisit if
  the backlog ever gets long enough to scroll past a whole band.

This is the same amendment #814 made to `BacklogOutline`, for the same reason: the stock control
could not hold something the design had already settled.

## The renders

`workRoom` reproduces `rest.png` and `collapsedWorkBacklog` reproduces `collapsed.png`, both at a
1280×800 window — the band counts `8 · 1 · 3`, falling to `1 · 1 · 3` with #607 folded, and the
odd priorities on #273, #335 and #336. The unread band has no design render of its own; it is
visible in `nothingUnblocked` and `everythingRunning`, whose readings carry no priorities at all.
---

# #273 — the ranking behind the hero

#817 built the card and its four tiers; this is the ranking that decides which ticket lands in it.
**No component came out.** The card, the chip and the wrap were all extracted then, and a ranking
draws nothing — every name below is a value.

## Extracted

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `WorkItemPriority` | value | `ArgoEngine/WorkItem/` | `init(word:)`, `rung: Int`, `known: [String]` | — | `priority desc`, the first ranking key |
| `WorkItem.updatedAt` | value | `ArgoEngine/WorkItem/` | `Date?` | — | `age`, the third key |
| `WorkReading.ranked(_:)` | value | `ArgoUI/Shell/Work/` | `[WorkItem] -> [WorkItem]` | `Rank` (private) | the ranking itself |
| `NextUp.Reason.oldestUntouched` | value | `ArgoUI/Shell/Work/` | — | `NextUpChip`, unchanged | the design's fourth chip |

`NextUpChip` needed no edit for the fourth reason: it renders `reason.words` and takes its ink from
`isUrgent`, so a new case is a new word and nothing else. That is the one place this ticket found the
#817 build had already paid for the extension.

## The three decisions the ticket left open

- **The priority ladder lives in the ENGINE.** `WorkRoomProjection+Bands` held
  `bandOrder = ["high", "medium", "low"]` in `ArgoUI` under the comment *"Matched, never ranked"*.
  Both halves are now true of one list: `WorkItemPriority.known` is the words, and `rung` is the
  order — bands still MATCH against it and the hero RANKS by it. Two copies of those three words is
  how a band comes to sit above a ticket the hero ranked below it. Licensed by ADR-0016: *"provider
  priority is a sort Argo reflects"*. The words stay the provider's and stay verbatim on the
  `WorkItem` — nothing recases one.
- **`age` is last-touched, not filed.** `oldest untouched` is a claim about neglect, and a ticket
  filed a year ago and edited this morning is not neglected. It reads GitHub's `updated_at`, held on
  the wire as the STRING it arrives as: the decoder these calls share sets no date strategy, and
  giving it one would re-read every other date on the wire.
- **There is no Sessions-room pointer card.** AC 8 asked for one; two later designs forbid it by
  name. `cockpit-session-interior-decisions.md` B6 and `cockpit-spec.md` §4.1 both settle the roster
  zero-state as the pinned `+ New session` row alone, *"no Next-up card"* included.
  `cockpit-surface-matrix.md` is amended rather than the code, and the AC closes on its actual
  force: the ranked list has exactly one home, and it is this room.

## What the ranking refuses to be

- **A total order, and deliberately more than three keys deep.** `priority desc → PRD sequence →
  age`, then the ticket NUMBER. The fourth is not a ranking input — it breaks the tie the three
  left, so an unchanged listing cannot yield two different picks across two polls. A hero that
  reshuffled under an unchanged backlog would churn on every one.
- **A cold-start planner, never a best-move recommender.** The pool is
  `open · leaf · todo · unblocked · session-less`. `todo` and `session-less` are ONE clause —
  `WorkItemState.open` is open and unclaimed — and blocked items are shown in the backlog but never
  recommended here.
- **No score, anywhere.** `Rank` is four sort keys and never a number rendered; nothing sums or
  weights them. Spec-readiness and blocker-criticality are not inputs at all.
- **`spec ready` has no case.** The design draws no such chip and the only thing that could earn one
  is an explicit provider label — never a read of the ticket's prose. A test holds the line: a
  ticket labelled and bodied `spec ready` earns the ordinary chips and nothing more.

## Two claims #817 recorded that this ticket supersedes

- **"`oldest untouched` has no case at all"** — it has one now, and it stays a checked FALLBACK: it
  is earned only where none of the other three was AND a timestamp was actually read. A ticket
  nobody read an age for still carries no chip, which is the same suppression in a new place.
- **The inputs named `WorkReading.edgesRead` and `WorkReading.priorities`** — #820 moved every
  per-ticket fact onto the `WorkItem` itself, so both reads are now `pick.blockage` and
  `pick.priority`. The suppression they describe is unchanged.

Two silences worth naming, because both could have been faked:

- **An unknown priority word sits on ONE rung below `low`, and unread sits below THAT.** Two words
  nothing has ordered are not ordered against each other; absent is not a rung (ADR-0014).
- **A ticket with no timestamp read sorts LAST, not first.** Treating a silence as ancient would put
  the least-known ticket at the head of a list that sorts by neglect.

## Which specimen reproduces which render

None new. The hero's four tiers and its one-chip state were all shot at #817, and the ranking moves
no pixel in them: the fixture's pool has exactly one takeable unclaimed leaf (#273 — the other three
clear leaves are claimed), so the pick is the same ticket the ranking or the provider's order would
both have named. The `oldest untouched` chip has no design render of its own and is drawn in
`NextUpChip`'s own preview beside the other three.
