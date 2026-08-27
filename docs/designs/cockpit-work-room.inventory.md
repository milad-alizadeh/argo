# The Work room — inventory

What `design-to-code` extracted while building [`cockpit-work-room.md`](cockpit-work-room.md), and
what it deliberately left inline. One row per component the assembled screen forced out.

**Scope: #812, #815 and #816** — the views sidebar, the flat backlog list and the ticket (#812),
then the ticket's fact strip and its three sections (#815), then the room's toolbar row (#816,
its own section at the foot). The design freezes 31 names across the whole room; the twenty-three
below are the ones these tickets built. The rest (the hero, the tree, the vacancy panel, the
Route) belong to their own tickets and are absent rather than stubbed.

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
- **The subtitle drops `by priority` until #814.** The middle term names the grouping in force and
  the list is still flat (#812). A heading reading `by priority` over an ungrouped list is the
  exact lie the second line exists to prevent.
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
