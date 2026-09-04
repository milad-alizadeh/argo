# The Tickets room — inventory

> **Renamed by #881 · 2026-08-28:** this room was called **Work** when the design was approved.
> The room, its symbols and its specimen names now read **Tickets**; this file, its `.html` and the
> `work-room/` renders keep their names, because six other docs and the design's own provenance
> cite them by path.

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
| `TicketsRoom` | organism | `ArgoUI/Shell/Tickets/` | `room: Room`, `cockpitRoom: Binding<CockpitRoom>`, `ticket: Binding<Int?>`, `view: Binding<TicketsView>` | `TicketsSidebar`, `BacklogList`, `TicketDetail`, `DeckSeparator` | `TicketsRoom` |
| `TicketsSidebar` | organism | `ArgoUI/Shell/Tickets/Sidebar/` | `room: Room`, `cockpitRoom: Binding<CockpitRoom>`, `view: Binding<TicketsView>` | `RoomStrip`, `GroupLabel`, `ViewRow`, `ProviderFoot` | `TicketsSidebar` |
| `RoomStrip` | atom | `ArgoUI/Shell/Tickets/Sidebar/` | `selection: Binding<CockpitRoom>` | stock `Picker(.segmented)` | `RoomStrip` |
| `ViewRow` | molecule | `ArgoUI/Shell/Tickets/Sidebar/` | `symbol: String`, `name: String`, `count: Int` | `ArgoGlyph` | `ViewRow` |
| `ProviderFoot` | atom | `ArgoUI/Shell/Tickets/Sidebar/` | `provider: TicketsProvider` | `SessionStateIndicator` | `ProviderFoot` |
| `BacklogList` | organism | `ArgoUI/Shell/Tickets/Backlog/` | `rows: [Row]`, `selection: Binding<Int?>`, `shut: Binding<Set<Int>>` | `BacklogOutline` | `BacklogList` |
| `BacklogOutline` | molecule | `ArgoUI/Shell/Tickets/Backlog/` | `rows: [Row]`, `shut: Binding<Set<Int>>` | `BacklogRow` | `BacklogOutline` |
| `BacklogRow` | molecule | `ArgoUI/Shell/Tickets/Backlog/` | `drawn: Drawn`, `isOpen: Bool`, `toggle: (() -> Void)?` | `BacklogTwist`, `DeliveryDot` | `BacklogRow` |
| `BacklogTwist` | atom | `ArgoUI/Shell/Tickets/Backlog/` | `toggle: (() -> Void)?` (nil = leaf), `isOpen: Bool` | `ArgoDisclosure` | `BacklogTwist` |
| `DeliveryDot` | atom | `ArgoUI/Shell/Tickets/Backlog/` | `reading: DeliveryReading` (5 states) | — | `DeliveryDot` |
| `TicketDetail` | organism | `ArgoUI/Shell/Tickets/Detail/` | `ticket: Ticket?`, `open: (Int) -> Void` (#815) | `TicketHead`, `TicketFactStrip`, `TicketBody` | `TicketDetail` |
| `TicketHead` | molecule | `ArgoUI/Shell/Tickets/Detail/` | `ticket: Ticket` | `StatusPair` | `TicketHead` |
| `StatusPair` | atom | `ArgoUI/Shell/Tickets/Detail/` | `word: String`, `bucket: TicketState` (4 states, the bucket drawn only where it is not the word — #893) | `ArgoRule` | `StatusPair` |
| `TicketsRoomVacancy` | molecule | `ArgoUI/Shell/Tickets/` | `vacancy: TicketsRoomProjection.Vacancy` (`unbound` \| `nothingOpen(provider:)`), `project: String?`, `connect: () -> Void` | stock `ContentUnavailableView` | `.vacant` |

### #836 — the room's chrome, mounted per column — **reversed by #855**

The per-column bands are gone; every control is back in the window's one row. See **the
column-placement question** below for what the bands bought and what they cost.

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `BacklogHeader` | molecule | `ArgoUI/Shell/Tickets/Backlog/` | `reading: TicketsChromeProjection.Reading` | — | renamed from `BacklogToolbarLabel`, which was a toolbar item claiming 520pt. **#855**: words only, the controls left it |
| ~~`BacklogControls`~~ | — | — | — | — | **#855**: split out of `BacklogHeader` when the controls returned to the row. **#900**: the funnel it also held was bound to `{}`, so the mark, its `narrowing` intent and the rule beside it are deleted. **Deleted #1242**: it wrapped `BacklogMenu` alone |
| ~~`BacklogMenu`~~ | — | — | — | — | Mail's `⋯` beside its filter. **#900**: its one row is a `Text`, so the `grouping` closure it took is gone too. **Deleted #1242**: a menu whose only content is a sentence is a sentence behind a click. It returns with a second grouping (#388) |
| ~~`TicketBand`~~ | — | — | — | — | added by #836 to carry New ticket and the ticket's verbs over their column. **Deleted by #855**: both are toolbar items again |

### #815 — the fact strip and the sections

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `TicketFactStrip` | molecule | `ArgoUI/Shell/Tickets/Detail/` | `ticket: Ticket` (reads `priority`, `type`, `bucket`, `labels`) | `GroupLabel`, `LabelChip`, `WrapFlow`, `ArgoRule` | `TicketFactStrip` |
| `LabelChip` | atom | `ArgoUI/Shell/Tickets/Detail/` | `label: String` | — | `LabelChip` |
| `DeliveryChip` | molecule | `ArgoUI/Shell/Tickets/Detail/` | `delivery: DeliveryFacts` (`checks` 3 states; `url` optional) | stock `Button(.plain)` + `openURL` | `DeliveryChip` |
| `TicketLinkList` | molecule | `ArgoUI/Shell/Tickets/Detail/` | `links: [Link]`, `open: ((Int) -> Void)?` | `TicketLinkRow` → `DeliveryDot` | `TicketLinkList` |
| `TicketBody` | molecule | `ArgoUI/Shell/Tickets/Detail/` | `ticket: Ticket`, `open: (Int) -> Void` | `GroupLabel`, `DeliveryChip`, `TicketLinkList` | not frozen — see below |

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
| `GroupLabel` | atom | `ArgoUI/Atoms/` | `Section("…")` takes the platform's sidebar header — title case at the body rung — and the contract froze `sectionLabel`, uppercase at `subheadline` with tracking. Both groups need it, which is the repetition that forced it out. In `Atoms/` rather than under `Tickets/`: a group label is not the Tickets room's. |

## Stayed inline

- **The deck's two-pane split.** One `HStack` in `TicketsRoom.deck` with `DeckSeparator` between —
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
  that molecule's part, not its peer (`rules/swift.md` — naming follows the tree).
- **Both vacancy pages, as separate views.** ONE `TicketsRoomVacancy` serves them, because the point of
  the pair is the contrast: two views would let the two sentences drift until only one of them still
  said which nothing it was. The design freezes one name for both, and this is why. Which of the two
  it is is decided in `TicketsRoomProjection.Vacancy`, beside the counts it is judged against, and not
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
  second. Swift cannot tell them apart — `Ticket.blockedBy` is one array either way, and no port
  carries a "this provider has dependency edges" capability — so degrade-down resolves it to the
  quieter reading and the section is drawn only when there is a blocker to name. If a port ever
  learns to say which it is, that becomes a real tri-state and the rule changes with it.
- **A blocker with no title renders its number alone.** The design's `titleOf` falls back to
  `'Closed elsewhere'`; a stand-in a reader cannot tell from a real title is worse than a short
  row. Closed blockers the poll DID reach keep the tracker's name, which is the ticket's own
  acceptance criterion and what the four closed rows in `deep.png` are testing.
- **Priority and type are reading-side facts, not `Ticket` fields.** No port reads either
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
  1, and `rules/swift.md` says snap rather than promote a rung for one call site.
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

Opening a view **filters the deck**, and one predicate does it: `TicketsView.admits(_:claimed:)` both
counts a view in the rail and fills the list beside it, so the two cannot answer the same question
differently. The counts are always over the whole open set — a rail recounted against its own filter
would read `Blocked 8` and every other view zero. `blockedTicketsView` is the render of it.

Charts are deliberately **untagged**: a chart opens the Route (#334), which is not built, and the
list's selection is a `TicketsView`. A tag would make the row look selectable and then filter the
backlog to something nobody asked for.

## How the tree is actually drawn (#814)

The design freezes `BacklogOutline` as `OutlineGroup(children:)`. It is built as a **flattening**
instead: `TicketsRoomProjection.tree` derives the nesting from the child edge, `TicketsRoomProjection.drawn`
flattens it to `[Drawn]` in draw order with a depth, and the outline is a `ForEach` over that inside
the list's own `List`. Three things the stock control cannot give forced it:

- **A `List` counts rows.** Selection and the 30pt row floor are both answers about rows, and
  nesting the views hands a subtree to a control that counts them.
- **The twist's hit target has to be its own.** `OutlineGroup` owns its chevron, and a chevron the
  list owns cannot be pressed without pressing the row under it.
- **A leaf keeps the slot.** `OutlineGroup` gives a leaf no chevron at all, so every dot would land
  on a different vertical.

The nesting itself is unchanged by this: `Row.children` comes from `Ticket.children`, never from a
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

The render carries the whole room, and `ticketsRoom` now reproduces all of it: the sidebar, the
backlog banded and nested (folded in `collapsedTicketsBacklog`), the toolbar row, the hero and the
ticket pane. The Route is the one thing still absent, because it is #334's.

## The two vacancies (#818)

`unboundTicketsRoom` and `emptyTicketsBacklog` are the renders, and both reproduce their design PNG's own
line breaks at a 1280×800 window. What is absent from `empty.png` is the Next-up hero's
backlog-clear tier; the toolbar's surviving `New ticket` is #816's, below.

Three things this ticket had to settle that the renders do not state:

- **Where the vacancy is judged.** Over the whole open set, never over `backlog` — which is already
  filtered to the open view, so opening `Blocked` with nothing blocked would otherwise announce that
  the backlog is clear. `Room.hasOpenWork` is that fact, and it is the one thing the room's other
  fields cannot answer.
- **What a finished backlog IS.** Every item closed, not an absence of items. `TicketsFixture
  .answeredEmpty` is now the same twelve tickets resolved, which is what makes `empty.png`'s charts
  read `0` rather than vanish. A reading with no items at all reaches the same page — the two are
  one state, not two — but it cannot draw the charts the design's render carries.
- **Who the sentences name.** The provider that answered, and the Project the window is scoped to.
  `TicketsReading.project` carries the second, and the shell overrides the fixture's copy of it with
  the window's real active Project — the one fact a fixture does not get to invent.

# #817 — the Next-up hero and its four tiers

## Extracted

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `NextUpCard` | molecule | `ArgoUI/Shell/Tickets/Sidebar/` — one caller, so it is `TicketsSidebar`'s part rather than its peer | `nextUp: NextUp` (`.pick(Pick)` · `.nothingUnblocked` · `.allRunning` · `.backlogClear`) | `GroupLabel`, `NextUpChip` | `.hero-card` |
| `NextUpChip` | atom | `ArgoUI/Shell/Tickets/Sidebar/` | `reason: NextUp.Reason` (`.highPriority` · `.unblocked` · `.next(chart:)`) | — | `.chip` / `.chip.pri` |

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
  input is `TicketsReading.edgesRead`, an explicit set: the first build inferred it from the backlog
  carrying edges anywhere, and review caught that a provider serving edges for other tickets would
  then assert `unblocked` for a pick nobody had asked about (`CONTEXT.md` L2 · degrade-down).
- **`oldest untouched` has no case at all.** The design lists it fourth; it is earned by a ranking
  that picks by age (#273), and nothing reads an age. A card can honestly carry zero chips — the
  chips are the reasons, and having none is a true rendering. Inventing the claim to avoid a bare
  card is the one thing the hero must never do.
- **`high priority` matches the provider's own word; it does not rank the ladder.** The chip is
  earned when `TicketsReading.priorities` — #815's verbatim word, which Argo "neither ranks nor
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
| `empty.png` | `emptyTicketsBacklog` | #812's specimen, which now draws the backlog-clear tier |
| `edgeless.png` | `oneEarnedChip` | edgeless by construction — the suppression it exists to show is already the state being shot, so it earns no second entry |

The tiers are shot from `TicketsPanesSpecimen`, which gives up the titlebar the room does not decide —
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
`RoomStrip` above moved out of `Tickets/Sidebar/` and into `Shell/Sidebar/`: it is every room's
picker now, not this room's.

## Extracted

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| ~~`TicketsToolbar`~~ | — | — | — | — | the `.titlebar.three` grid. **#836**: search alone, the rest went to the bands. **#855**: every control the room has, on one line. **Deleted #1242**: the room contributes nothing to `.toolbar` — each pane draws its own header |
| ~~`BacklogToolbarLabel`~~ | molecule | — | — | — | **#836**: renamed `BacklogHeader` and moved into the list pane |
| `ArgoIconButtonGroup` | atom | `ArgoDesign/ArgoAtoms/` | `content: Content` | `argoFloatingGlass(in: .capsule)` | `.icap.glass` |
| `ArgoIconButton` | atom | `ArgoDesign/ArgoAtoms/` | `symbol: String`, `voice: ArgoControlVoice`, `face: ArgoControlFace`, `act: () -> Void` | `ArgoGlyph` | `.ibtn` |
| `TicketsPaneHeader` | atom | `ArgoUI/Shell/Tickets/Chrome/` | `reach: CGFloat`, `inset: CGFloat`, `leading`, `trailing` | — (it paints nothing) | **#1242**, from `ticket-verbs-prototype.html` `.paneheader`. The band is the window's title strip, reached into — no constant, and no material of its own: `argoChromeBar` per pane drew the window's one sheet three times |
| `BacklogPaneHeader` | molecule | `ArgoUI/Shell/Tickets/Chrome/` | `creation: Creation`, `query: Binding<String>` | `TicketsPaneHeader`, `NewTicketButton`, `BacklogSearchField` | **#1242**, `.backlog .paneheader` |
| `TicketPaneHeader` | molecule | `ArgoUI/Shell/Tickets/Chrome/` | `verbs: Verbs?` | `TicketsPaneHeader`, `StartControl` | **#1242**, `.pane .paneheader` |
| `NewTicketButton` | atom | `ArgoUI/Shell/Tickets/Chrome/` | `creation: Creation` | `ArgoIconButtonGroup`, `ArgoIconButton` | `ibtn('compose')`. **#1242**: a 36pt circle at the list pane's leading edge |
| `StartControl` | molecule | `ArgoUI/Shell/Tickets/Chrome/` | `verbs: Verbs` | `ArgoIconButtonGroup`, `StartVerb`, `StartSkillMenu` | `.icap.split`, then the prototype's `.as-line`. **#1242**: ONE pill, two segments, no rule between them |
| `StartSkillMenu` | atom | `ArgoUI/Shell/Tickets/Chrome/` | `command: WorkCommand?`, `pick: (WorkCommand?) -> Void` | stock `Menu` | **#1242**, the prototype's `.menu`. Which skill the Session opens on; the command segment IS the control |
| ~~`ModeMenu`~~ | molecule | **deleted (#872)**; its directory went with #1242 | `mode: Binding<SessionMode>` (4 rungs) | stock `Menu` + `Picker(.inline)` | `.menu` / `MODE_MENU` |
| `BacklogSearchField` | atom | `ArgoUI/Shell/Tickets/Chrome/` | `query: Binding<String>` | stock `TextField`, `argoFloatingGlass` | `.search.glass`. **#1242**: at the LIST pane's trailing edge, not the window's |
| `TicketsChromeProjection` | value | `ArgoUI/Shell/Tickets/` | `reading(of:in:showing:) -> Reading` | — | the `titlebarHTML()` branches |
| `TicketsChromeIntents` | value | `ArgoUI/Shell/Tickets/Chrome/` | a `Creation` and a `Verbs`, both inert by default | — | the buttons' `title=` strings |

`ArgoTicketsToolbar` beside them is the surface sheet, not a component: the block width and the
search field's measure. **#1243** took the icon button's slot, the vessel inset and the split rule
off it — four headers each measured their own, and all four now read `ArgoControlBox`.

## What stayed inline

- ~~**The two link verbs.**~~ **Deleted #1242** — the ticket's number is the link.
- **The `Start` verb itself.** A glyph and a word, in the one control that spends a word.
  Extracted it would be an `ArgoIconButton` with a label bolted on. **#1242**: it is a segment of
  the pill now, drawing no ground of its own — the capsule IS the ground.
- ~~**The row's flexible spacer.**~~ **Deleted #1242** with the row. A pane header spaces its two
  slots with a stock `Spacer`, which needs no placement because it is inside a view.

## The column-placement question — answered, and what the wrong answer showed (#836)

**#816's answer did not hold.** What it tried: every item at `.primaryAction`, with the list block
claiming `ArgoBacklogList.width` 520 at that region's leading edge, on the premise that
`.primaryAction` is the region the detail pane draws.

**The premise is false.** macOS lays `.navigation` and `.primaryAction` out as ONE continuous band,
so `ShellToolbar`'s sidebar toggle, New Session and the scope vessel were drawn first and ate about
270pt before the block started. Measured off `ARGO_SPECIMEN=ticketsRoom` at the 1280 window:

| | design (`menu.png`) | #816 |
|---|---|---|
| `Backlog` heading | ~306, just past the sidebar | ~700, onto the ticket column |
| filter / group-by | trailing edge of the 520 block | pushed to the window's trailing edge |
| New ticket · Start · links · search | over the ticket column | behind an unlabelled `»` overflow |

That last row broke the design's own rule — nothing in this room is behind an unlabelled control.
The row rendered in isolation WAS the design, so the components were sound and only the mounting
was wrong.

**The answer: each pane grew a band at its head.** `BacklogHeader` holds the heading, its count,
the filter and `BacklogMenu`; `TicketBand` holds New ticket and the open ticket's verbs. A band
inside a pane is aligned to its column by construction — no width to keep in step with anything,
and nothing to recompute when the window moves. The window row keeps search alone, at the trailing
edge, where the HIG puts a search field and where Mail's is.

**New ticket went to the band on the second render, not the first.** Mounted in the window row it
drew at 440pt — over the LIST, because `.primaryAction` begins where `ShellToolbar`'s items end and
not where the ticket column does. The same fault as #816's in a smaller form: a control placed
relative to a column has to be drawn BY that column.

**Why this rather than a three-column `NavigationSplitView`.** That is what Mail actually is, and it
would take the placement from the platform instead of from us. It also forks the shell's split view
per room, which rebuilds the window on every room switch and drops the deck's per-Session state —
and whether SwiftUI hands a column's own `.toolbar` to that column's section on macOS 26 is
unverified, where Mail is AppKit. The bands need no fork and no spike. `.principal` stays closed for
the reason `ShellToolbar` records.

**What the bands cost, and why they were reversed (#855).** Two chrome bands the approved renders
do not show — 44pt in each pane. The sharper cost was legibility: nothing about a filter mark says
which column it acts on, so a reader met the same family of marks at three heights and read three
unrelated rows rather than one row placed by scope. The placement was legible only to somebody who
already knew the rule.

**So #855 put every control back in the window's one row**, in scope order — the list's two, New
ticket, the ticket's verbs, search at the trailing edge. That is the arrangement #816 set out to
reach, arrived at by giving up the column boundary rather than by claiming it: the boundary was
never the point, one legible row was. `TicketBand` is deleted and `ArgoTicketDetail.bandHeight`
with it; `BacklogHeader` keeps `ArgoBacklogList.bandHeight` for its two lines of words.

**And #1242 reversed that, because the boundary WAS the point for one control.** The ticket's verbs
act on the ticket in the trailing pane, and in a window-wide row their position is measured off the
window's trailing edge while the pane's leading edge is measured off a seam the reader drags. The
prototype measured the gap: the cluster sat **+42 inside the pane** at 1280 with the seam at rest
and **−116** at every floor — over the list, which is the screenshot on the ticket.

**The fourth answer is a header per pane, drawn IN the title strip rather than under it.** That is
the whole difference from #836, whose bands cost 44pt each because they opened below the strip. The
deck climbs past the safe area the way `DeckCanopy` already does (`reach: window.safeAreaInsets.top`),
so the band is spent either way and no pane loses a line. `#836`'s second failure — the same family
of marks at three heights, with no readable scope rule — is answered by leaving almost nothing on
the bands: one mark and a field on the list's, one pill on the ticket's, nothing on the sidebar's.
There is no second control to mistake it for.

**What gives at a narrow window: the list.** Mounted, the bands needed more width than the room had
below about 1050 — the sidebar's 280 and the list's fixed 520 left the ticket pane less than
`TicketBand`, and its trailing verbs met the window's edge. So 520 became where the list RESTS and
its ceiling rather than a floor, and `ArgoBacklogList.minimumWidth` is the remainder derived from
the narrowest window: 960 less the sidebar, less `feedMinimumWidth`, less the two seams between
them. Below 520 the pane narrows, titles truncate at the tail — which `BacklogRow` already does —
and the ticket's prose re-wraps to what it is left. Rendered whole at 960 and at 1280.

The seam term is not decoration: without it the arithmetic comes out exact, the split view takes
the divider from the SIDEBAR instead, and the sidebar draws its labels off its own leading edge.
`TicketsRoomMeasureTests` asserts the three columns fit the narrowest window, and that the list
yields before it reaches the ticket's floor.

**Two consequences beyond the mounting.**

- **New Session left the Tickets room's row.** Mail's window creates one kind of thing and spends one
  compose mark on it. `ShellToolbar.spawn` is optional now and `CockpitRoom.spawnsSessions` decides;
  `⌘N` and the menu bar are untouched. That freed `square.and.pencil` for New ticket, whose `plus`
  existed only to keep the two marks apart — and the pair is asserted together, so putting New
  Session back without re-cutting the mark fails a test rather than shipping two compose marks.
- **Group-by is a row in an `ellipsis` menu**, which is where Mail keeps sort and group beside its
  own funnel. `rectangle.grid.1x2` was invented for an act the platform already houses.

**The ellipsis is drawn by font, not by rung.** `ArgoGlyph` constrains a mark's HEIGHT, and an
ellipsis is three dots whose ink is a fraction of its box: matched by height it drew three discs as
tall as a full glyph (the funnel beside it, until #900 deleted that mark). `BacklogMenu` uses `argoIcon`, the font-based accessor the contract
provides for a bare `Image`. `ProjectRowMenu` draws the same symbol through `ArgoGlyph` and likely
has the same fault — not touched here, since it is not this room's.

**`TicketsToolbarProjection` is `TicketsChromeProjection` now.** Three surfaces read one value — the two
bands and the row — so a name saying "toolbar" would have described one of its callers.


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
  edge are gone, and `ShellSidebar` draws the strip so Sessions and Code keep a way back to Tickets.
  `ToolbarSegment` lost its mark-shaped fit and the two slot measures with it — a `Picker` draws
  its own segments — and `ToolbarSegmentTests`, which asserted only that arithmetic, went too.
- **New Session stays on the bar in the Tickets room.** The study's `.tb-lead` is the traffic lights
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
The chrome it hangs from is `ticketsChrome`, and the two vacancies are `emptyTicketsChrome` and
`unboundTicketsChrome` (renamed with the row's contents in #836).

# #819 — priority groups the backlog roots

## Extracted

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `PriorityHeader` | atom | `ArgoUI/Shell/Tickets/Backlog/` | `band: Band`, `count: Int` | `GroupLabel` | `.pri-head` |

One name, and the design froze it. Nothing else came out: the odd priority a child states is a
`Text` in the slot `BacklogRow` already had, and the banding is arithmetic rather than a view.

## Stayed inline

- **The odd-priority caption.** It is `BacklogRow`'s existing trailing slot with a second thing
  that can fill it, not a second component. `BacklogRow` now picks between the roll-up and the odd
  word in one place, which is the only place either can be drawn.
- **The band itself.** `TicketsRoomProjection.Band` is a value on the projection, not a view.
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
- **The three words are MATCHED, not ranked.** `TicketsReading+NextUp` already matches `high` this
  way. A word Argo has no band for keeps a header of its own, in the order the provider served it,
  rather than being sorted into one of the three — Argo does not own this ladder.
- **The match folds case; the word does not.** A tracker spelling one of its own words `Low` would
  otherwise open a second band beside `low`, headed with the same word, and a child under it would
  be told it disagrees with a header it agrees with. `Band.priority` is still the provider's word
  verbatim — `GroupLabel` is what uppercases the header, and Argo recases nothing.
- **A band's key is not its word.** `Band.id` distinguishes the unread band from one whose word is
  empty. Two bands sharing a `ForEach` key draws one and drops the other, which is a row lost to an
  id rather than to an edge — the same failure `TicketsRoomProjection+Tree` refuses.

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

`ticketsRoom` reproduces `rest.png` and `collapsedTicketsBacklog` reproduces `collapsed.png`, both at a
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
| `TicketPriority` | value | `ArgoEngine/Ticket/` | `init(word:)`, `rung: Int`, `known: [String]` — five cases, `other` carrying no word | — | `priority desc`, the first ranking key |
| `Ticket.updatedAt` | value | `ArgoEngine/Ticket/` | `Date?` | — | `age`, the third key |
| `TicketsReading.ranked(_:)` | value | `ArgoUI/Shell/Tickets/` | `[Ticket] -> [Ticket]` | `Rank` (private) | the ranking itself |
| `NextUp.Reason.oldestUntouched` | value | `ArgoUI/Shell/Tickets/` | — | `NextUpChip`, unchanged | the design's fourth chip |

`NextUpChip` needed no edit for the fourth reason: it renders `reason.words` and takes its ink from
`isUrgent`, so a new case is a new word and nothing else. That is the one place this ticket found the
#817 build had already paid for the extension.

## The three decisions the ticket left open

- **The priority ladder lives in the ENGINE.** `TicketsRoomProjection+Bands` held
  `bandOrder = ["high", "medium", "low"]` in `ArgoUI` under the comment *"Matched, never ranked"*.
  Both halves are now true of one list: `TicketPriority.known` is the words, and `rung` is the
  order — bands still MATCH against it and the hero RANKS by it. Two copies of those three words is
  how a band comes to sit above a ticket the hero ranked below it. Licensed by ADR-0016: *"provider
  priority is a sort Argo reflects"*. The words stay the provider's and stay verbatim on the
  `Ticket` — nothing recases one.
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
- **`PRD sequence` is TWO keys, and both are the provider's own author order.** Which chart holds
  the ticket — the order the provider served its charts in, which is the order the `CHARTS` group
  draws — and then where in that chart's `children`. The first cut compared child indices across
  unrelated charts, so position 0 of one PRD beat position 5 of another on nothing anybody had
  stated; review caught it. Nobody sequenced two PRDs against each other, but the provider did serve
  one before the other, and that is a fact rather than an invention.
- **A cold-start planner, never a best-move recommender.** The pool is
  `open · leaf · todo · unblocked · session-less`. `todo` and `session-less` are ONE clause —
  `TicketState.open` is open and unclaimed — and blocked items are shown in the backlog but never
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
- **The inputs named `TicketsReading.edgesRead` and `TicketsReading.priorities`** — #820 moved every
  per-ticket fact onto the `Ticket` itself, so both reads are now `pick.blockage` and
  `pick.priority`. The suppression they describe is unchanged.

Two silences worth naming, because both could have been faked:

- **An unknown priority word sits on ONE rung below `low`, and unread sits below THAT.** Two words
  nothing has ordered are not ordered against each other; absent is not a rung (ADR-0014).
  `TicketPriority.other` therefore carries NO word: the first cut gave it the provider's spelling
  as a payload, which made `.other("P0") != .other("urgent-ish")` under synthesised `Equatable`
  while the comment beside it claimed they compared equal, and nothing read the payload anyway.
- **A ticket with no timestamp read sorts LAST, not first.** Treating a silence as ancient would put
  the least-known ticket at the head of a list that sorts by neglect.

## What review changed

Three, all caught before the PR:

- **`"high"` was written twice.** `TicketsReading+NextUp` kept a `urgentPriority = "high"` constant for
  the chip while the ranking sorted by `TicketPriority.high`, so the chip and the pick's own place
  in the list could have disagreed — the exact failure moving `bandOrder` onto the ladder was meant
  to prevent. The chip now reads `pick.priorityRung == .high`.
- **The cross-chart sequence comparison, and the `other` payload** — both above.
- **The pool fixture sat in `Sources/`.** `candidate` and `chart` have no caller the app ships, so
  `TicketsFixture+Ranking.swift` moved to `Tests/ArgoUITests/` — unlike the rest of `TicketsFixture`,
  which the previews draw from.

## What the ticket asked for and this build does NOT do

- **AC 2's second half, in part.** The ranking is reproducible by hand from priority (banded in the
  backlog, stated in the fact strip) and from PRD sequence (the chart order in `CHARTS`, the child
  order under a parent). **Age is not visible anywhere** — the design draws no timestamp, and the
  `oldest untouched` chip surfaces it only in the fallback case. So two leaves tied on rung and
  sequence swap places for a reason nothing on screen states. Rendering an age is a design change
  this ticket has no approved measurement for.
- **AC 4's `spec ready`.** Never inferred, which is the clause's force, but also never rendered:
  the approved design draws four chips and this is not one, and `chipLimit` is 2.
  `cockpit-surface-matrix.md` keeps the words as an open design question rather than deleting them
  to match the code.

## Which specimen reproduces which render

None new. The hero's four tiers and its one-chip state were all shot at #817, and the ranking moves
no pixel in them: the fixture's pool has exactly one takeable unclaimed leaf (#273 — the other three
clear leaves are claimed), so the pick is the same ticket the ranking or the provider's order would
both have named. The `oldest untouched` chip has no design render of its own and is drawn in
`NextUpChip`'s own preview beside the other three.

---

# The trailing region (#896 · #897)

Two tickets, one build, because the question neither could answer alone was *what shows when a row
is both blocked and stale*. The rule is in the design under **the trailing region**; this records
what was considered and refused.

## Extracted

| Name | Kind | Built from | Note |
|---|---|---|---|
| `BlockageMark` | atom | `ArgoGlyph` + `Text` in a `Capsule().strokeBorder` | the glyph then the count, in the Route's own waiting/dead-end inks. **Amended #939**: it was the count alone |
| `TicketAge` | — | pure `Date` arithmetic, no view | one rounded unit; not `AgePhrase`, which words the same distance as prose for a sentence to carry |

`Drawn.caption(asOf:)` is the one place the three-way precedence is CODED; the design's table
above is where it is decided. Two statements of one rule, deliberately — the design is the SSOT and
the function is the only implementation of it, so a row that drew a different order would disagree
with a document rather than with a second copy of itself.
`TicketsRoomProjection.blockage(of:)` is the nil-returning seam that withholds the mark —
`TicketState.filing(beside:)`'s shape (#893), for the same reason: a view handed a value it must
know not to draw is a view that will eventually draw it.

`BlockageMark.symbol` is the second seam, added by #939: the row and the sidebar's `Blocked` view
each name the glyph in their own code, and `TicketsBacklogMarkTests` asserts the two agree. Not a
comment, because a comment does not fail when somebody moves one of them — the same reason the
mark's presence is CHECKED against `TicketsView.blocked.admits` rather than asserted in prose.
The glyph itself is `ArgoSymbol.blockedView`, so the two surfaces follow from one edit; #939
changed it from `triangle`, a shape with no meaning attached, to `nosign`.

Candidates rendered at true size before that choice: `triangle` and `octagon` are shapes and name
nothing; `hand.raised` goes to mush at the 10pt rung; `exclamationmark.octagon` and `xmark.octagon`
read as an error, which is the emergency the Route's ink is spent avoiding; `minus.circle` is
already `ArgoSymbol.removeProject` and `exclamationmark.triangle` already `refused`, so both would
have made one glyph mean two things; `circle.slash` is `nosign` with a thinner slash that fades
first. `nosign` is also the reference the user gave — Linear's blocking-relation mark.

## What was refused

- **A third slot for the date, outboard of the caption.** #897 floated it ("the trailing region may
  need to hold two marks"), and its own AC settles it the other way: *the precedence between the
  date, the parent roll-up and the priority word* presupposes one slot and an order. A permanent
  date column at the trailing edge also costs the width the label chips are already rationed by, at
  a pane the reader can drag down to 440.
- **`Aug 12` past a horizon.** #897's prose suggests it; its AC asks only for *relative and short*.
  A stamp that changes register halfway down the column loses the rhythm that made it scannable,
  and it drags a calendar and a locale into a value the projection can otherwise compute exactly.
- **A filled mark, Linear's red circle.** The shape is #896's stated reference and the count is
  taken from it, but the fill and the hue are not: red is `state.failure`, which this room has
  already spent on the ticket that can *never* unblock. Seventeen rows of it would say every one of
  them is a dead end. Hollow, on `state.idle`, is the same information without the alarm.
- **A `blocked` label chip.** The fixture carries one and a provider can serve one, but a synthesised
  chip would sit in the labels' own region claiming to be the provider's word.

## Which specimen reproduces which state

| State | Where |
|---|---|
| clear and dated | `ticketsRoom`, `blockedTicketsView` — #609 at `1d` |
| blocked and dated | the same shots — #336 at `2h` behind one blocker |
| **both blocked and stale** | the same shots — #272, `2` and `1w` |
| neither | the same shots — #763, no mark and no caption |
| roll-up over an age | the same shots — #607 draws `2/9`, never its own `3d` |
| stranded | `strandedTicketsBacklog`, added here |

## The fixture gap this build found

**No fixture ticket carried `updatedAt` at all.** `TicketsFixture.items` set every other fact and
never a date, so #897's absence was invisible to every render in the repo — and `isOldest` returned
false for all twelve, which meant the hero's `oldest untouched` fallback had no room render either.
The dates are counted back from a fixed `TicketsFixture.asOf` rather than from `.now`, and the
specimens pin `backlogNow` to it: an age measured against the wall clock makes a render that never
matches itself twice.

**No fixture reached `stranded`.** Every blocker in the backlog is open or resolved, so the one
state `state.failure` is spent on had never been drawn. `TicketsFixture.stranded` is its own reading
for that reason, on the pattern `unjoinedClaims` set at #894.

## Where the design and the code disagree

- **#160 and #185 carry `blockedBy` edges the design says they do not have.** The sidebar section
  reads: *"Being held up is not the same as having an edge: #160 and #185 are decisions awaiting an
  answer, with nothing in `blockedBy` to show for it."* `TicketsFixture.items` gives both
  `blockedBy: [272]`, so both now draw the blocked glyph and a count of `1`. The disagreement is
  **pre-existing** — the fixture has served those edges since #812, and it is what makes
  `Unblocked + Blocked` sum to `All open` in every render — but nothing on screen showed it until a
  row started drawing the count. Reconciling it moves two rows between two sidebar views and
  re-shoots the room, which is #812's decision to revisit, not this ticket's. Recorded rather than
  fixed.
- **There is one appearance.** #896 asks for a mark "legible in both appearances"; the contract
  defines a single theme, `ArgoTheme.graphite` at `.dark`, and no light palette exists to render.
  The mark spends only `state.idle` and `state.failure` and states no colour of its own, so it will
  inherit whatever a second appearance defines — but the criterion cannot be closed by a render
  until there is one.
