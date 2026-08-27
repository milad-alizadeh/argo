# The Work room — inventory

What `design-to-code` extracted while building [`cockpit-work-room.md`](cockpit-work-room.md), and
what it deliberately left inline. One row per component the assembled screen forced out.

**Scope: #812 and #816**, one section each and appended per ticket. The design freezes 31 names
across the whole room; #812's eleven and #816's eight are the ones built. The rest (the hero, the
tree, the fact strip, the Delivery chips, the link lists, the vacancy panel, the Route) belong to
their own tickets and are absent rather than stubbed.

# #812 — the views sidebar, the flat backlog and the ticket

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
| `TicketDetail` | organism | `ArgoUI/Shell/Work/Detail/` | `ticket: Ticket?` | `TicketHead` | `TicketDetail` |
| `TicketHead` | molecule | `ArgoUI/Shell/Work/Detail/` | `ticket: Ticket` | `StatusPair` | `TicketHead` |
| `StatusPair` | atom | `ArgoUI/Shell/Work/Detail/` | `word: String`, `bucket: WorkItemState` (4 states) | — | `StatusPair` |

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

## The column-placement question, settled

The ticket asked for this first, and the answer is neither of the two it offered.

**Every item is `.primaryAction`, and the list block claims `ArgoBacklogList.width` 520.** That
region is the one the detail pane draws — `.navigation` is the window's leading region, where the
scope vessel already sits over the sidebar. With the list block taking the backlog's own width at
that region's leading edge, it lands over the list and everything after it lands over the ticket
column, at any window size, because 520 does not move with the window.

The preferred route — a genuine three-column `NavigationSplitView` — is closed: the shell's split
view is unconditional (#812 froze "a room fills the shell's slots rather than replacing them"), so
forking it per room rebuilds the whole window on every room switch and drops the deck's per-Session
state, both seam drags and the sidebar's width with it. `.principal` is closed for the reason
`ShellToolbar` already records. The fallback — a sticky header inside the list pane — would give
the room a second chrome band no render shows, and would still leave New ticket over the list
rather than over the ticket it opens.

## Where the design and the code disagree

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

## Not reproduced from `menu.png`

`ModeMenu` is a native `Menu`. AppKit owns the open popover, so it cannot be put on screen by a
specimen and the open state has no headless render — `menu.png` stays the study's drawing of it.
The row it hangs from is `workToolbar`, and the two vacancies are `emptyWorkToolbar` and
`unboundWorkToolbar`.
