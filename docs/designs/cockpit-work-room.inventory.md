# The Work room — inventory

What `design-to-code` extracted while building [`cockpit-work-room.md`](cockpit-work-room.md), and
what it deliberately left inline. One row per component the assembled screen forced out.

**Scope: #812, #815 and #818** — the views sidebar, the flat backlog list and the ticket (#812),
then the ticket's fact strip and its three sections (#815), then the room's two vacancy pages
(#818). The design freezes 31 names across the whole room; the sixteen below are the ones these
tickets built. The rest (the hero, the toolbar, the tree, the Route) belong to their own tickets
and are absent rather than stubbed.

## Extracted

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `WorkRoom` | organism | `ArgoUI/Shell/Work/` | `room: Room`, `cockpitRoom: Binding<CockpitRoom>`, `ticket: Binding<Int?>`, `view: Binding<WorkView>` | `WorkSidebar`, `BacklogList`, `TicketDetail`, `DeckSeparator` | `WorkRoom` |
| `WorkSidebar` | organism | `ArgoUI/Shell/Work/Sidebar/` | `room: Room`, `cockpitRoom: Binding<CockpitRoom>`, `view: Binding<WorkView>` | `RoomStrip`, `GroupLabel`, `ViewRow`, `ProviderFoot` | `WorkSidebar` |
| `RoomStrip` | atom | `ArgoUI/Shell/Work/Sidebar/` | `selection: Binding<CockpitRoom>` | stock `Picker(.segmented)` | `RoomStrip` |
| `ViewRow` | molecule | `ArgoUI/Shell/Work/Sidebar/` | `symbol: String`, `name: String`, `count: Int` | `ArgoGlyph` | `ViewRow` |
| `ProviderFoot` | atom | `ArgoUI/Shell/Work/Sidebar/` | `provider: WorkProvider` | `SessionStateIndicator` | `ProviderFoot` |
| `BacklogList` | organism | `ArgoUI/Shell/Work/Backlog/` | `rows: [Row]`, `selection: Binding<Int?>` | `BacklogRow` | `BacklogList` |
| `BacklogRow` | molecule | `ArgoUI/Shell/Work/Backlog/` | `row: Row` | `DeliveryDot` | `BacklogRow` |
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

## Not reproduced from `rest.png`

The render carries the whole room. This ticket's specimen reproduces its sidebar, its backlog list
and its ticket pane. The priority headers, the twists, the Next-up hero and the room's toolbar are
absent because they are other tickets — not because they drifted.

## The two vacancies (#818)

`unboundWorkRoom` and `emptyWorkBacklog` are the renders, and both reproduce their design PNG's own
line breaks at a 1280×800 window. What is absent from `empty.png` is the Next-up hero's
backlog-clear tier and the toolbar's surviving `New ticket` — both other tickets.

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
