<!-- status: approved
     approved-at: c0e24739
     prototype: worktree-prototype-609-work-room -->

# The Work room

The approved design for the **Work room** (#609) — the backlog rail, the ticket detail, the
Next-up hero, the room's empty and degraded states, and the Route's re-skin. Before this, every
design in `docs/designs/` was a Sessions surface and `InstrumentDeckShell` drew `Color.clear`
for `.work`, so a session sent at #272 would have invented the pixels.

**The renders in [`work-room/`](work-room/) are the spec.** The measurements below are the
numbers a ticket must carry. Ten states: `rest`, `deep` (two Deliveries and six blockers),
`collapsed` (a parent folded), `edgeless` (a provider with no dependency edges), `one-chip`,
the three empty-pool tiers `pool-blocked` · `pool-running` · `empty`, `unbound` (no provider
bound), and `route`.

The study lives on the throwaway branch `worktree-prototype-609-work-room`
(`docs/designs/prototypes/work-room-prototype.html`), where the two rejected rooms are still
switchable (`?variant=B|C`) and every state is a URL. It is there to be re-explored, not built
from.

## What won, and what lost

**Variant A — the roster twin.** The Work room is the Sessions room's geometry with tickets in
it: the 320pt sidebar carries the backlog, the deck carries the ticket. A reader who knows one
room knows the other, and the room needs no new shell vocabulary to be legible on first open.

The two rejected rooms each gave something up. **B — the brow** lifted the Next-up hero out of
the rail into a band across the top of the deck and dropped the sticky sidebar, putting the
ticket's facts in a strip under its title. It read well and it cost the room its second pane:
the facts scrolled away with the body, and a ticket's Deliveries stopped being visible while
reading its acceptance criteria. **C — the ledger** replaced the rail with a wide table and
opened a 420pt inspector on select. It showed more per row than either other room — a Delivery,
a blocker count and a roll-up without selecting anything — and it gave up the rail-and-detail
frame the rest of the app is built on, so the Work room stopped looking like the same app.

**The nesting came from C and was folded into A.** C's tree-in-a-table is where parent and child
first read at a glance; A now carries the same tree in the rail.

## The rail

`dot · id · title`, plus one trailing fact. Lean by #272's rule — no PR chips; the delivery
signal is the dot alone.

**It is a disclosure tree**, the way Mail draws its mailboxes: a twist at the row's leading edge,
children indented one step under their parent, the trailing fact right-aligned. The twist is its
own hit target, so opening a parent does not change what the detail pane shows. **Everything
opens open** — a tree that opens shut hides the thing it was added for.

### The one conflict, and how it resolves

Nesting and priority grouping cannot both be the rail's structure: a child's priority is its
own, and one parent's children scatter across all three bands.

**Priority groups the roots. A child hangs under its parent whatever its own priority is.** The
`HIGH` / `MEDIUM` / `LOW` headers are therefore headers over *roots*, and a child sitting under
`HIGH` may be a `medium`. Where that happens, **the row says so** — the child's own priority is
set in the trailing slot, in the machine caption, quietly. The header never speaks for a row
that disagrees with it.

A parent's trailing slot carries its `n/m` roll-up instead, which is the tracker's own figure —
closed of total. It counts closed children too, so it deliberately does not match the rows
beneath it: the backlog lists what is open.

**A header counts the rows it draws.** Folding a parent lowers its header's count. A count of the
whole subtree would stand `HIGH 8` over one visible row, and the parent's own `n/m` already says
how many children it has.

**The indent caps at two steps.** At 320pt a third level had 28pt less title than a root and
truncated mid-word, so level three and deeper share level two's inset and are read from their
parent's position instead.

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

## The Next-up hero

**A card inset in the rail, above the `BACKLOG · BY PRIORITY` row.** It is inset from the rail's
own edges by `ArgoSpacing.base`, sits on `surface.raised` and carries an `edge.subtle` border at
`ArgoRadius.control` — three things a rail row has none of, which is what stops it reading as
the rail's first row. Putting it over the deck instead (variant B) also solved that, at the cost
of the deck's own top edge.

**At most two chips, each earned, and never a score** (#273). The order is `high priority` →
`unblocked` → `next in <PRD>`, with `oldest untouched` as the honest fallback. `high priority`
takes `state.attention` ink; the rest are neutral. With one chip earned the card simply carries
one — see `one-chip.png`.

**An empty pool degrades in tiers, each with its own sentence.** The card keeps its `NEXT UP`
label and replaces the ticket with the reason: nothing unblocked, all in progress, or backlog
clear. See `pool-blocked.png`, `pool-running.png`, `empty.png`.

**With no dependency edges the `unblocked` chip is suppressed, never asserted** (`edgeless.png`).

## The ticket detail

A scrolling main column against a sticky 240pt facts sidebar, split by a hairline.

**The main column takes the feed's measure** — `ArgoFeedRow.column`, capped then centred, the
same rule `argoFeedMeasure()` already applies. At the 1280 window the pane is narrower than the
cap and nothing is centred; past it the deck grows and the line length does not.

**The head is title-first**: id in the machine caption, title on `sessionTitle`, then the status
pair. There is no scope badge and no produced-by field (#272).

**The provider's word and Argo's bucket, without a contradiction.** The word is set verbatim in
`control`; the bucket follows it behind a 10pt hairline divider, in lowercase machine caption on
`text.disabled`. The two read as a label and its filing, not as two competing claims — which is
what happens when both are set at the same size and weight.

**Deliveries are chips, not a list.** Each is a bordered object on `surface.raised` carrying its
number, its branch, its diff and its checks reading. Two on one ticket are two chips, stacked in
the 240pt sidebar because the column is too narrow to set them side by side (`deep.png`).

**`blockedBy` at one and at six is the same shape** — a list of `dot · id · title`, six rows
long. The count lives in the section caption (`BLOCKED BY · 6`) where it reads at a glance.
**With no edges the section is absent, not empty**: a provider that exposes no dependency
information has not told us there are no blockers.

**A parent adds a Children section to the same view**, listing its open children with their
verbatim status words. No Implement action anywhere on a parent — work happens at leaves.

## The room's own states

**No provider bound: the room hides whole** (#272). No rail, no hero, no table — one centred
panel saying nothing has been read yet, and a Connect action. The connection chip in the
titlebar goes quiet with it.

**An empty backlog is a different page.** The provider answered, and the answer was nothing. The
rail and its caption stay, the hero shows the backlog-clear tier, and the deck says who answered.
Conflating the two would tell a reader their backlog is empty when in fact nobody asked.

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

`route.png` is shot at a 1600 window rather than 1280, because #334's canvas **widens when the
work needs room** rather than compressing to fit; at 1280 the destination mark is off-frame and
the canvas scrolls to it.

The Route's own component names stay #334's to freeze. This design does not name them.

## Measurements

Two surface sheets, beside the surface, per `rules/design-system.md` — a measure is not a token.

### `ArgoBacklogRail` — `ArgoUI/Shell/Work/Rail/`

| Measurement | Value | Reason |
|---|---|---|
| Rail width | `ArgoLayout.sidebarIdealWidth` 320 | the shell's sidebar, unchanged |
| `rowHeight` | **28**, a FLOOR not a frame | macOS scales sidebar row height with the reader's own sidebar-size setting, and a frame here would refuse it — the same reason `rosterFootMinimumHeight` is a floor |
| `gutter` | `ArgoSpacing.comfortable` 12 | the row's own leading inset, before the twist |
| `twistWidth` | **12** | a leaf keeps the slot, so every dot in the rail lands on one vertical |
| `indentStep` | `ArgoSpacing.loose` 16 | one level; a child's dot lands under its parent's id |
| `indentDepthCap` | **2** | level three shares level two's inset — see above |
| `gap` | `ArgoSpacing.base` 8 | between dot, id, title and the trailing fact |
| `heroInset` | `ArgoSpacing.base` 8 | the hero card off the rail's edges |
| `heroPadding` | `ArgoSpacing.comfortable` 12 | inside it |
| Hero radius | `ArgoRadius.control` 6 | a card, not a popover |

### `ArgoTicketDetail` — `ArgoUI/Shell/Work/Detail/`

| Measurement | Value | Reason |
|---|---|---|
| `factsWidth` | **240** | wide enough for a stacked Delivery chip's branch at the machine caption, and no wider — past that the main column starts losing its measure at the 1280 window |
| Reading measure | `ArgoFeedRow.column` 720 | reused, not redeclared: the feed already settled what a line of Argo's prose runs to |
| `inset` | `ArgoSpacing.section` 24 | the column off the deck's edges |
| `sectionGap` | `ArgoSpacing.section` 24 | between the sidebar's sections, each closed by a hairline |
| `chipPaddingX` / `chipPaddingY` | `ArgoSpacing.comfortable` 12 / `ArgoSpacing.snug` 6 | inside a Delivery chip |
| Status divider | 10 tall, `edge.subtle` | between the provider's word and Argo's bucket |
| Body line height | `ArgoFeedRow.lineHeight` 20 | reused |

## Component names — frozen

Renaming one of these later is a migration. Each names the stock SwiftUI control it stands in
for; anything not listed is stock used directly.

| name | tier | stands in for | notes |
|---|---|---|---|
| `WorkRoom` | organism | the shell's existing `NavigationSplitView` slots | supplies sidebar and detail; it does not own a split of its own |
| `BacklogRail` | organism | `List(selection:)` with one `Section` per priority | the sidebar's content |
| `BacklogOutline` | molecule | `OutlineGroup(children:)` inside that `List` | the tree; children come from the child edge, not a nested array literal |
| `BacklogRow` | molecule | an `HStack` in a `List` row | `dot · id · title · trailing`, at `rowHeight` as a floor |
| `BacklogTwist` | atom | `DisclosureGroup`'s chevron, drawn | drawn rather than inherited so it can carry its own hit target |
| `DeliveryDot` | atom | `Circle` at `ArgoLayout.statusDotSize` | the five-state table above |
| `PriorityHeader` | atom | a `Section` header | label on `sectionLabel`, drawn count on `machineCaption` |
| `BacklogCaption` | atom | `Text` | the `BACKLOG · BY PRIORITY` row and its total |
| `NextUpCard` | molecule | a `VStack` on `surface.raised` | the hero; carries the ticket or an empty-tier sentence |
| `NextUpChip` | atom | `Text` in a rounded rect | at most two, each earned |
| `TicketDetail` | organism | `HStack` of a `ScrollView` and a fixed-width `ScrollView` | not an `HSplitView` — the seam is fixed, not dragged |
| `TicketHead` | molecule | a `VStack` of `Text` | id, title, status pair |
| `StatusPair` | atom | `HStack` + `Divider` | the provider's word and Argo's bucket |
| `TicketFacts` | organism | the trailing `ScrollView` | Deliveries · Properties · Labels · Blocked by · Children |
| `DeliveryChip` | molecule | `Button(.plain)` opening a URL | deep-links; two on one ticket are two of these |
| `LabelChip` | atom | `Text` in a rounded rect | a provider label, verbatim |
| `TicketLinkList` | molecule | a `VStack` of `Button(.plain)` | ONE component; `blockedBy` and Children are two callers with different trailing facts |
| `WorkRoomVacancy` | molecule | `ContentUnavailableView` | both room-level states — unbound, and answered-with-nothing |
| `RoomPresentation` | atom | `Picker(.segmented)` | `Present as: Tree \| Map`, map-scoped not room-scoped (#334) |

## Token reconciliation

Every value in the study snapped to an existing role. The prototype's jitter (10 vs 10.5 vs
11, 12 vs 12.5) collapses here and **the roles keep their own clean values** — none of the
prototype's numbers survive.

| Study value | Lands on | Note |
|---|---|---|
| rail id, mono 11 | `ArgoTypography.machineCaption` | exact |
| rail title, 12.5 | `ArgoTypography.body` | snapped UP to 13 — the rail then reads at the Sessions roster's size, which is what this variant claims |
| roll-up / odd priority, mono 10–10.5 | `ArgoTypography.machineCaption` | snapped up to 11, matching the id beside it |
| `BACKLOG · BY PRIORITY`, `HIGH`, section captions, 10 uppercase | `ArgoTypography.sectionLabel` | the role's documented job — "sidebar and rail group labels" |
| hero title, 13 medium | `ArgoTypography.rowTitle` | exact |
| chips and label chips, 10.5 | `ArgoTypography.badge` | exact |
| ticket id, mono 12 | `ArgoTypography.machine` | exact |
| ticket title, 17 semibold | `ArgoTypography.sessionTitle` | exact tuple; the role's doc-comment says "a Session's own title" and needs its scope widened to the deck's largest line |
| provider status word, 12 | `ArgoTypography.control` | exact |
| Argo bucket, mono 10 uppercase | `ArgoTypography.machineCaption`, lowercase | the uppercase is dropped: uppercase machine at 11 reads as loud as the word it is filing |
| Delivery number, mono 11.5 medium | `ArgoTypography.machineEmphasis` | exact |
| sidebar key and value, 11 / 12 | `ArgoTypography.rowMeta` for both | ink carries the difference — key `text.tertiary`, value `text.secondary` |
| body prose, 13 | `ArgoTypography.body` | exact |
| every colour, radius, spacing step, stroke | already contract roles | the study transcribed them; nothing was invented |

**One promotion is proposed, and is the only contract change this design needs:**

| Proposed | Tuple | Why |
|---|---|---|
| `ArgoTypography.bodyHeading` | interface · `headline` · `semibold` | the ticket body's own section headings — `Acceptance criteria`, `Children · 2 of 9 closed`. The tuple is identical to `windowTitle`'s, and the contract already keeps two roles that differ only in weight for exactly this reason: a role is named by its job, so a platform retune of one must not move the other |

## What the study exposed that the renders do not show

- **The rail is the wrong home for a deep tree.** Three levels is the practical limit at 320pt,
  and the cap is a workaround, not a solution. A parent with a five-deep chart is read on the
  Route (#334), not in the rail — which is an argument for building #334 sooner than its place
  in the chain suggests.
- **`n/m` is the tracker's figure and will look wrong.** It counts closed children the rail does
  not draw, so `2/9` over five visible rows is correct and will be reported as a bug. It is worth
  a hover explaining itself.
- **Two Deliveries is the honest ceiling for the 240pt sidebar.** Three stack to the fold at the
  1280 window. Nothing in the data says three is impossible.
- **Every ranking input Next-up needs is missing in Swift.** `open · leaf · todo · unblocked ·
  session-less` — none of the five exists; `ArgoEngine/WorkItem/` (#763) reads a title for a
  number. The `edgeless` render is therefore the **first** state this ships in, not an edge case.
- **The Route's canvas does not fit the ideal window.** At 1280 with the rail open, the deck
  leaves ~912pt and the eight-node route asks for ~1044. It scrolls, per #334, but no render at
  the default window will ever show a whole route.

## Next

1. `/to-tickets` against this design, then `design-to-code` per ticket.
2. The decisions above go back into the bodies of #272, #273 and #334, replacing their superseded
   Penumbra clauses rather than striking them out (#609's last acceptance criterion).
3. #388 remains the hard precondition: this design draws facts nothing yet reads.
