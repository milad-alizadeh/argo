<!-- status: approved
     approved-at: c0e24739
     prototype: worktree-prototype-609-work-room -->

# The Work room

The approved design for the **Work room** (#609) — the views sidebar, the backlog list, the
ticket detail, the Next-up hero, the room's toolbar, its empty and degraded states, and the
Route's re-skin. Before this, every design in `docs/designs/` was a Sessions surface and
`InstrumentDeckShell` drew `Color.clear` for `.work`, so a session sent at #272 would have
invented the pixels.

**The renders in [`work-room/`](work-room/) are the spec.** [`cockpit-work-room.html`](cockpit-work-room.html)
is the same room, explorable: every state is a URL (`?state=<key>`), `?render=1` strips the
harness chrome. The measurements below are the numbers a ticket must carry.

Eleven states: `rest`, `deep` (two Deliveries, nine children, six blockers), `collapsed` (a
parent folded), `edgeless` (a provider with no dependency edges), `one-chip`, the three
empty-pool tiers `pool-blocked` · `pool-running` · `empty`, `unbound` (no provider bound),
`menu` (the Start verb's Mode menu), and `route`.

## What won, and what lost

The study explored five rooms. **The sidebar is not the backlog** is the decision that separates
the winner from the rest, and it was settled by arithmetic rather than taste.

A 320pt rail spends its width on a twist, a dot, an id, a gap either side of each, and a
trailing roll-up. That leaves the title **about 190pt at a root and 158 at depth two** — roughly
29 and 24 characters of SF Pro at `body`. Real ticket titles here run 40 to 65. Nine of twelve
truncated, several losing the half that says what the ticket is (`The Route — a progress-axis …`),
while the deck beside them held four lines of prose in a pane that could take sixty.

**The winner: a views sidebar, and the backlog in the deck.** The sidebar keeps existing — the
shell's split view is unconditional, and the room strip moves into its head (#805) — but it
holds **views**, whose names are short because a view name is *written* rather than inherited
from a tracker. The backlog becomes the deck's leading pane at 520, where a title reads whole at
depth three, and the ticket opens beside it.

The four rejected rooms, and what each gave up:

- **Roster twin** — the Sessions room's geometry with tickets in it. Familiar on first open, and
  the source of the truncation above. It was approved first and then measured; the measurement won.
- **Brow** — the hero as a band over the deck, a flat rail, facts in a fixed strip. Same rail
  arithmetic, and it lost the second pane as well.
- **Ledger** — no rail, a wide table filling the deck, a 420pt inspector on select. It showed
  more per row than any other room and gave up the sidebar the rest of the app is built on.
- **Views + full deck** — the winner's sidebar, but the backlog filling the whole deck and the
  ticket replacing it. Titles read whole and the ticket got the full 720 measure *and* a 240pt
  facts sidebar; the cost is that the backlog vanishes while you read a ticket. A close second,
  and the one to revisit if the three-pane room ever feels cramped.

**The nesting came from the Ledger and survived into the winner.** A tree in a wide column is
where parent and child first read at a glance.

## The sidebar — views, not tickets

Two groups of short names, a rule between them, the Next-up hero below, and the bound provider
at the foot.

- **Backlog** — `All open`, `Unblocked`, `In progress`, `Blocked`, each with its count.
  **`Unblocked` and `Blocked` partition the open set**, so the two always sum to `All open`.
  Being held up is not the same as having an edge: #160 and #185 are decisions awaiting an
  answer, with nothing in `blockedBy` to show for it. The first renders counted on edges
  alone, so those two were counted twice and the rail read 6 + 8 over 12 — corrected in
  `viewCount` and re-shot (#812). `In progress` cuts across both and is not part of the split.
- **Charts** — one row per PRD-shaped parent (`#607 Wayfinder`, `#334 The Route`), the entry
  point to the Route.
- **The room strip** sits at the top of the sidebar's scroll, under the titlebar rather than in
  it. Xcode's navigator selector, and #805's question answered: a control belongs over the thing
  it changes, and the room changes both panes but *starts* in this one. It is drawn under the
  titlebar, never inside it — the titlebar is macOS's, and a control that fights it is misplaced.
- **The connection chip lives at the sidebar's foot**, not the toolbar. It is a property of the
  bound provider, and this is where the provider's views are. It also had nowhere left to sit
  once search took the trailing edge — see the toolbar below.

**The sidebar takes `ArgoLayout.sidebarMinimumWidth` 280, not the 320 ideal.** At 320 the list
drops to 480 and three of twelve titles truncate again. This is the one shell change the design
asks for: `CockpitView` passes a room-dependent ideal instead of one constant. No token moves.

## The backlog list

`twist · dot · id · title`, plus one trailing fact. Lean by #272's rule — no PR chips; the
delivery signal is the dot alone.

**It is a disclosure tree**, the way Mail draws its mailboxes: a twist at the row's leading edge,
children indented one step under their parent, the trailing fact right-aligned. The twist is its
own hit target, so opening a parent does not change what the ticket pane shows. **Everything
opens open** — a tree that opens shut hides the thing it was added for.

### The one conflict, and how it resolves

Nesting and priority grouping cannot both be the list's structure: a child's priority is its
own, and one parent's children scatter across all three bands.

**Priority groups the roots. A child hangs under its parent whatever its own priority is.** The
`HIGH` / `MEDIUM` / `LOW` headers are therefore headers over *roots*, and a child sitting under
`HIGH` may be a `medium`. Where that happens, **the row says so** — the child's own priority is
set in the trailing slot, in the machine caption, quietly. The header never speaks for a row
that disagrees with it.

**A header counts the rows it draws.** Folding a parent lowers it. A subtree count would stand
over one visible row and read as a lie; the parent's own `n/m` roll-up already says how many
children it has.

**The indent caps at two steps.** Level three shares level two's inset. At 520 this is comfort
rather than necessity — it is the rule that keeps a five-deep chart legible, and a chart that
deep is read on the Route (#334), not here.

### The delivery signal, on the dot alone

| dot | means |
|---|---|
| hollow ring, `text.disabled` | no Delivery |
| `state.idle` | draft |
| `interaction.accent` | open |
| `state.failure` | checks failing |
| `state.running` | merged |

Five states on one 6pt mark, which is `ArgoLayout.statusDotSize` — the same mark the roster uses
for a Session, read here for a Delivery.

## The toolbar — Mail's placement, transposed

Mail puts **every** control in the window's one toolbar row, and places each by what it acts on.
The Work room does the same, in the same order:

| position | control | scope |
|---|---|---|
| over the list | `Backlog` and, under it, `All open · by priority · 12 tickets` | says what you are looking at, and how many |
| trailing the list block | filter, group-by | list-scoped, so they sit over the list |
| leading the ticket column | **New ticket** | the compose call-to-action, its own vessel, opening the next column |
| next | `⚡ Start ⌄`, open-on-host, copy link | the ticket's own verbs |
| trailing edge | search | a real field at 210, not an icon that becomes one |

**A title without its count can lie about what you are filtered to**, which is why the heading is
two lines and Mail's is too (`Searching / Inbox — …, 11 results`).

**The middle term names the grouping in force, so it is absent until there is one.** The list is
still flat (#812), and a subtitle reading `by priority` over an ungrouped list is the exact lie the
second line exists to prevent; #814 adds the term with the grouping it describes. Until then the
line reads `All open · 12 tickets`.

### The column question, settled (#816)

The room's three columns are real, but macOS gives per-column toolbar regions only to a genuine
three-column `NavigationSplitView`, and the shell's split view is unconditional — a room fills its
slots rather than replacing them (#812). Forking it per room would rebuild the whole window on
every room switch and drop the deck's per-Session state, both seam drags and the sidebar's width.
`.principal` is closed for the reason `ShellToolbar` already records.

**So the row claims the boundary directly.** Every item is `.primaryAction`, which is the region
the detail pane draws; `.navigation` is the window's leading region, where the scope vessel sits
over the sidebar. The list block then takes `ArgoBacklogList.width` 520 at that region's leading
edge, so it lands over the list and everything after it lands over the ticket column, at any window
size — because 520 does not move with the window.

**Search sits over the ticket but searches the list.** That is Mail's own split, and for the
same reason: the toolbar is one row, not three.

### `Start` is a split control, not an ellipsis

The study first drew an unlabelled `…`. **An overflow nobody can name is an overflow nobody
opens**, so it is gone. In its place `Start` is a split control: the button starts a Session,
the chevron opens the **Mode** it starts in — `Read Only · Plan · Code · Auto`, Argo's own
ladder, each rung named by the boundary it will not cross unasked. See `menu.png`.

**The rungs' boundaries are `SessionMode.boundary`'s words** — `no writes`, `no writes, proposes`,
`the Workspace`, `no boundary` — not the longer sentences `menu.png` draws. The composer's own Mode
control already says these four boundaries (#608, ADR-0025), and one fact said two ways is one of
them waiting to go stale. `ModeMenu` is a native `Menu` with a `Picker`, as the names table below
specifies, so a row is one line of text and the study's two-column layout is not reachable through
it — the em dash carries the same pair.

The two link verbs that would otherwise have hidden in that ellipsis — open on the code host,
copy link — are icons beside it, past a hairline. Nothing in this room is behind an unlabelled
control.

### Liquid Glass, one material, every vessel

`ArgoFloatingGlass` is `glassEffect(.regular.tint(surface.glassTint))` plus `argoShadow(.vessel)`,
and **`ArgoElevation.vessel` is zero on all three axes** — the specular rim *is* the depth cue.

So every bounded vessel in this room wears the same material and **no border and no drop
shadow**: the scope capsule, the room strip, all three icon capsules, and the search field. A
hairline on a glass vessel stacks a second edge on the one the material already draws.

The glass budget came out even. The titlebar used to spend two vessels (scope capsule, rooms
capsule); it still spends two — the rooms capsule left for the sidebar, and the icon capsules
and search field replaced it.

## The Next-up hero

**A card at the foot of the sidebar's scroll, below the views.** It is inset from the sidebar's
edges by `ArgoSpacing.base`, sits on `surface.raised` and carries an `edge.subtle` border at
`ArgoRadius.control` — three things a view row has none of, which is what stops it reading as
another view.

**The hero was never the width problem.** It states *one* ticket, so its title has the sidebar's
whole width and three lines to wrap into. It reads better at 280 than it did in the 320 rail,
because in the rail it was competing with twelve other titles.

**At most two chips, each earned, and never a score** (#273). The order is `high priority` →
`unblocked` → `next in <PRD>`, with `oldest untouched` as the honest fallback. `high priority`
takes `state.attention` ink; the rest are neutral. With one chip earned the card carries one —
see `one-chip.png`.

**An empty pool degrades in tiers, each with its own sentence.** The card keeps its `NEXT UP`
label and replaces the ticket with the reason: nothing unblocked, all in progress, or backlog
clear. See `pool-blocked.png`, `pool-running.png`, `empty.png`.

**With no dependency edges the `unblocked` chip is suppressed, never asserted** (`edgeless.png`).

## The ticket detail

One scrolling column, at the deck's trailing pane. **There is no 240pt facts sidebar** — at the
1280 window the ticket pane is 480 and a second column inside it would leave neither readable.
That is what this room trades away for showing the list and the ticket at once.

**The facts become a strip under the title**: priority, type, bucket, then labels, closed by a
hairline. Deliveries, Children and Blocked by are sections in the body below, in that order.

**The main column takes the feed's measure** — `ArgoFeedRow.column`, capped then centred, the
same rule `argoFeedMeasure()` already applies. At 1280 the pane is far narrower than the cap and
nothing is centred; past it the deck grows and the line length does not.

**The head is title-first**: id in the machine caption, title on `sessionTitle`, then the status
pair. No scope badge, no produced-by field (#272).

**The provider's word and Argo's bucket, without a contradiction.** The word is set verbatim in
`control`; the bucket follows it behind a 10pt hairline divider, in lowercase machine caption on
`text.disabled`. The two read as a label and its filing, not as two competing claims.

**Deliveries are chips, not a list.** Each is a bordered object on `surface.raised` carrying its
number, its branch, its diff and its checks reading. At 480 a chip sets on one line, so two
Deliveries are two stacked chips rather than a wrapped mess (`deep.png`).

**`blockedBy` at one and at six is the same shape** — a list of `dot · id · title`. The count
lives in the section heading (`Blocked by · 6`). **With no edges the section is absent, not
empty**: a provider that exposes no dependency information has not told us there are no blockers.

**A parent adds a Children section to the same view**, listing its open children with their
verbatim status words in a trailing column. No Implement action anywhere on a parent — work
happens at leaves.

## The room's own states

**No provider bound: the room hides whole** (#272). No sidebar views, no list, no ticket — one
centred panel saying nothing has been read yet, and a Connect action. The connection chip goes
quiet with it, and **the toolbar empties**: there is nothing to create into.

**An empty backlog is a different page.** The provider answered, and the answer was nothing. The
sidebar and its views stay (all reading zero), the hero shows the backlog-clear tier, and the
deck says who answered. Conflating the two would tell a reader their backlog is empty when in
fact nobody asked.

**The empty backlog keeps New ticket.** It is the moment you most want it. The list's filter and
group-by go, and so does search — there is no list to narrow and nothing to search.

## The Route, re-skinned

**#334's geometry is unchanged and is not re-decided here.** The progress axis, the NOW line, the
remaining-depth column rule, the edge rule and the fog are its own. This design supplies only
colour and material:

- The **NOW line is `interaction.accent`** — Ion Blue as current position. #334's gold clause is
  superseded, and `--eclipse-gold` never existed in any contract.
- **Waiting is `state.idle`**, a quiet neutral, so a parent where everything is still blocked
  does not look like an emergency on day one.
- **Red is `state.failure` and is spent only on a ticket that can never unblock** — the dead-end
  dependent, whose edge is drawn dashed in the same ink.
- Closed work behind the line is `text.disabled` and draws no edges.
- The canvas is an opaque Work-room surface on `surface.base`. It is not glass and not a card.
- The Route replaces both deck panes and carries its own head, so the room's toolbar empties for
  it too.

`route.png` is shot at a 1600 window rather than 1280, because #334's canvas **widens when the
work needs room** rather than compressing to fit.

The Route's own component names stay #334's to freeze. This design does not name them.

## Measurements

Surface sheets, beside the surface, per `rules/design-system.md` — a measure is not a token.

### `ArgoWorkSidebar` — `ArgoUI/Shell/Work/Sidebar/`

| Measurement | Value | Reason |
|---|---|---|
| Sidebar width | `ArgoLayout.sidebarMinimumWidth` **280** as the room's *ideal* | at 320 the list drops to 480 and three of twelve titles truncate; the one shell change this design asks for |
| `viewRowHeight` | **26**, a FLOOR not a frame | macOS scales sidebar row height with the reader's own setting, and a frame would refuse it — the same reason `rosterFootMinimumHeight` is a floor |
| `glyphWidth` | **14** | every view name starts on one vertical |
| `gutter` | `ArgoSpacing.comfortable` 12 | the row's leading inset |
| `heroInset` | `ArgoSpacing.base` 8 | the hero card off the sidebar's edges |
| `heroPadding` | `ArgoSpacing.comfortable` 12 | inside it |
| Hero radius | `ArgoRadius.control` 6 | a card, not a popover |
| `footPadding` | `ArgoSpacing.base` 8 / `ArgoSpacing.comfortable` 12 | around the provider chip, above a hairline |

### `ArgoBacklogList` — `ArgoUI/Shell/Work/Backlog/`

| Measurement | Value | Reason |
|---|---|---|
| List width | **520** | the smallest width at which all twelve real titles read whole at depth three; at 480 three of them clip |
| `rowHeight` | **30**, a FLOOR not a frame | grew from 28 when the title snapped up to `body` 13 |
| `gutter` | `ArgoSpacing.comfortable` 12 | the row's leading inset, before the twist |
| `twistWidth` | **12** | a leaf keeps the slot, so every dot lands on one vertical |
| `indentStep` | `ArgoSpacing.loose` 16 | one level; a child's dot lands under its parent's id |
| `indentDepthCap` | **2** | level three shares level two's inset |
| `gap` | `ArgoSpacing.base` 8 | between dot, id, title and the trailing fact |

### `ArgoWorkToolbar` — `ArgoUI/Shell/Work/Toolbar/`

| Measurement | Value | Reason |
|---|---|---|
| Row height | **46** | the shell's existing titlebar strip, unchanged — not restated in code, where `ArgoToolbarVessel` already names the band |
| `listBlockWidth` | `ArgoBacklogList.width` **520** | what places every control over its own column: the block claims the backlog's own width at the leading edge of the region the detail pane draws, and 520 does not move with the window — see **the column question**, settled below |
| `iconButton` | **26 × 24** inside a 3pt vessel inset | the capsule's own padding is the vessel's, not the button's |
| `iconSize` | `ArgoIconSize.control` **13** | 14 was the SVG box the study drew into; `control` is the rung the contract gives "a control's own mark", and a fourth rung is a token change this room has no standing to make |
| `searchWidth` | **210** | wide enough for `Search the backlog`; at 260 the trailing edge clipped at 1280 |
| Vessel shape | `Capsule()` | a capsule is a shape, not a radius — no `ArgoRadius` rung applies |
| Vessel material | glass, **no border, no shadow** | `ArgoElevation.vessel` is zero; the specular rim is the cue |
| Menu offset | **40** below the row | `ArgoRadius.popover` 12, `ArgoElevation.popover` — the one rung here that genuinely floats. **Not implemented, and not implementable**: `ModeMenu` is the stock `Menu` the frozen-names table specifies, and AppKit positions and draws its own popover. The number describes the study's drawing of it |

### `ArgoTicketDetail` — `ArgoUI/Shell/Work/Detail/`

| Measurement | Value | Reason |
|---|---|---|
| Reading measure | `ArgoFeedRow.column` 720 | reused, not redeclared: the feed already settled what a line of Argo's prose runs to |
| `inset` | `ArgoSpacing.section` 24 | the column off the deck's edges |
| `factStripGap` | `ArgoSpacing.section` 24 column / `ArgoSpacing.base` 8 row | between fact pairs; the pair's own key-to-value gap is `snug` 6 |
| `chipPaddingX` / `chipPaddingY` | `ArgoSpacing.comfortable` 12 / `ArgoSpacing.snug` 6 | inside a Delivery chip |
| Status divider | 10 tall, `edge.subtle` | between the provider's word and Argo's bucket |
| Body line height | `ArgoFeedRow.lineHeight` 20 | reused |

## Component names — frozen

Renaming one of these later is a migration. Each names the stock SwiftUI control it stands in
for; anything not listed is stock used directly.

| name | tier | stands in for | notes |
|---|---|---|---|
| `WorkRoom` | organism | the shell's existing `NavigationSplitView` slots | supplies sidebar and detail; it does not own a split of its own |
| `WorkSidebar` | organism | `List(selection:)` with two `Section`s | views, not tickets |
| `RoomStrip` | atom | `Picker(.segmented)` | `Sessions \| Work \| Code`, at the head of EVERY room's sidebar (#805). #816 deleted the titlebar's `RoomsVessel`, so this is the window's only rooms picker and it lives in `Shell/Sidebar/` rather than under `Work/` |
| `ViewRow` | molecule | an `HStack` in a `List` row | glyph · name · count, at `viewRowHeight` as a floor |
| `ProviderFoot` | atom | an `HStack` above a `Divider` | the bound provider, at the sidebar's foot |
| `NextUpCard` | molecule | a `VStack` on `surface.raised` | the hero; carries the ticket or an empty-tier sentence |
| `NextUpChip` | atom | `Text` in a rounded rect | at most two, each earned |
| `BacklogList` | organism | `List(selection:)` with one `Section` per priority | the deck's leading pane |
| `BacklogOutline` | molecule | `OutlineGroup(children:)` inside that `List` | the tree; children come from the child edge, not a nested array literal |
| `BacklogRow` | molecule | an `HStack` in a `List` row | `twist · dot · id · title · trailing` |
| `BacklogTwist` | atom | `DisclosureGroup`'s chevron, drawn | drawn rather than inherited so it can carry its own hit target |
| `DeliveryDot` | atom | `Circle` at `ArgoLayout.statusDotSize` | the five-state table above |
| `PriorityHeader` | atom | a `Section` header | label on `sectionLabel`, drawn count on `machineCaption` |
| `WorkToolbar` | organism | `.toolbar { ToolbarItemGroup }` | the whole row; its placement per control is the table above |
| `BacklogToolbarLabel` | molecule | a `VStack` of two `Text` | the heading and its count |
| `ToolbarVessel` | atom | `GlassEffectContainer` + `Capsule` | groups icon buttons; no border, no shadow |
| `ToolbarIcon` | atom | `Button(.plain)` with a `Label(.iconOnly)` | one glyph at `iconSize` |
| `NewTicketButton` | atom | `ToolbarIcon` in its own `ToolbarVessel` | the call-to-action; survives the empty backlog |
| `StartControl` | molecule | `Button` + `Menu` in one vessel | the split verb; the chevron opens `ModeMenu` |
| `ModeMenu` | molecule | `Menu` with a `Picker` | the four Mode rungs, each with the boundary it refuses |
| `BacklogSearchField` | atom | `.searchable` field | searches the list; sits at the trailing edge |
| `TicketDetail` | organism | a `ScrollView` | one column; no inner split |
| `TicketHead` | molecule | a `VStack` of `Text` | id, title, status pair |
| `StatusPair` | atom | `HStack` + `Divider` | the provider's word and Argo's bucket |
| `TicketFactStrip` | molecule | a wrapping `HStack` above a `Divider` | priority · type · bucket · labels |
| `DeliveryChip` | molecule | `Button(.plain)` opening a URL | deep-links; two on one ticket are two of these |
| `LabelChip` | atom | `Text` in a rounded rect | a provider label, verbatim |
| `TicketLinkList` | molecule | a `VStack` of `Button(.plain)` | ONE component; `blockedBy` and Children are two callers with different trailing facts |
| `WorkRoomVacancy` | molecule | `ContentUnavailableView` | both room-level states — unbound, and answered-with-nothing |
| `RoomPresentation` | atom | `Picker(.segmented)` | `Present as: Tree \| Map`, map-scoped not room-scoped (#334) |

## Token reconciliation

Every value in the study snapped to an existing role. The prototype's jitter (10 vs 10.5 vs 11,
12 vs 12.5) collapses here and **the roles keep their own clean values** — none of the
prototype's numbers survive.

| Study value | Lands on | Note |
|---|---|---|
| backlog id, mono 11 | `ArgoTypography.machineCaption` | exact |
| backlog title, 12.5 | `ArgoTypography.body` | snapped UP to 13; the row height grew 28 → 30 to carry it |
| roll-up / odd priority, mono 10–10.5 | `ArgoTypography.machineCaption` | snapped up to 11, matching the id beside it |
| `HIGH`, `BACKLOG`, `CHARTS`, section captions, 10 uppercase | `ArgoTypography.sectionLabel` | the role's documented job — "sidebar and rail group labels" |
| view name, 12.5 | `ArgoTypography.rowMeta` | snapped DOWN to 11: a view name is chrome, and it must not compete with a ticket title beside it |
| toolbar heading, 13 semibold | `ArgoTypography.windowTitle` | exact tuple |
| toolbar sub-line, 11.5 | `ArgoTypography.rowMeta` | exact |
| toolbar control label (`Start`), 12 medium | `ArgoTypography.control` | exact |
| hero title, 13 medium | `ArgoTypography.rowTitle` | exact |
| chips and label chips, 10.5 | `ArgoTypography.badge` | exact |
| hero empty-tier sentence, 12 | `ArgoTypography.rowMeta` | snapped DOWN to 11, the same direction as the view name above it: the sentence is why there is no ticket, not a ticket (#817) |
| urgent chip border, amber at .28 | `state.rim(attention)` | snapped UP to .5 — the named role for a state hue drawn as an edge rather than an ink (#817) |
| ticket id, mono 12 | `ArgoTypography.machine` | exact |
| ticket title, 17 semibold | `ArgoTypography.sessionTitle` | exact tuple; the role's doc-comment says "a Session's own title" and needs its scope widened to the deck's largest line |
| provider status word, 12 | `ArgoTypography.control` | exact |
| Argo bucket, mono 10 uppercase | `ArgoTypography.machineCaption`, lowercase | the uppercase is dropped: uppercase machine at 11 reads as loud as the word it is filing |
| Delivery number, mono 11.5 medium | `ArgoTypography.machineEmphasis` | exact |
| menu row, 12.5 / its note, mono 10 | `ArgoTypography.rowMeta` / `machineCaption` | exact |
| body prose, 13 | `ArgoTypography.body` | exact |
| menu radius, 10 | `ArgoRadius.popover` 12 | snapped |
| room-strip button radius, 4 | `ArgoRadius.marker` 3 | snapped |
| every colour, spacing step, stroke | already contract roles | the study transcribed them; nothing was invented |

**One promotion is proposed, and is the only contract change this design needs:**

| Proposed | Tuple | Why |
|---|---|---|
| `ArgoTypography.bodyHeading` | interface · `headline` · `semibold` | the ticket body's own section headings — `Acceptance criteria`, `Children · 2 of 9 closed`, `Blocked by · 6`. The tuple is identical to `windowTitle`'s, and the contract already keeps two roles that differ only in weight for exactly this reason: a role is named by its job, so a platform retune of one must not move the other |

## What the study exposed that the renders do not show

- **The sidebar was the wrong home for the backlog, and only measuring showed it.** The first
  approved room read fine in a render because the fixture titles were short. Nine of twelve real
  ones truncated. Any future design in this repo that puts provider-owned text in a narrow column
  should be rendered with the longest real string before it is approved, not after.
- **A narrow column with ticket titles in it is wrong wherever it appears.** The rejected
  full-deck room restored a 240pt facts sidebar and immediately truncated four of six blocker
  titles in it. The fix there is the id plus a hover, not a wider column.
- **`n/m` is the tracker's figure and will look wrong.** It counts closed children the list does
  not draw, so `2/9` over five visible rows is correct and will be reported as a bug. It is worth
  a hover explaining itself.
- **Every ranking input Next-up needs is missing in Swift.** `open · leaf · todo · unblocked ·
  session-less` — none of the five exists; `ArgoEngine/WorkItem/` (#763) reads a title for a
  number. The `edgeless` render is therefore the **first** state this ships in, not an edge case.
- **The Route's canvas does not fit the ideal window.** At 1280 with the sidebar open, the deck
  leaves ~1000pt and the eight-node route asks for ~1044. It scrolls, per #334, but no render at
  the default window will ever show a whole route.
- **The room's three panes leave the ticket 480.** That is the design's tightest number and the
  one most likely to be revisited. If it proves too tight, the fallback is the runner-up room —
  backlog fills the deck, ticket replaces it — and not a narrower list.

## Next

1. `/to-tickets` against this design, then `design-to-code` per ticket.
2. The decisions above go back into the bodies of #272, #273 and #334, replacing their superseded
   Penumbra clauses rather than striking them out (#609's last acceptance criterion).
3. #805 is answered in the affirmative here and should be closed against this design, or narrowed
   to the Sessions and Code rooms it does not cover.
4. #388 remains the hard precondition: this design draws facts nothing yet reads.
