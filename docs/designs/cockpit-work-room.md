<!-- status: approved
     approved-at: c0e24739
     prototype: worktree-prototype-609-work-room -->

# The Tickets room

> **Renamed by #881 · 2026-08-28:** this room was called **Work** when the design was approved.
> The room, its symbols and its specimen names now read **Tickets**; this file, its `.html` and the
> `work-room/` renders keep their names, because six other docs and the design's own provenance
> cite them by path.

The approved design for the **Tickets room** (#609) — the views sidebar, the backlog list, the
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
`menu` (the Start verb's Mode menu — **superseded #872**, see `Start` below), and `route`.

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
depth three, and the ticket opens beside it. **520 is where it RESTS, not a width it is held at**
— see **the seam between the panes** below (#844).

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
- ~~**Charts** — one row per PRD-shaped parent (`#607 Wayfinder`, `#334 The Route`), the entry
  point to the Route.~~ **Withdrawn (#844.)** The Route is #334 and is not built, so every row in
  the group answered no click, under a heading that read as a charting feature. The group comes
  back with the Route. `Ticket.isChartShaped` survives it: the Next-up hero still reads a
  PRD-shaped parent for its `next in #607` chip.
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

The twist is **drawn**, not `DisclosureGroup`'s and not `OutlineGroup`'s: only a twist the row owns
can carry a hit target of its own, and only a drawn one lets a leaf keep the slot every dot lands
on. That is what `BacklogOutline` stands in for, amended in the table below (#814).

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

**The indent caps at two steps.** Level three shares level two's inset. At the opening 520 this is
comfort rather than necessity — it is the rule that keeps a five-deep parent legible, and a tree
that deep is read on the Route (#334), not here.

### The trailing region — two marks, and the precedence between them

**Amended #896 · #897.** The row shipped with one trailing fact and one dot. Three tickets then
proposed a mark for that one slot without reference to each other — a blockage count (#896), a date
(#897), and a `claimed` mark (#894, withdrawn). A row grows four marks nobody designed together
exactly that way, so the region is settled here, once, and a fourth fact has to be placed in this
order rather than race the others for the position.

**The region holds at most two marks, in this order: the blockage mark, then the caption.** Both
sit after the label chips, both are rigid, and neither displaces the title — the title is still the
only thing the row squeezes.

**The blockage mark does not contend.** It answers a different question from everything in the
caption: *can I start this*, rather than *what is this* or *how long has it sat*. A row that is both
blocked and stale therefore draws both, and the count is a count rather than a flag — blocked by
three and blocked by one are different distances from startable.

**The caption holds exactly one fact, in this order.** First one present wins; the rest are not
drawn.

| | Fact | Why it sits here |
|---|---|---|
| 1 | the parent's `n/m` roll-up | the only place the tracker's own child count is stated |
| 2 | the child's odd priority word | the only place a row disagrees with the header over it (#819) |
| 3 | the age, last touched | context, and the one a reader can get from the pane beside it |

**The age is last because nearly every row has one.** An age that outranked the other two would
silently delete them from the only list that states them, which is a worse loss than a date a
reader can still read in the pane. It is therefore the slot's *default* — what the caption says
when nothing more specific has claimed it — and a parent's row shows its roll-up rather than its
date, deliberately.

**The mark sits inboard of the caption, not outboard of it.** The caption keeps the trailing edge
it has always been right-aligned to, so adding the mark moves nothing on an unblocked row.

**The age is relative all the way out** — `now`, `4h`, `6d`, `3w`, `2mo`, `1y` — and never becomes
`Aug 12` past a horizon. The reason to look is distance from now; an absolute date hands that
subtraction back to the reader, and a column that changes register halfway down loses the rhythm
that made it scannable. One rounded unit, in the machine caption the roll-up already sets.

**Absence draws nothing, and says nothing.** A row whose provider served no date draws no caption —
no placeholder and no reserved gap. A ticket whose blockers the provider never served draws no mark
either, and that silence is deliberate: it is not a claim that the ticket is unblocked, which is the
claim Argo has no standing to make (`CONTEXT.md` L2 · degrade-down). The mark and its absence are
therefore drawn identically for a *clear* ticket and an *unread* one, which is correct — the row
says nothing about blockage in both cases, and only the sidebar's `Blocked` count, which can see the
whole set, is allowed to tell them apart.

**The mark's ink is the Route's, unchanged.** Waiting is `state.idle`, so seventeen blocked rows do
not read as an emergency on day one; `state.failure` is spent only on a ticket that can never
unblock itself — one whose blocker was **ruled out**, which satisfies nothing and needs a human to
re-scope one of the two. No palette role is added.

**None of this is a leading accent.** The region is trailing, and a selected or current row is still
carried by its ground alone.

### The seam between the panes

**Both panes are the reader's to size (#844).** #816 fixed the backlog at 520 and joined the two
with a hairline, which left the ticket detail taking every point the window gained or lost; #836
let the list yield below 520 but still gave nobody a handle. They are joined by a `DeckSeam` now —
the same seam the Sessions deck already uses — and the width is the WINDOW's
(`CockpitNavigationModel.backlogWidth`), because the panes are rebuilt on every ticket click and a
width owned inside that subtree loses the drag each time.

| | |
|---|---|
| Rests at | `ArgoBacklogList.width` **520** — unchanged, and still the measure the twelve real titles were chosen against |
| Floor | **342** — `ArgoLayout.backlogWidths.lowerBound`, which is #836's derived `minimumWidth` |
| Ceiling | **760**, pulled in so the ticket detail always keeps `proseColumnMinimumWidth` **320** |

**The floor is #836's number, not a second one.** That commit derived 342 as the width the list
yields to when the window cannot afford 520 — the narrowest window, less the sidebar, less a pane
of prose, less the two seams between them. "How narrow may the list get before the ticket pane
suffers" is the same question a seam's floor asks, so the seam took the answer over rather than
naming a rival. `ArgoBacklogList.minimumWidth` reads it back.

**Travel is thin at the narrowest window, and that is arithmetic.** At 960 the deck is 680 and the
seam moves between 342 and 351 — nine points. It widens fast: 329 points at the 1280 ideal, 418 at
1600. A seam that cannot move at all would be worse than none, because it looks like one; nine
points is small but honest, and the window is the thing to widen.

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
The Tickets room does the same, in the same order:

**Amended again — the bands are gone, and every control is back in the window's one row.** #836
split them across a band per pane; see **the column question** below for what that bought and what
it cost. The heading stays in the list pane, because it is words about the list rather than a
control.

| position | control | scope | drawn by |
|---|---|---|---|
| leading the list pane | `Backlog` and, under it, `All open · by priority · 12 tickets` | says what you are looking at, and how many | the list pane |
| after the scope vessel | filter, then the ordering menu, **past a rule** | list-scoped | the window row |
| next | **New ticket** | the call-to-action, its own vessel — the one thing this window creates | the window row |
| next | `▶ Start`, open-on-host, copy link | the ticket's own verbs | the window row |
| trailing edge | search | a real field at 210, not an icon that becomes one | the window row |

**A title without its count can lie about what you are filtered to**, which is why the heading is
two lines and Mail's is too (`Searching / Inbox — …, 11 results`).

**The middle term names the grouping in force, so it is absent until there is one.** A subtitle
reading `by priority` over an ungrouped list is the exact lie the second line exists to prevent, so
the term arrived with the headers that justify it (#819). Through #812 and #814 — nesting is not a
grouping — the line read `All open · 12 tickets`.

### The column question, settled (#836)

macOS gives per-column toolbar regions only to a genuine three-column `NavigationSplitView`, and
the shell's split view is unconditional — a room fills its slots rather than replacing them (#812).
Forking it per room would rebuild the whole window on every room switch and drop the deck's
per-Session state, both seam drags and the sidebar's width. `.principal` is closed for the reason
`ShellToolbar` already records.

**#816 answered this by claiming the boundary from inside one region, and the answer was wrong.**
Every item took `.primaryAction` and the list's block took a 520pt frame at its leading edge, on the
premise that `.primaryAction` begins where the ticket column does. macOS lays `.navigation` and
`.primaryAction` out as ONE continuous band, so the shell's own leading items are drawn first and
the block landed most of a column late — with New ticket, Start and the two link verbs pushed into
the system's overflow at the 1280 window. **Nothing in this room is behind an unlabelled control**,
so that answer had to go.

**#836's answer was a band at the head of each pane, and it was wrong in the other direction.**
`BacklogHeader` took the heading, its count, the filter and `BacklogMenu`; `TicketBand` took New
ticket and the open ticket's verbs. Each was aligned to its column by construction, which is what
the placement was for.

**But nothing about a filter mark says which column it acts on.** A reader met the same family of
marks at three heights — the scope chips and search in the window's row, two marks over the list,
four more over the ticket — and read three unrelated rows rather than one row placed by scope. The
placement was legible only to somebody who already knew the rule. It also cost both panes a 44pt
band, which is the height a room this dense can least spare.

**So the controls are back in the window's one row, in scope order left to right**: the list's two,
then the one thing the window creates, then the open ticket's verbs, then search at the trailing
edge. That is Mail's own row read literally, and it is the arrangement #836 set out to reach before
`.primaryAction`'s geometry defeated it — reached now by giving up the column boundary rather than
by claiming it. **The boundary was never the point; one legible row was.**

The heading stays in the list pane. It is not a control: it says what the list is and how many, and
words about a column belong over that column.

**When the window cannot afford three columns, the LIST is what yields.** 520 is where the list
rests; since #844 it is neither a ceiling nor a floor, because the seam between the panes is the
reader's to move (see **the seam between the panes**). Below 520 the pane narrows and titles
truncate at the tail, which they already do. The ticket pane keeps `ArgoLayout.feedMinimumWidth`
320 and its prose re-wraps to whatever it is left. A clipped title is a title you can still read
the start of; a ticket pane
squeezed under its own controls is a control you cannot reach at all. Every control in the room is
present and whole at `windowMinimumWidth` 960. The width that yield stops at is the seam's floor
now — one number, named once in `ArgoLayout.backlogWidths`.

**Search sits over the ticket but searches the list.** That is Mail's own split, and for the
same reason: the toolbar is one row, not three.

**New Session is not in this room's row (#836).** Mail's window creates one kind of thing and
spends one compose mark on it. This room creates a ticket, so `ShellToolbar` draws New Session in
every other room and `⌘N` and the menu bar reach it from this one. Two compose marks a finger
apart, each making a different thing, is the confusion the plus was originally chosen to avoid —
removing one of them is the better answer than re-cutting the mark.

### The two narrowings, decided (#873)

The field and the funnel narrow the SAME list, so they are decided together. Deciding one alone
gets two narrowings that do not compose, and the reader meets a list nobody can account for.

**They compose by intersection, in one fixed order, and neither ever widens.** The sidebar's view
chooses the set, the funnel narrows within it, the query narrows within that. The heading reads in
that same order, so what is on screen can always be read back off it.

#### Search matches the number and the title, and nothing else

**The query is a substring of the ticket's title, or of its number** — case- and
diacritic-insensitive, and a leading `#` on a number is optional. A field holding only spaces is
not a query: it returns the whole list rather than matching everything by accident.

**Not the body.** A ticket's body is read only for the ticket the deck is open on, so a body match
would return a different set for the same query depending on what the reader last clicked. A search
whose answer depends on what you clicked is worse than one that never reads a body at all.

**Not labels, type or assignee.** Those are closed sets of the provider's own words, which is what
makes them the funnel's — see below. A field that also matched them would silently overlap the
control beside it, and no reader could tell which of the two excluded a ticket.

**The heading says it is searching**, on the two-line shape the rest of this section already
argues for: `Searching` over `All open · by priority · 3 results`. It reads `results` and not
`tickets`, because the count is of MATCHES and the rows on screen can exceed it — see the rails
below. Clearing the field returns `Backlog` over `All open · by priority · 12 tickets`.

**A matching child under a non-matching parent keeps its parents, as rails.** The list's structure
is "priority groups the roots, a child hangs under its parent whatever its own priority" — a match
that vanished because its parent did not match would be a row the reader can see the count of and
never reach. A rail draws its title in `text.tertiary` rather than `text.secondary`, the same
demotion the row's `#id` already carries, so it is not read as a match.

**A search draws everything open, and the twists stand down.** A fold that hid the only match would
leave the heading claiming results nobody can see. The reader's fold is not cleared — it comes back
when the field clears.

**No matches is a stated empty INSIDE the list pane, never one of the room's vacancies.** The three
vacancy pages are facts about the provider; this is a fact about the query. It also has to keep the
row of controls: a search field that removes itself the moment it matches nothing is a field nobody
can clear.

**The query is the Project's.** It survives selecting a ticket and switching room — both leave the
backlog it was typed against standing. It does not survive a Project switch: carried across, it
would silently narrow a list of tickets it was never typed against, and `3 results` would be
counting a different Project's answer.

#### The funnel narrows by label, type and assignee

**Those three, and no others.** They are the facts the provider serves per ticket that have a
closed set of values, which is what a funnel can offer as rows and what a reader can pick from
without typing. Multi-select within one facet is OR; across facets it is AND.

**Not status.** The sidebar's four views are already the cut across closure, claim and blockage,
and `status` is the provider's own word with no fixed vocabulary behind it. A funnel offering it
would be a second control answering the view's question in different words.

**Not priority.** Priority is the grouping in force, so every band is already on screen and named.
Narrowing by the thing the list is grouped by removes headers rather than rows.

**The mark stays `line.3.horizontal.decrease`** — a funnel is the one glyph here nobody had to
learn — and it takes a filled state whenever any facet is on. A funnel that looks identical whether
or not it is narrowing makes the same false claim about the data that a search field returning the
whole list does.

### `Start` starts — there is no rung to choose

The study first drew an unlabelled `…`. **An overflow nobody can name is an overflow nobody
opens**, so it is gone.

**#816 replaced it with a split control, and that was wrong too.** The button started a Session and
a chevron beside it opened the **Mode** it would start in — `Read Only · Plan · Code · Auto`, one
row per rung. See `menu.png`, which is the state that render captured.

**Amended #872: the chevron is deleted and `Start` spawns in `Code`, always.** The menu asked a
question with one answer. Starting a Session on a ticket is starting work on it, and `Code` is the
rung that work needs — `SessionMode.code` is already spelled "the baseline rung, so ungated tools do
not pay a Permission round trip", and `CockpitNavigationModel.workMode` already defaulted to it. So
every open of that menu was a reader confirming the value that was there when they arrived. A
control whose default is the answer in every case is not a choice; it is a click charged for
nothing, on the one verb this room exists for.

**The rung stays changeable, in the place that can honestly change it.** A Mode chosen before a
Session exists is a guess about work nobody has started; the composer's own Mode control (#608,
ADR-0025) sits over a live Session, reads the rung the CLI is actually on, and can say `≈` when the
reading is approximate. That is the control that owns this fact. A second picker upstream of it,
writing a rung nothing reads back, was two controls over one fact — and one fact said two ways is
one of them waiting to go stale.

**A deliberate Plan or Read Only start is not this room's gesture.** It begins in the composer of
the Session that opened, one rung change away, and it costs the rare case a click rather than
charging every case one.

**Amended #899: `Start` names the command it will send, and the press goes to the Session.** The
command sits after the word in `text.tertiary` on `machineCaption` — it is what `Start` will do, not
a second control — and nothing is drawn where the ticket asks for none. Pressing it now lands the
window in the Sessions room on the fresh Session, which **reverses #872's decision to stay put**:
that reasoning held for a Start whose only visible answer was the backlog row going claimed, and a
Start that begins real work has its answer in the other room. A refused spawn moves nothing. The
gallery is `start-command.png`, from the `ticketStart` specimen.

The two link verbs that would otherwise have hidden in that ellipsis — open on the code host,
copy link — are icons beside `Start`, past a hairline. Nothing in this room is behind an unlabelled
control.

### The marks, re-cut

The study's glyphs were read back and three of them named nothing a reader recognised, so they
were replaced. **A toolbar mark is not a place to be inventive**: the row is chrome, and chrome
that has to be learned costs more than the space a familiar mark saves.

| control | was | is | why |
|---|---|---|---|
| Start | `bolt` | `play.fill` | a bolt reads as speed or as power; neither is the act. Play is the one mark every transport control in the OS uses for *begin* |
| New ticket | `square.and.pencil` | `plus`, then **`square.and.pencil` again (#836)** | the compose mark was given up to keep it off the same row as New Session. #836 took New Session out of this room instead, so the mark is free and this is the one thing the window creates — which is exactly what Mail spends its compose mark on |
| Group by | `list.bullet.indent`, then `rectangle.grid.1x2` | **an `ellipsis` menu (#836)** | both were marks invented for an act the platform already houses: Mail keeps sort and group inside the ellipsis beside its filter. A mark a reader has to learn costs more than the row it saves |

Filter keeps `line.3.horizontal.decrease` — a funnel is the one glyph here nobody had to learn, and
it is Mail's own.

**An `ellipsis` menu is not the unlabelled overflow this design rules out.** It is a named control
with named rows behind it; the overflow the study cut was the system's own last resort, holding
controls nobody could see and nobody could name.

**The filter/group capsule takes a rule between its two marks.** Sharing a vessel with no divider
made a pair of unrelated acts read as one unfamiliar control — the same failure the `Start` split
already avoids, and it takes the same hairline to fix.

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

**Amended #898: where the card names a ticket it is a CONTROL, and it says so.** Pressing it opens
that ticket in the pane beside the rail — the same act as clicking its backlog row, and it changes
nothing else: not the open view, and not the sidebar's selection. The hero ranks across the whole
room, so its pick is regularly a ticket the open view does not admit; an open that re-pointed the
rail would answer a question nobody asked. It is a `Button` and never a fifth row of the `List` it
scrolls in — the arrow keys belong to the four views.

At rest it carries a **trailing chevron beside the `NEXT UP` label**, which is the mark that says
pressable before a pointer arrives; under the pointer the card's ground goes `surface.hover`, and
under the click `surface.selected`. The three degraded tiers name no ticket and carry **neither the
chevron nor the wash** — a card that lit up to open nothing is worse than one that never moves.
The gallery is `next-up-pressable.png`, shot from the `nextUpPointer` specimen.

**Amended #899: the card carries a second control at its foot — `Start`.** The hero is the room's
answer to "what should I pick up", and opening the ticket was only half an answer to it; the other
half is beginning the work. It is trailing-aligned below the chips and spells the verb exactly
as the toolbar's Start does — the word, then the command after it in `text.tertiary` on
`machineCaption`, because it **says which command it will send** — `/implement`,
`/design-to-code`, `/grill-me`, `/prototype`, `/wayfinder`. A press that silently dispatched one of
five different jobs is a press nobody can aim. A ticket that matches no rule reads `Start` alone
and opens an empty composer, which is the honest answer rather than a wrong one.

**Its vessel is its own, and it answers the pointer on its own account.** It cannot borrow the
`.quiet` control's flat `surface.overlay`: that fill is a fixed ink and the card under it is not, so
measured on the render it went invisible against `surface.hover` and came out DARKER than
`surface.selected` — in the two states it most has to read as a target of its own. It carries an
`edge.subtle` rim, which separates it from the card in all three of the card's grounds, and answers
its own pointer with `surface.hover` and `surface.selected` **washed over `surface.overlay` rather
than in place of it** — the rule the card's own ground already had to learn. Used as the fill, those
translucent whites landed within 3 of the card beneath and a pointer on the starter was
pixel-identical to no pointer at all. Over the ground they span the same 12 levels the card does.

**The two controls are siblings, not one nested in the other.** A `Button` inside another `Button`'s
label is drawn and unhittable — the outer one takes every click — so the starter is drawn twice: a
hidden copy inside the card's label holds its space, and the live one is an overlay over that space.
Both are inset by the card's own `heroPadding`, which is what keeps them in one place with nothing
measured. The degraded tiers carry no starter, for the reason they carry no chevron.

The gallery is `next-up-start.png`, shot from the same `nextUpPointer` specimen: the card's three
grounds, then two frames holding the card still while the STARTER's own pointer moves — which is
the only evidence a still render can give that the two are separate targets — then the card whose
ticket asks for no command.

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

**Amended #893: the pair degrades to the word alone where the bucket only repeats it.** On GitHub
the word IS the filing — the head read `open | open`, spending a divider on one bit. The bucket is
drawn beside the word only where it says something the word cannot, which on a two-state provider
is `claimed`, the filing no provider carries. `Bucket` keeps its labelled home in the fact strip;
what the head drops is the restatement, not the fact.

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

**A query that matches nothing is a fourth state, and it is not one of these** (#873). It is a fact
about the query rather than about the provider, so it stays inside the list pane and the room's row
of controls stands — see **the two narrowings** above.

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
- The canvas is an opaque Tickets-room surface on `surface.base`. It is not glass and not a card.
- The Route replaces both deck panes and carries its own head, so the room's toolbar empties for
  it too.

`route.png` is shot at a 1600 window rather than 1280, because #334's canvas **widens when the
work needs room** rather than compressing to fit.

The Route's own component names stay #334's to freeze. This design does not name them.

## Measurements

Surface sheets, beside the surface, per `rules/design-system.md` — a measure is not a token.

### `ArgoTicketsSidebar` — `ArgoUI/Shell/Tickets/Sidebar/`

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

### `ArgoBacklogList` — `ArgoUI/Shell/Tickets/Backlog/`

| Measurement | Value | Reason |
|---|---|---|
| List width | **520**, where it RESTS | the smallest width at which all twelve real titles read whole at depth three; at 480 three of them clip. Not a ceiling since #844 — the reader drags the seam from here, to 760 — see **the seam between the panes** |
| `minimumWidth` | **342**, derived | what the pane gives up to when the window cannot afford 520 (#836): the narrowest window less the sidebar, less a pane of prose, less the two seams between them. Titles truncate at the tail, which they already do — the ticket pane is what must not be squeezed. Since #844 this is also the SEAM's floor, and it is named once in `ArgoLayout.backlogWidths` |
| `bandHeight` | **44**, a FLOOR | the heading at the head of the pane — the title and its count. A floor because the two lines are set at the reader's own type size. The controls that narrow the list are in the window's row now, so this measures words only |
| `bandInsetX` | `ArgoSpacing.comfortable` 12 | the gutter again, so the title starts on the vertical its rows do |
| `labelsAppearAt` | **440** | the narrowest pane that still carries a row's label chips (#844). The chips are rigid, so under this they take the title's characters rather than give up their own |
| `labelLimit` | **2**, then a `+n` chip | the row DISTINGUISHES one ticket from the next; the whole set is the ticket pane's |
| `rowHeight` | **30**, a FLOOR not a frame | grew from 28 when the title snapped up to `body` 13 |
| `gutter` | `ArgoSpacing.comfortable` 12 | the row's leading inset, before the twist |
| `twistWidth` | **12** | a leaf keeps the slot, so every dot lands on one vertical |
| `indentStep` | `ArgoSpacing.loose` 16 | one level; a child's dot lands under its parent's id |
| `indentDepthCap` | **2** | level three shares level two's inset |
| `gap` | `ArgoSpacing.base` 8 | between dot, id, title and the trailing region |
| `blockageMark` | **16**, a floor on both axes | at one digit a circle; a second digit grows the capsule sideways rather than shrinking the numeral (#896) |

### `ArgoTicketsChrome` — `ArgoUI/Shell/Tickets/`

| Measurement | Value | Reason |
|---|---|---|
| Row height | **46** | the shell's existing titlebar strip, unchanged — not restated in code, where `ArgoToolbarVessel` already names the band |
| ~~`listBlockWidth`~~ | **gone (#836)** | it claimed 520 inside one toolbar region to reach the column boundary, and macOS begins that region after the shell's own items. The list's controls are in the list's band now, aligned by construction — which is also what makes the pane safe to drag (#844): a band has no width to keep in step with the seam |
| `iconButton` | **26 × 24** inside a 3pt vessel inset | the capsule's own padding is the vessel's, not the button's |
| `iconSize` | `ArgoIconSize.control` **13** | 14 was the SVG box the study drew into; `control` is the rung the contract gives "a control's own mark", and a fourth rung is a token change this room has no standing to make |
| `searchWidth` | **210** | wide enough for `Search the backlog`; at 260 the trailing edge clipped at 1280 |
| Vessel shape | `Capsule()` | a capsule is a shape, not a radius — no `ArgoRadius` rung applies |
| Vessel material | glass, **no border, no shadow** | `ArgoElevation.vessel` is zero; the specular rim is the cue |
| ~~Menu offset~~ | **gone (#872)** | it measured `ModeMenu`'s popover, which was never implementable — AppKit positions and draws its own — and the menu it described is deleted. `BacklogMenu`'s popover is AppKit's on the same terms |

### `ArgoTicketDetail` — `ArgoUI/Shell/Tickets/Detail/`

| Measurement | Value | Reason |
|---|---|---|
| ~~`bandHeight`~~ | **gone** | this pane has no band: the ticket's verbs are in the window's row with the rest of the room's controls, which is a line of height back for the words |
| Reading measure | `ArgoFeedRow.column` 720 | reused, not redeclared: the feed already settled what a line of Argo's prose runs to |
| `inset` | `ArgoSpacing.section` 24 | the column off the deck's edges |
| `factStripGap` | `ArgoSpacing.section` 24 column / `ArgoSpacing.base` 8 row | between fact pairs; the pair's own key-to-value gap is `snug` 6 |
| `chipPaddingX` / `chipPaddingY` | `ArgoSpacing.comfortable` 12 / `ArgoSpacing.snug` 6 | inside a Delivery chip |
| Status divider | 10 tall, `edge.subtle` | between the provider's word and Argo's bucket, where both are drawn (#893) |
| Body line height | `ArgoFeedRow.lineHeight` 20 | reused |

## Component names — frozen

Renaming one of these later is a migration. Each names the stock SwiftUI control it stands in
for; anything not listed is stock used directly.

| name | tier | stands in for | notes |
|---|---|---|---|
| `TicketsRoom` | organism | the shell's existing `NavigationSplitView` slots | supplies sidebar and detail; it does not own a split of its own |
| `TicketsSidebar` | organism | `List(selection:)` with two `Section`s | views, not tickets |
| `RoomStrip` | atom | `Picker(.segmented)` | `Sessions \| Tickets \| Code`, at the head of EVERY room's sidebar (#805). #816 deleted the titlebar's `RoomsVessel`, so this is the window's only rooms picker and it lives in `Shell/Sidebar/` rather than under `Tickets/` |
| `ViewRow` | molecule | an `HStack` in a `List` row | glyph · name · count, at `viewRowHeight` as a floor |
| `ProviderFoot` | atom | an `HStack` above a `Divider` | the bound provider, at the sidebar's foot |
| `NextUpCard` | molecule | a `VStack` on `surface.raised` | the hero; carries the ticket or an empty-tier sentence |
| `NextUpChip` | atom | `Text` in a rounded rect | at most two, each earned |
| `BacklogList` | organism | `List(selection:)` with one `Section` per priority | the deck's leading pane |
| `BacklogOutline` | molecule | a `ForEach` over the flattened tree inside that `List` | the tree; children come from the child edge, not a nested array literal. **Amended #814**: it stood in for `OutlineGroup(children:)`, which cannot give the twist its own hit target, cannot let a leaf keep the slot, and hands a subtree to a control that counts rows. The projection flattens; the reasoning is in the inventory |
| `BacklogRow` | molecule | an `HStack` in a `List` row | `twist · dot · id · title · trailing` |
| `BacklogTwist` | atom | `DisclosureGroup`'s chevron, drawn | drawn rather than inherited so it can carry its own hit target |
| `DeliveryDot` | atom | `Circle` at `ArgoLayout.statusDotSize` | the five-state table above |
| `BlockageMark` | atom | a count in a `Capsule().strokeBorder` | **Added #896**: how many blockers still stand, in the trailing region. Hollow rather than filled, so the numeral's contrast is the ink's own in both appearances |
| `PriorityHeader` | atom | a `Section` header | label on `sectionLabel`, drawn count on `machineCaption`. **Amended #819**: it is a `List` ROW with `selectionDisabled()`, not a `Section` header — a section costs air this design has already measured, and what that trade returns and what it does not (pinning) is in the inventory |
| `TicketsToolbar` | organism | `.toolbar { ToolbarItem }` per control | the window row, and **every control the room has**. Amended twice: #836 moved all but search into per-pane bands, and the bands are now gone — see the column question |
| `BacklogControls` | molecule | a `ToolbarVessel` | filter and `BacklogMenu`, past a rule. Split out of `BacklogHeader` when the controls returned to the row |
| `BacklogHeader` | molecule | an `HStack` at the head of the list pane | the heading and its count, and nothing else. **Renamed #836** from `BacklogToolbarLabel`; the controls left it when the row was reassembled |
| ~~`TicketBand`~~ | — | **gone** | added by #836 to carry New ticket and the ticket's verbs over their column; both are toolbar items again |
| `BacklogMenu` | atom | `Menu` under an `ellipsis` | how the list is ordered. **Added #836**: Mail keeps sort and group here rather than on a mark of their own |
| `ToolbarVessel` | atom | `GlassEffectContainer` + `Capsule` | groups icon buttons; no border, no shadow |
| `ToolbarIcon` | atom | `Button(.plain)` with a `Label(.iconOnly)` | one glyph at `iconSize` |
| `NewTicketButton` | atom | `ToolbarIcon` in its own `ToolbarVessel` | the call-to-action; survives the empty backlog |
| `StartControl` | molecule | `Button` in one vessel, with the two link icons | the verb, spawning in `Code`. **Amended #872**: it was `Button` + `Menu`, and the chevron is gone |
| ~~`ModeMenu`~~ | — | **gone (#872)** | the four Mode rungs. The rung is the composer's, over a live Session (#608) |
| `BacklogSearchField` | atom | `.searchable` field | searches the list; sits at the trailing edge |
| `TicketDetail` | organism | a `ScrollView` | one column; no inner split |
| `TicketHead` | molecule | a `VStack` of `Text` | id, title, status pair |
| `StatusPair` | atom | `HStack` + `Divider` | the provider's word, and Argo's bucket only where it is not the same word (#893) |
| `TicketFactStrip` | molecule | a wrapping `HStack` above a `Divider` | priority · type · bucket · labels |
| `DeliveryChip` | molecule | `Button(.plain)` opening a URL | deep-links; two on one ticket are two of these |
| `LabelChip` | atom | `Text` in a rounded rect | a provider label, verbatim |
| `TicketLinkList` | molecule | a `VStack` of `Button(.plain)` | ONE component; `blockedBy` and Children are two callers with different trailing facts |
| `TicketsRoomVacancy` | molecule | `ContentUnavailableView` | both room-level states — unbound, and answered-with-nothing |
| `BacklogNoMatch` | atom | a centred `Text` in the list pane | **Added #873**: the query matched nothing. Deliberately NOT a `TicketsRoomVacancy` case — that one replaces the whole deck, and this is a fact about the query rather than about the provider |
| `RoomPresentation` | atom | `Picker(.segmented)` | `Present as: Tree \| Map`, map-scoped not room-scoped (#334) |

## Token reconciliation

Every value in the study snapped to an existing role. The prototype's jitter (10 vs 10.5 vs 11,
12 vs 12.5) collapses here and **the roles keep their own clean values** — none of the
prototype's numbers survive.

| Study value | Lands on | Note |
|---|---|---|
| backlog id, mono 11 | `ArgoTypography.machineCaption` | exact |
| backlog title, 12.5 | `ArgoTypography.body` | snapped UP to 13; the row height grew 28 → 30 to carry it |
| roll-up / odd priority / age, mono 10–10.5 | `ArgoTypography.machineCaption` | snapped up to 11, matching the id beside it. The age joined the slot in #897 and takes the role already there — the caption is one column whatever fact is in it |
| blockage count, mono | `ArgoTypography.machineCaption` | the same role again (#896), not `badge`: `badge`'s 0.6 tracking sets a numeral off-centre in a capsule, and a blocker count is a machine number like the roll-up beside it |
| `HIGH`, `BACKLOG`, section captions, 10 uppercase | `ArgoTypography.sectionLabel` | the role's documented job — "sidebar and rail group labels" |
| view name, 12.5 | `ArgoTypography.rowMeta` | snapped DOWN to 11: a view name is chrome, and it must not compete with a ticket title beside it |
| toolbar heading, 13 semibold | `ArgoTypography.windowTitle` | exact tuple |
| toolbar sub-line, 11.5 | `ArgoTypography.rowMeta` | exact |
| toolbar control label (`Start`), 12 medium | `ArgoTypography.control` | exact |
| hero title, 13 medium | `ArgoTypography.rowTitle` | exact |
| chips and label chips, 10.5 | `ArgoTypography.badge` | exact |
| hero empty-tier sentence, 12 | `ArgoTypography.rowMeta` | snapped DOWN to 11, the same direction as the view name above it: the sentence is why there is no ticket, not a ticket (#817) |
| urgent chip border, amber at .28 | `state.rim(attention)` | snapped UP to .5 — the named role for a state hue drawn as an edge rather than an ink (#817) |
| ticket id, mono 12 | `ArgoTypography.machineCaption` | snapped DOWN to 11 — see the ramp note below |
| ticket title, 17 semibold | `ArgoTypography.sessionTitle` | exact tuple; the role's doc-comment says "a Session's own title" and needs its scope widened to the deck's largest line |
| provider status word, 12 | `ArgoTypography.rowMeta` | snapped DOWN to 11 — see the ramp note below |
| Argo bucket, mono 10 uppercase | `ArgoTypography.machineCaption`, lowercase | the uppercase is dropped: uppercase machine at 11 reads as loud as the word it is filing |
| Delivery number, mono 11.5 medium | `ArgoTypography.machineEmphasis` | exact |
| fact values (`high`, `task`), 12 | `ArgoTypography.rowMeta` | snapped DOWN to 11 — see the ramp note below |
| `No Delivery yet`, `Every child is closed.`, 12 | `ArgoTypography.rowMeta` | the same |

### The ticket pane's ramp

Every row above snapped to a legal role, and nobody counted how many landed on ONE pane. The
answer was nine roles at five sizes, and it read as jitter rather than as hierarchy: 11 and 12 and
13 are not three levels of anything, they are one level drawn three ways.

**The pane sets four sizes, and `control` is not one of them.** `control` is "toolbar and vessel
controls" — the pane holds none, so every use of it here was a role borrowed for its size.

| what | role | size |
|---|---|---|
| the title | `sessionTitle` | 17 semibold |
| prose, and the headings over it | `body` / `bodyHeading` | 13, weight is the whole difference |
| every uppercase key | `sectionLabel` | 11 semibold, tracked |
| every value, and every link title | `rowMeta` | 11 |
| every machine string — the id, the bucket | `machineCaption` | mono 11 |
| label chips | `badge` | 10 semibold |

11 carries the most because most of the pane IS metadata. What separates a key from a value at
that size is the uppercase and the tracking, not a point of size nobody can see.
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
  session-less` — none of the five exists; `ArgoEngine/Ticket/` (#763) reads a title for a
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
