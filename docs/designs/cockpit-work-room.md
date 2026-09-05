<!-- status: approved
     approved-at: c0e24739
     prototype: worktree-prototype-609-work-room -->

# The Tickets room

> **Renamed by #881 · 2026-08-28:** this room was called **Work** when the design was approved.
> The room, its symbols and its specimen names now read **Tickets**; this file, its `.html` and the
> `work-room/` renders keep their names, because six other docs and the design's own provenance
> cite them by path.

> **Stale on the toolbar and the query · 2026-09-04.** The app has moved past this file in the
> region #1293 touches: the two-line heading is in the list pane, not the window's row (#836);
> the Filter button is gone (#900) and so is Start's Mode chevron (#1232); Next-up is in the
> sidebar; and the field now takes a query, with a `Searching` heading, rails and a stated empty
> that this file never drew (#873). Re-basing it is #1304. Until that lands, read the
> toolbar and the query here as history.
>
> **The asking surface has its own design.** A natural-language question about the backlog is
> [`cockpit-backlog-question.md`](cockpit-backlog-question.md) (#1293) — the field when it holds
> a question, and the sheet the answer draws on. This file's **the two narrowings, decided** is
> unchanged and is what that design is an addition to.

The approved design for the **Tickets room** (#609) — the views sidebar, the backlog list, the
ticket detail, the Next-up hero, the panes' headers, its empty and degraded states, and the
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
  **Amended #1074: a count may state what it is SHORT by.** `In progress` rests on the roster
  join, and #894 made one live Session Argo could not place blank the number entirely. Every real
  machine carries one — a review Session on `main`, a `worktree-<name>` branch, a headless run —
  so the number never appeared at all, and a reader could not tell "I could not tell" from "the
  feature is broken". The row now draws the count and, inboard of it, `n unplaced` — how many live
  Sessions named no ticket — on the machine caption in `text.tertiary`, the count's own ink.
  **It is WORDED and not a mark**, for the reason #939 gave against the blockage capsule's bare
  numeral: two numerals on one row read as two counts, and no glyph says *the number beside me is
  short*. **Two words and not three**: `n Sessions unplaced` truncates the view name at 280, so
  what could not be placed is the hover sentence's to say. **`text.disabled` is wrong here and was
  measured so** — 1.12:1 against this rail's row ground, a 3/255 step findable only at 3× — and no
  rung sits between it and `text.tertiary`, so subordination is carried by position and by being
  words beside a numeral rather than by a fourth grey. The whole sentence — which names the repair,
  a branch that says which ticket the work is — is the hover and the spoken label.
  **Absent is kept for the case that is
  genuinely nothing**: no Ticket provider bound, so no join happened and there is no partial
  answer to state. The two are `TicketClaims.unplaced` and `TicketClaims.unread`, and only the
  view whose ground is the claims carries either.
- **`Closed` — a fifth view, and the only one not defined over the open set. Added #1075.** The
  four above are filters *within* the open set, so "what did I finish this week" and "was #895
  ever resolved" had no answer in the cockpit at all. It is a fifth rail rather than a `Resolved`
  and a `Ruled out`: those are two answers to two questions, but a `closedUnreadably` ticket
  belongs to neither and would have to be dropped or given a sixth rail. **One view, and the row
  states which** — `resolved`, `ruled out`, or `closed` where the port could not read which of the
  two it was. See **the closed list** below for what it costs and what bounds it.
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

### The trailing region — three marks, and the precedence between them

**Amended #896 · #897 · #1074.** The row shipped with one trailing fact and one dot. Three tickets
then proposed a mark for that one slot without reference to each other — a blockage count (#896), a
date (#897), and a `claimed` mark (#894, withdrawn). A row grows four marks nobody designed together
exactly that way, so the region is settled here, once, and a fourth fact has to be placed in this
order rather than race the others for the position.

**The region holds at most three marks, in this order: the claim mark, the blockage mark, then the
caption.** All three sit after the label chips, all three are rigid, and none of them displaces the
title — the title is still the only thing the row squeezes.

**The claim mark is #894's, un-withdrawn (#1074).** It was withdrawn as a fourth mark nobody had
placed; it comes back placed. Without it the only surface in the whole room that says a ticket is
claimed is the detail pane's bucket line, one ticket at a time, so a reader scrolling the list
cannot tell a claimed ticket from an untouched one — and this is the one bucket a provider can
never supply, `TicketState` being computed and GitHub carrying open/closed only.

**It is a glyph and nothing else.** The blockage mark carries a count because blocked by three and
blocked by one are different distances from startable; claimed has no such degree — a ticket is
somebody's or it is not — and a `1` in a capsule would send a reader looking for the row that
reads `2`. **The glyph is the sidebar's `In progress` mark**, `ArgoSymbol.inProgressView`, for the
reason #939 fixed one glyph for `Blocked`: the rail says "4 in progress" and these rows are the 4 it
counted. **Its ink is `state.running`** — the Route's own word for a turn in flight, which is
exactly what makes a ticket claimed. No ground and no capsule behind it: a row's state is carried
by its ground, and this row's ground is spoken for by selection.

**It sits inboard of the blockage mark**, which keeps every already-blocked row drawn exactly where
it was — the same courtesy #896 paid the caption.

**Claimed and blocked are drawn together, not chosen between.** They answer different questions —
*is somebody already on this* and *can it be started* — so a row that is both carries both. The
`claimedTicketsBacklog` specimen exists to render that row, because the main fixture claims only
unblocked tickets and a case no render reaches is one nobody has looked at.

**The blockage mark does not contend.** It answers a different question from everything in the
caption: *can I start this*, rather than *what is this* or *how long has it sat*. A row that is both
blocked and stale therefore draws both, and the count is a count rather than a flag — blocked by
three and blocked by one are different distances from startable.

**The mark is the glyph alone (amended #1074).** It shipped as a bare numeral in a capsule, gained
a leading glyph in #939, and now sheds both the capsule and the numeral. The count is the *pane's*,
where `Blocked by · 6` states it against the blockers it can name; on the row it was a number a
reader could not act on, and it made the mark that answers *can I start this* heavier than the
claim mark that answers *is somebody on it*. The count survives in the hover and in what the row
speaks. **The two marks in this region are now one glyph each**, which is what lets a reader scan
the column at all.

**The glyph is the one the sidebar's `Blocked` view draws** — `ArgoSymbol.blockedView`. #939
settled that they are one constant for both surfaces; #1074 changes the shape to
`slash.circle.fill`, **filled** like `All open` and `In progress`, `nosign` having no fill variant
of its own. The sidebar says "8 blocked" beside that mark and the rows are the 8 it counted, so two
glyphs would be two concepts to a reader who has to learn they are the same one. One concept, one
mark, and one edit moves both.

### The rail and the row are one ink, too (#1074)

**A view's glyph and the row mark counting into it draw in the same colour**, `TicketsView.ink` —
the same rule #939 fixed for the shape, for the same reason. Agreeing on shape while disagreeing on
hue is the two concepts again.

| View | Ink | Why |
|---|---|---|
| `All open` | `text.tertiary` | marks nothing in the list, so there is no ink to agree with |
| `Unblocked` | `text.tertiary` | the same: an unblocked row is deliberately unmarked |
| `In progress` | `state.running` | the Route's word for a turn in flight, which is what a claim is |
| `Blocked` | `state.failure` | **amended #1074**; it was `state.idle` |

**A view that marks nothing takes no colour.** Colour on the rail means *there is a mark like this
in the list*, so spending an ink on `All open` or `Unblocked` would state something the list never
says.

**Stranded is `text.disabled`, not a second red.** The palette holds one red and `Blocked` now
spends it. That is the right way round: a stranded edge can never satisfy itself, so the row is not
waiting for anything, and struck-out reads truer than a louder wait. It also means the two states
are told apart by value rather than by hue, which survives a reader who cannot separate the two
reds.

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

**~~The mark's ink is the Route's, unchanged.~~ Superseded by #1074** — see *The rail and the row
are one ink* above. Waiting was `state.idle` and stranded `state.failure`, on the reasoning that
seventeen blocked rows must not read as an emergency on day one. The rail is what changed that: a
`Blocked` glyph in the sidebar's neutral said nothing next to `In progress`, and matching the rail
to the row is what the pair is for. Blocked is `state.failure` on both surfaces and stranded is
`text.disabled`. No palette role is added, and the reasoning survives inverted: the loud state is
the one you can act on, and the one nothing will clear is the quiet one.

**None of this is a leading accent.** The region is trailing, and a selected or current row is still
carried by its ground alone.

### The closed list (#1075)

The `Closed` view's list is the one place the room's own structure changes, and everything below is
why.

**It is flat, and ordered by last touched — not banded by priority.** Priority banding and recency
cannot both be a list's structure; that conflict is settled one way for the open views above and
the other way here, because a closed ticket's priority is a fact about work nobody is picking up
and last week's finished work scattered across `HIGH`/`MEDIUM`/`LOW` answers nothing. **The heading
says so**: `Closed · by last touched · 50 tickets`, on the same rule the middle term has always
carried — a subtitle naming a grouping the list does not have is the exact lie the second line
exists to prevent.

**Last touched, and never *closed at*.** No adapter reads a closed-at date (#897); `Ticket.updatedAt`
is the only date any of them serves, and the heading names the one that is real. Both providers are
asked to sort by it — `sort=updated&direction=desc`, `orderBy: updatedAt` — so the page boundary and
the row order are the same order. A row the provider served no date for sinks below every dated one
rather than claiming a recency nobody established.

**It is bounded at one page of 50, with a `Load more` row at the foot.** The closed set is
unbounded where the open set is not, so something has to stop it being the whole repository's
history. The row is drawn only where the provider served a cursor and goes when it serves the last
page — a `Load more` that survived the end of the list is the control-that-does-nothing this room
keeps refusing (#900).

**Each row states its own closure**, in the trailing region beside the caption: `resolved`, `ruled
out`, or `closed`. A word and not a glyph — a pair of marks a reader has to learn is a worse way to
say a difference the language already has two words for, and the third case has to be able to claim
neither. It takes `text.tertiary`, the same demotion a search rail's title takes. No palette role is
added, and `state.failure` is not spent here: a ticket somebody decided against did not fail.

**Nothing else in the room moves.** `Unblocked`, `Blocked`, `In progress`, `All open`, the priority
bands and the Next-up hero are all still defined over the open set alone — the hero especially,
which answers "what should I pick up" and must never offer something finished.

**The read is the view's, not the poll's.** Opening the view reads its first page; the minute
cadence never touches it. The closed set is large, it is not needed to answer "what should I pick
up", and the room already opens on round-trips it apologises for (#888). It asks for **no edges**
where an edge costs a request — which is GitHub, where a closed row therefore draws no blockage
mark and no roll-up. That is the correct absence rather than a `0/N` nobody established. Linear
serves children and dependency edges inside the issue fragment itself, so a closed row there does
carry them: each provider states what it actually read, which is the degrade-down rule and not an
inconsistency to iron out.

**The count is absent until that read has answered**, on the same rule `Blocked` follows over
unread edges (#820). Opening onto `0` is the number that tells a reader they have finished nothing.

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

## The toolbar — every pane carries its own header (#1242)

**Amended #1242, and this reverses the section that stood here.** There is no window-wide row in
this room. Each pane draws its **own** header, and the three sit on ONE band at the height the
window already spends on its title strip. What stood here before — "Mail puts every control in
the window's one toolbar row, and places each by what it acts on" — is kept in **the column
question** below as the third of four answers, because the reasons it was right for are the
reasons the fourth answer has to satisfy.

**The rule, and it is readable off the screen without knowing it:** *a control sits at the leading
edge of the pane it acts on, and a field sits at the trailing edge of the pane it searches.* That
is the whole rule. #836 failed because its rule was legible only to somebody who already knew it;
this one is legible because there is nothing else on a pane's band to confuse it with.

| position | control | scope | drawn by |
|---|---|---|---|
| the sidebar's band | nothing but the traffic lights' zone, kept clear | — | the window |
| leading the list pane's header | **New ticket**, one mark in a circular container of its own | the call-to-action — the one thing this window creates | the list pane |
| trailing the list pane's header | search | a real field at 210, not an icon that becomes one | the list pane |
| under the header, in the list | `Backlog` and, under it, `All open · by priority · 12 tickets` | says what you are looking at, and how many | the list pane |
| leading the ticket pane's header | `▶ Start` and the command it will send, in ONE pill | the ticket's own verbs | the ticket pane |
| on the ticket's id line | `#607`, as a link | the ticket's address | the ticket pane |

**The Project scope stays a `.navigation` toolbar item.** It is the WINDOW's scope, not a pane's,
and `.navigation` already draws it over the sidebar — which is the leading edge of the thing it
scopes. Only the DECK's two panes stop being toolbar items. Nothing about this room touches
`ShellToolbar`.

**The ordering menu is deleted with the row that carried it (#1242).** It opened onto one row,
`Group by priority`, which #900 had already demoted from a button to a stated fact because there
was no second thing to group by. A menu whose only content is a sentence is a sentence behind a
click. It returns the day a port reads a second grouping, which is #388 — and `ArgoSymbol.backlogMenu`
goes with it, so nothing can draw the mark again without first naming what it offers.

**Every render in `work-room/` and `cockpit-work-room.html` predates this and draws the window
row** — as with the Mode menu #872 cut and the funnel #900 cut, they are superseded on the row's
placement and remain the spec for everything else in the frame. The primary source for this shape
is `prototypes/ticket-verbs-prototype.html`, which measures itself.

**The two link verbs are deleted too (#1242).** `open on host` and `copy link` were two unlabelled
marks saying what the ticket's own number already says. The number becomes the link — `#607` in
`interaction.accent` on the head's id line, the ink this app spends on every other route — and copy
is the browser's own gesture on a link, not a second mark beside it. This does not weaken "nothing
in this room is behind an unlabelled control"; it removes two unlabelled controls.

**A title without its count can lie about what you are filtered to**, which is why the heading is
two lines and Mail's is too (`Searching / Inbox — …, 11 results`).

**The middle term names the grouping in force, so it is absent until there is one.** A subtitle
reading `by priority` over an ungrouped list is the exact lie the second line exists to prevent, so
the term arrived with the headers that justify it (#819). Through #812 and #814 — nesting is not a
grouping — the line read `All open · 12 tickets`.

### The column question, settled four times (#836, then #1242)

**Read this section as a history.** Three answers were tried and each was wrong in its own
direction; the fourth is at the foot, and it is the one that ships. The three failures are kept
because the fourth has to answer all of them, and a doc that deleted them could not show that it
does.

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

**The third answer put every control back in the window's one row, in scope order left to right**:
the list's own, then the one thing the window creates, then the open ticket's verbs, then search at
the trailing edge. That is Mail's own row read literally, reached by giving up the column boundary
rather than by claiming it, on the premise that the boundary was never the point and one legible
row was.

**And the premise was false, which is what #1242 measured.** The ticket's verbs act on ONE ticket,
and that ticket is in the trailing pane. In a window-wide row the verbs' position is measured off
the window's trailing edge; the pane's leading edge is measured off a seam the reader can drag.
Two independent numbers, coinciding by luck. The prototype measured the luck: the cluster sat
**+42 inside the pane** at the 1280 window with the seam at rest, and **−116** at every floor —
over the list, beside the list's own heading, which is the screenshot on #1242. A control that is
over the thing it acts on only at one window width is not placed by scope. It is placed by
accident.

**The fourth answer: each pane draws its own header, and the three sit on one band at the height
the window already spends on its title strip.** The ticket's verbs are over the ticket **by
construction** — the header is the pane's, so there is no arithmetic to get wrong and no seam to
be out of step with. The list's compose mark and its search field are the list pane's, on the same
band, for the same reason.

**This answers #836's two failures, which is the bar it had to clear.**

*Height.* #836's bands cost each pane 44pt because they were drawn **under** the title strip. These
are drawn **in** it: the deck climbs past the safe area to the window's top edge, which
`DeckCanopy` already does today with `reach: window.safeAreaInsets.top` — the Session's title is
drawn by the detail pane and lands in the toolbar band. The strip is spent either way, so no pane
loses a line. **This is the load-bearing difference between the two shapes, and if the band is ever
drawn below the strip it has become #836 again.**

*Three heights of marks.* #836 put the same family of marks at three heights and left the reader to
infer a scope rule from their positions. There is one height now — one band — and one rule stated
above the table: a control sits at the leading edge of the pane it acts on. What made the rule
unreadable was never the height; it was that a filter mark and a compose mark and a chevron all
look alike and none of them says which column it means. So the room stopped relying on the marks to
say it: **the list's band holds one mark and a field, the ticket's band holds one pill, and the
sidebar's holds nothing.** There is nothing on a pane's band to mistake for another pane's control.

**What it costs, and this is a real cost, not a rounding.** The row stops being `ToolbarItem`s, so
the search field, the compose button and the drag region become the app's to place, and the traffic
lights' zone has to be kept clear in the sidebar's band. `.principal` stays closed for the reason
`ShellToolbar` records. The trade is accepted because the alternative is a control that is over its
subject at one width — and #816 and #836 each spent a ticket learning that the geometry does not
bend.

The heading stays in the list pane, under the band. It is not a control: it says what the list is
and how many, and words about a column belong over that column.

**When the window cannot afford three columns, the LIST is what yields.** 520 is where the list
rests; since #844 it is neither a ceiling nor a floor, because the seam between the panes is the
reader's to move (see **the seam between the panes**). Below 520 the pane narrows and titles
truncate at the tail, which they already do. The ticket pane keeps `ArgoLayout.feedMinimumWidth`
320 and its prose re-wraps to whatever it is left. A clipped title is a title you can still read
the start of; a ticket pane
squeezed under its own controls is a control you cannot reach at all. Every control in the room is
present and whole at `windowMinimumWidth` 960. The width that yield stops at is the seam's floor
now — one number, named once in `ArgoLayout.backlogWidths`.

**~~Search sits over the ticket but searches the list.~~ Amended #1242 — it sits over the list it
searches**, at that pane's trailing edge. It was over the ticket only because the row it was in ran
the window's width; a field that narrows one column while standing over another was the same
mis-placement the verbs had, and it goes for the same reason.

**The band paints nothing, and every container on it is one height.** `pane-headers.png` is the
arrangement as built, from `prototypes/ticket-verbs-prototype.html` variant H. Two things the
first build got wrong and the render caught:

- **No ground and no rule.** The window's chrome is one sheet from the top edge to the single
  hairline where it stops. A band per pane wearing that same modifier drew the sheet three times —
  a hairline under every header, and the one bar broken at each column seam. The band lays its
  controls out and paints nothing.
- **One container height, `ArgoControlBox.vessel`.** The compose circle, the `Start` pill and the
  search field are the same object at three widths. The field had named a 28 of its own, which is
  the per-surface measuring #1243 removed from the icon box; it is gone the same way.

**New Session is not in this room's band (#836).** Mail's window creates one kind of thing and
spends one compose mark on it. This room creates a ticket, so `ShellToolbar` draws New Session in
every other room and `⌘N` and the menu bar reach it from this one. Two compose marks a finger
apart, each making a different thing, is the confusion the plus was originally chosen to avoid —
removing one of them is the better answer than re-cutting the mark.

### The two narrowings, decided (#873)

**Amended #900 — the two are the sidebar's view and the query.** They were the field and the
funnel; the funnel is gone, and why is at the foot of this section. What the heading says is
unchanged, because the funnel never reached it.

Both narrow the SAME list, so they are decided together. Deciding one alone gets two narrowings
that do not compose, and the reader meets a list nobody can account for.

**They compose by intersection, in one fixed order, and neither ever widens.** The sidebar's view
chooses the set, the query narrows within it. The heading reads in that same order, so what is on
screen can always be read back off it.

#### Search matches the number and the title, and nothing else

**The query is a substring of the ticket's title, or of its number** — case- and
diacritic-insensitive, and a leading `#` on a number is optional. A field holding only spaces is
not a query: it returns the whole list rather than matching everything by accident.

**Not the body.** A ticket's body is read only for the ticket the deck is open on, so a body match
would return a different set for the same query depending on what the reader last clicked. A search
whose answer depends on what you clicked is worse than one that never reads a body at all.

**Not labels, type or assignee.** Those are closed sets of the provider's own words — the facets a
funnel would have offered as rows, and the search field is not the place to fold them in. A query
that also matched them would exclude tickets on words the reader never typed, and nothing on screen
would say which fact did it. **Amended #900:** the funnel that was to own them is gone, so today
nothing narrows by them at all — which is a room with one narrowing missing, not a room with a
control that lies about having it.

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

#### The funnel is deleted (#900)

**It drew a live mark and did nothing.** `line.3.horizontal.decrease` shipped in the list's vessel
bound to an empty closure — no sheet, no popover, no state written and nothing downstream reading
one. Pressing it produced no response of any kind. That is worse than no control at all: it costs a
reader a click and a theory about the room every time they meet it, and the room's own inventory
said nothing was wrong, because a mark drawn is a mark somebody assumes is wired.

**Its facets were named here and never built.** This section used to specify label, type and
assignee — the provider's closed sets — with `status` ruled out (the sidebar's four views are
already the cut across closure, claim and blockage, and `status` is the provider's own word with no
fixed vocabulary behind it) and `priority` ruled out (it is the grouping in force, so narrowing by
it removes headers rather than rows). Those exclusions still hold for any future facet control. The
inclusions were never wired to anything, in either direction: nothing wrote a facet and nothing read
one.

**So the mark goes rather than the specification growing a filled state.** A funnel that looks
identical whether or not it is narrowing makes a false claim about the data — but a funnel that
narrows nothing at all makes a larger one, and the honest repair for an unbuilt control is to stop
drawing it. `ArgoSymbol.filterBacklog` is deleted with it, so nothing can draw the glyph again
without first naming what it filters by, here.

**What the room keeps is the two narrowings above**, which do compose and are both live. **The
renders in `work-room/` and `cockpit-work-room.html` predate this and still draw the funnel** — as
with the Mode menu #872 cut, they are superseded on this one mark and remain the spec for
everything else in the frame.

**Its neighbour was made a stated row in the same pass.** `Group by priority` was a `Button` over a
closure the shell never assigned — the funnel's fault one level down, inside the menu rather than
on the row. With one grouping there is no choice to offer, so the menu draws it as text: the state
in force, said once. It becomes buttons when a port reads a second thing to group by (#388).

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

**Amended #941: the rung a ticket starts on is `Auto`, not `Code`.** `Code` asks before anything
leaves the Workspace, so a ticket-started Session met a Permission on its first command outside it
— a question the reader had already answered by pressing `Start` on that ticket. The rung is
`WorkCommand.startingMode`, beside the mapping that resolves the command, because "what does this
ticket start as" is one question with two halves and one home. It applies to every ticket-started
Session, including the one that resolves to no command and opens an empty composer: it was still
started on a ticket.

**A Session the user starts BY HAND is untouched.** It opens on the rung last picked (#629), and a
ticket's `Auto` is never filed as a pick — only a rung chosen on a live Session is.

~~The two link verbs that would otherwise have hidden in that ellipsis — open on the code host,
copy link — are icons beside `Start`, past a hairline.~~ **Deleted #1242** — see the toolbar
section. The number is the link.

### `Start` is ONE pill, and the command in it is the picker (#1242)

**`Start` and the command it will send are one capsule, not two controls side by side.** The pill
is the control; the word and the token are its segments, at `ArgoSpacing.hair`. Inside it `Start`
draws no ground of its own — the capsule IS the ground, and a second fill inside it would be an
edge within an edge, which is the thing `ArgoElevation.vessel` already refuses on the outside.

**It answers the pointer on the neutral control ground, not in accent.** #899 spelled the command
after the word because the press has to be aimable; making the word a filled accent chip inside a
glass capsule put two grounds in one control and drew the eye to the half that is not the fact.

**The token is the picker.** Pressing the command opens the menu; pressing the word starts. The
thing you read is the thing you press to change, which is the only arrangement in which a chevron
beside a fact is not a second control over the same fact.

#### The picker offers SKILLS, and this is not #872 coming back

**#872 deleted a chevron, and it is fair to ask whether this is the same chevron.** It is not, and
the difference has to be stated here or the next reader cannot tell a reversal from a regression.

#872's menu offered **Mode rungs** — `Read Only · Plan · Code · Auto` — over a Session that did
not exist yet. Every open of it was a reader confirming the value that was already there, and the
rung is honestly changeable one place downstream, over a live Session whose rung the control reads
back. That reasoning is untouched: **`ArgoTicketsChrome` still draws no Mode picker, and the rung a
ticket starts on is still `WorkCommand.startingMode` `Auto` (#941).**

This menu offers **which skill the Session opens on**, which is a different fact with a different
shape:

- **It has more than one answer in practice.** `/implement`, `/design-to-code`, `/grill-me`,
  `/triage`, `/prototype`, `/wayfinder` — and the resolved default is a *guess off a label*, not a
  value the reader set. A guess a reader cannot override is a guess that is wrong in silence.
- **Nothing downstream can change it.** A Mode is a live property of a running CLI and the composer
  owns it. A command is the FIRST thing sent; once the Session has opened on `/implement` there is
  no control anywhere that re-opens it on `/grill-me`. This is the only place the fact exists.
- **The default is unchanged and still the press.** The word starts the resolved command, exactly
  as it does today. The menu costs nothing to anyone who wants the default, which is the precise
  test #872 applied and the precise test the Mode menu failed.

**The menu names why the default matched**, so the guess is inspectable rather than magic —
`/implement · nothing refuses it`, `/design-to-code · the screen has a design`. It ends with **Fresh
Session**, which opens the composer with no command in it.

#### The Session carries the ticket, whichever skill runs

**Every Session started from this room is attached to the ticket it was started on**, and the menu
says so in its own foot. That is what makes the picker worth having: the agent has the ticket in
context, so `/grill-me` grills *this* ticket, `/triage` triages *this* ticket, and a Fresh Session
opens already knowing what it is about.

The attachment is the Session's, not the command's. A Session opened with no command carries the
ticket too — it was still started on one, which is the same reasoning #941 used to give the
no-command case the same starting rung as every other.

### The marks, re-cut

The study's glyphs were read back and three of them named nothing a reader recognised, so they
were replaced. **A toolbar mark is not a place to be inventive**: the row is chrome, and chrome
that has to be learned costs more than the space a familiar mark saves.

| control | was | is | why |
|---|---|---|---|
| Start | `bolt` | `play.fill` | a bolt reads as speed or as power; neither is the act. Play is the one mark every transport control in the OS uses for *begin* |
| New ticket | `square.and.pencil` | `plus`, then **`square.and.pencil` again (#836)** | the compose mark was given up to keep it off the same row as New Session. #836 took New Session out of this room instead, so the mark is free and this is the one thing the window creates — which is exactly what Mail spends its compose mark on |
| Group by | `list.bullet.indent`, then `rectangle.grid.1x2`, then an `ellipsis` menu (#836) | **no mark at all (#1242)** | all three were answers to "how do we draw a control offering one option". The answer is that you do not draw it. `ArgoSymbol.backlogMenu` is deleted with the menu, so the mark cannot return without a second grouping to put behind it (#388) |
| Open on host, Copy link | `arrow.up.forward.square`, `link` | **no marks at all (#1242)** | two unlabelled glyphs saying what the ticket's own number says. `#607` is the link, in `interaction.accent`; copy is the browser's gesture on a link |

Filter kept `line.3.horizontal.decrease` — a funnel is the one glyph here nobody had to learn, and
it is Mail's own. **Deleted #900**: the mark was never the problem, and a familiar glyph over an
empty act is a worse trade than an unfamiliar one over a real act. See **the funnel is deleted**
above.

~~**An `ellipsis` menu is not the unlabelled overflow this design rules out.**~~ **Moot #1242** —
the argument was sound and the control it defended is gone anyway. It stands for the skill picker,
which is the one menu this room still draws: a named control with named rows behind it, opened by
pressing the fact it changes, is not the system's last-resort overflow.

**The filter/group capsule took a rule between its two marks.** Sharing a vessel with no divider
made a pair of unrelated acts read as one unfamiliar control, and it took a hairline to fix.
**Amended #900**: with the funnel gone the list's vessel holds one mark, and the rule went with the
pair it was there to separate. **Amended #1242**: `Start`'s rule goes too, and the reason is the
opposite of #900's. A rule separates two acts that happen to share a vessel; `Start` and the
command it will send are **one** act said in two halves, so a rule between them would divide what
the pill exists to join. `vesselGap` is the whole seam a segmented control needs.

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

**A card at the foot of the sidebar's scroll, below the views.** Its border stands on the rail's
own `railInset`, the vertical the marks above it and the rule directly over it are read down; it
sits on `surface.raised` and carries an `edge.subtle` border at `ArgoRadius.control` — three
things a view row has none of, which is what stops it reading as another view. **Amended**: the
card was inset a further `ArgoSpacing.base` inboard of that rule, which read as a fourth left edge
on a rail that already had three.

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
five different jobs is a press nobody can aim. **Amended #1182: a ticket reads `Start` alone, and
opens an empty composer, only where its labels SAY it is not build work.** Everything else, an
unlabelled ticket included, sends `/implement`. The empty composer was written as the answer for
decision tickets and became the answer for most tickets, because roughly one ticket in six here
carries no labels at all; a Start that reliably did nothing is not a more honest answer than a wrong
one, it is an indistinguishable one.

**Two sets refuse, and they sit either side of the build labels**, because "never" and "not yet"
are different claims:

- **Not an agent's work at all** — `wontfix`, `duplicate`, `invalid`, `ready-for-human`. These
  **outrank** `bug` and `enhancement` beside them: 3 tickets here carry `ready-for-human` next to
  a build label and 2 carry `duplicate`, and starting an agent on a duplicate or on work a person
  reserved is exactly the wrong-work failure the empty composer exists to prevent.
- **Not settled yet** — `question`, `needs-triage`, `needs-info`, `wayfinder:research`. These
  **lose** to a build label beside them. `needs-triage` rides along on about fifty of this
  tracker's build tickets, so ranking it above them would re-create the fault #1182 reported.

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

**Amended #1242: the id IS the link, and it is drawn as one.** `#607` takes `interaction.accent`
and opens the ticket on its code host — the ink this app already spends on the claimant line, the
Delivery chips and every other route out. It replaces two unlabelled marks that said the same
thing from the toolbar; the number was always the address, and the room was spending a glyph to
repeat it. **Where the Binding cannot address the ticket in a browser at all** — a Linear team id
names no page, which is what `TicketAddress` returns `nil` for — the id stays `machineCaption` and
is not a control. Drawn as a link and inert is the fault #872 is about; drawn as a fact is the
truth.

**Amended #1092: the head names its live claimant.** A fourth line, under the status pair, in the
same `headStep` rhythm the three above it already keep — no new measurement, because the head's
own spacing already fits a fourth child. It is the ticket's own route to the Session working it,
the join `TicketClaims` carries since #1092 widened it from a bare count to a claimant.

One claimant is a route: the diamond `ClaimMark.symbol` — reused rather than a second glyph for
"a live Session is on this", #939's own rule — beside the Session's name, both in
`interaction.accent`, the ink this app spends on every other link. Pressing it does what
`TicketStart.run(on:in:)` already does after a spawn: `navigation.session` then
`navigation.room = .sessions`, the established gesture and not a second one.

Two or more claimants still refuses to pick one: `n Sessions are on this`. Naming one of the two
silently would be a claim nobody made, and `Ticket.oldestFirst`'s tie-break is the wrong tool here
— that order settles a contested PARENT edge, a different question, and borrowing it would give one
rule two meanings.

**Amended #1092: the count opens onto the list.** Stating a number a reader cannot act on answers
half the question — it tells them two Sessions are on this ticket and leaves them to find both by
hand, and says nothing about which is working. So the count is a button in `interaction.accent`
like the single claimant above it, and it opens a popover: one row per claimant, each a route of
its own, each led by `SessionStateIndicator` — the roster's own state dot, in the roster's own ink,
so the list answers "which one is running" with the mark that already means it everywhere else. No
new vocabulary: the dot is `SessionState.role(for:)` and nothing invents a word for a state the
status vocabulary spends none on.

No claimant draws no row at all — not an empty one, the same absence rule the rest of this head
already follows.

**The provider's word and Argo's bucket, without a contradiction.** The word is set verbatim in
`control`; the bucket follows it behind a 10pt hairline divider, in lowercase machine caption on
`text.disabled`. The two read as a label and its filing, not as two competing claims.

**Amended #893: the pair degrades to the word alone where the bucket only repeats it.** On GitHub
the word IS the filing — the head read `open | open`, spending a divider on one bit. The bucket is
drawn beside the word only where it says something the word cannot, which on a two-state provider
is `claimed`, the filing no provider carries. `Bucket` keeps its labelled home in the fact strip;
what the head drops is the restatement, not the fact.

**Amended #1074: `open` never earns the second slot.** #893 tested for the same *word*, which left
every provider whose open word is not the string `open` still drawing the pair — a head read
`In progress | open`, two words for one bit and the second of them dimmed. An open ticket is in an
open listing, so filing it under `open` restates the room the reader is already standing in.
`resolved`, `ruled out` and `claimed` still draw: each says something the provider's word cannot.

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
quiet with it, and **the panes' headers go with the panes**: there is nothing to create into, and
no pane left to draw a header on.

**An empty backlog is a different page.** The provider answered, and the answer was nothing. The
sidebar and its views stay (all reading zero), the hero shows the backlog-clear tier, and the
deck says who answered. Conflating the two would tell a reader their backlog is empty when in
fact nobody asked.

**A third empty, and it is the opposite of the second. Added #1075.** `Closed` has a nothing of its
own: the read answered, and this Project has never closed anything. It says so in its own words —
*nothing has been finished*, rather than *nothing is left to do*. Conflating it with the empty
backlog would let one page state the exact reverse of the other. Before that read has landed the
view is `unread` instead, which is the same page the poll's own silence draws and for the same
reason.

**The empty backlog keeps New ticket.** It is the moment you most want it. The list's ordering menu
goes, and so does search — there is no list to order and nothing to search.

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
- The Route replaces both deck panes and carries its own head, so **both pane headers go with the
  panes they belong to** — which is the shape doing what it says: a header that survived the pane
  under it would be a control over nothing.

`route.png` is shot at a 1600 window rather than 1280, because #334's canvas **widens when the
work needs room** rather than compressing to fit.

The Route's own component names stay #334's to freeze. This design does not name them.

## Measurements

Surface sheets, beside the surface, per `rules/swift.md` — a measure is not a token.

### `ArgoTicketsSidebar` — `ArgoUI/Shell/Tickets/Sidebar/`

| Measurement | Value | Reason |
|---|---|---|
| Sidebar width | `ArgoLayout.sidebarMinimumWidth` **280** as the room's *ideal* | at 320 the list drops to 480 and three of twelve titles truncate; the one shell change this design asks for |
| `viewRowHeight` | **26**, a FLOOR not a frame | macOS scales sidebar row height with the reader's own setting, and a frame would refuse it — the same reason `rosterFootMinimumHeight` is a floor |
| `glyphWidth` | **14** | every view name starts on one vertical |
| `railInset` | `ArgoSpacing.loose` 16 | **Amended.** The rail's ONE horizontal inset, so the mark, the rule, the card's border, the counts and the foot's chip are read down two verticals. OBSERVED, not documented: it is the inset `.listStyle(.sidebar)` gives its rows' content, measured off the `ticketsRoom` render. A row spends nothing to sit on it; only what is outside the `List` spends it by hand. If AppKit moves it the foot drifts off the rows and no gate sees it — a `/pixel-review` catch |
| `heroTopInset` | `ArgoSpacing.base` 8 | **Amended**, and renamed from `heroInset`: the hero card off the rule above it, VERTICAL only. Its left and right are `railInset`; a horizontal step here put the card a second inset inboard of that rule |
| `heroPadding` | `ArgoSpacing.comfortable` 12 | inside it |
| Hero radius | `ArgoRadius.control` 6 | a card, not a popover |
| `footPadding` | `ArgoSpacing.base` 8 / `railInset` 16 | around the provider chip, above a hairline |
| Section label | **14.5**, AppKit's own | the one element deliberately left off `railInset`. It is the header inset `.listStyle(.sidebar)` gives a `Section` label, and forcing it onto 16 costs a magic pad on every section to close 1.5pt nobody can see. Recorded so a later render reading 14.5 is not filed as the drift the `railInset` row warns about |

### `ArgoBacklogList` — `ArgoUI/Shell/Tickets/Backlog/`

| Measurement | Value | Reason |
|---|---|---|
| List width | **520**, where it RESTS | the smallest width at which all twelve real titles read whole at depth three; at 480 three of them clip. Not a ceiling since #844 — the reader drags the seam from here, to 760 — see **the seam between the panes** |
| `minimumWidth` | **342**, derived | what the pane gives up to when the window cannot afford 520 (#836): the narrowest window less the sidebar, less a pane of prose, less the two seams between them. Titles truncate at the tail, which they already do — the ticket pane is what must not be squeezed. Since #844 this is also the SEAM's floor, and it is named once in `ArgoLayout.backlogWidths` |
| `bandHeight` | **44**, a FLOOR | the HEADING at the head of the pane — the title and its count. A floor because the two lines are set at the reader's own type size. This measures words only. **Amended #1242**: the list's two controls sit above it in `BacklogPaneHeader`, which is the title strip and adds nothing to this number — the name stays `bandHeight` for the heading it has always measured, and it is not #836's band |
| `bandInsetX` | `ArgoSpacing.comfortable` 12 | the gutter again, so the title starts on the vertical its rows do |
| `labelsAppearAt` | **440** | the narrowest pane that still carries a row's label chips (#844). The chips are rigid, so under this they take the title's characters rather than give up their own |
| `labelLimit` | **2**, then a `+n` chip | the row DISTINGUISHES one ticket from the next; the whole set is the ticket pane's |
| `rowHeight` | **30**, a FLOOR not a frame | grew from 28 when the title snapped up to `body` 13 |
| `gutter` | `ArgoSpacing.comfortable` 12 | the row's leading inset, before the twist |
| `twistWidth` | **12** | a leaf keeps the slot, so every dot lands on one vertical |
| `indentStep` | `ArgoSpacing.loose` 16 | one level; a child's dot lands under its parent's id |
| `indentDepthCap` | **2** | level three shares level two's inset |
| `gap` | `ArgoSpacing.base` 8 | between dot, id, title and the trailing region |
| `trailingMark` | **16**, a HEIGHT floor | a trailing mark's box; every mark in the region takes it, so they sit on one vertical. **Renamed #1074** from `blockageMark`, the claim mark being the second reader of it. **Amended #939**: it was a floor on both axes, sized so one digit drew a circle. **Amended #1074**: both marks are one glyph, so the box is a height floor holding them on one vertical and nothing sets a width |

The mark's glyph is drawn at `ArgoIconSize.inline` **10** — the contract's rung for "a mark on a
line of text", beside the `machineCaption` 11 the count is set in, and the rung the sidebar draws
the same glyph at (#939). It is not a row in the sheet above: the rung is passed at the call site
and this sheet holds what `ArgoBacklogList` declares.

### `ArgoTicketsChrome` — `ArgoUI/Shell/Tickets/`

| Measurement | Value | Reason |
|---|---|---|
| Band height | **the window's own title strip** | **Amended #1242.** A pane's header is drawn IN the strip, not under it: the deck climbs past the safe area and the band is `window.safeAreaInsets.top` tall, the way `DeckCanopy` already reaches. There is no number here to disagree with the system's, and a header measured to a constant instead would be #836's 44pt band again |
| `paneHeaderInset` | the pane's **own** column inset — `ArgoBacklogList.bandInsetX` (`ArgoSpacing.comfortable`, **12**) in the list, `ArgoTicketDetail.inset` in the ticket. The 16 this row first carried was the prototype's number, never converted | **Added #1242.** A header belongs to its pane, so it starts where that pane's content starts. A control carrying its own container is judged by the CONTAINER's edge; the mark inside sits inboard by the vessel's inset, which is the vessel's business |
| ~~`listBlockWidth`~~ | **gone (#836)** | it claimed 520 inside one toolbar region to reach the column boundary, and macOS begins that region after the shell's own items. The list's controls are in the list's band now, aligned by construction — which is also what makes the pane safe to drag (#844): a band has no width to keep in step with the seam |
| ~~`iconButton`~~ | **gone — `ArgoControlBox` (#1243)** | it was 26 × 24 inside a 3pt inset, a box this room measured for itself. Four headers measured four, so the box left this sheet: it is `ArgoControlBox.icon` now — 26 SQUARE in a 5pt vessel inset — and the inset is what makes a capsule of them stand at the band's own 36. The 30pt capsule beside the shell row's 36pt circle was the whole of what looked wrong. **#1242 depends on this**: the compose CIRCLE in the list's header and the Start pill in the ticket's are one height only because both are derived from that box |
| `iconSize` | `ArgoIconSize.control` **13** | 14 was the SVG box the study drew into; `control` is the rung the contract gives "a control's own mark", and a fourth rung is a token change this room has no standing to make. **Amended #1243**: the rung is not this room's to pass either — `ArgoIconButton` draws at `control` |
| `searchWidth` | **210** | wide enough for `Search the backlog`; at 260 the trailing edge clipped at 1280 |
| ~~`searchHeight`~~ | **gone (#1242) — `ArgoControlBox.vessel` 36** | the field named a 28 of its own, which made one row of controls two heights of container. A field on this band is a container like the compose circle and the Start pill, so it takes the number they are derived from. Deleted rather than set to 36: a height nobody can write down cannot drift, which is why #1243 took the icon box off the four surfaces that each named one |
| Vessel shape | `Capsule()` | a capsule is a shape, not a radius — no `ArgoRadius` rung applies |
| Vessel material | glass, **no border, no shadow** | `ArgoElevation.vessel` is zero; the specular rim is the cue |
| ~~Menu offset~~ | **gone (#872)** | it measured `ModeMenu`'s popover, which was never implementable — AppKit positions and draws its own — and the menu it described is deleted. The skill picker's popover is AppKit's on the same terms |
| `splitDividerHeight` | ~~15~~ **gone (#1242)** | it ruled the Start vessel off the two link verbs, and those are deleted. One pill has one seam, and that seam is `vesselGap`, not a drawn rule |

### `ArgoTicketDetail` — `ArgoUI/Shell/Tickets/Detail/`

| Measurement | Value | Reason |
|---|---|---|
| ~~`bandHeight`~~ | **still gone (#1242)** | the pane carries a header again, but it states no height of its own. #836's band declared 44 and drew below the title strip, which is the line the words lost. `TicketsPaneHeader` is the window's strip, reached into — the deck's own `safeAreaInsets.top` and no constant. **A number here would be the bug returning**, because a constant cannot be the strip |
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
| `RoomStrip` | atom | `NSSegmentedControl`, via `RoomSegments` | `Sessions \| Tickets \| Code`, at the head of EVERY room's sidebar (#805). AppKit's control since #857, for `segmentDistribution` and for a mark beside a word; its selected segment is bezelled to a neutral (#944). #816 deleted the titlebar's `RoomsVessel`, so this is the window's only rooms picker and it lives in `Shell/Sidebar/` rather than under `Tickets/` |
| `ViewRow` | molecule | an `HStack` in a `List` row | glyph · name · shortfall · count, at `viewRowHeight` as a floor. **Amended #1074**: a count may state what it is short by, inboard of itself, so the numbers keep the trailing edge they are read down; and the glyph takes `TicketsView.ink` rather than a flat `text.tertiary`, so the rail's mark matches the row's |
| `ProviderFoot` | atom | an `HStack` above a `Divider` | the bound provider, at the sidebar's foot |
| `NextUpCard` | molecule | a `VStack` on `surface.raised` | the hero; carries the ticket or an empty-tier sentence |
| `NextUpChip` | atom | `Text` in a rounded rect | at most two, each earned |
| `BacklogList` | organism | `List(selection:)` with one `Section` per priority | the deck's leading pane |
| `BacklogOutline` | molecule | a `ForEach` over the flattened tree inside that `List` | the tree; children come from the child edge, not a nested array literal. **Amended #814**: it stood in for `OutlineGroup(children:)`, which cannot give the twist its own hit target, cannot let a leaf keep the slot, and hands a subtree to a control that counts rows. The projection flattens; the reasoning is in the inventory |
| `BacklogRow` | molecule | an `HStack` in a `List` row | `twist · dot · id · title · trailing` |
| `BacklogTwist` | atom | `DisclosureGroup`'s chevron, drawn | drawn rather than inherited so it can carry its own hit target |
| `DeliveryDot` | atom | `Circle` at `ArgoLayout.statusDotSize` | the five-state table above |
| `BlockageMark` | atom | a bare `ArgoGlyph` | **Added #896** as how many blockers still stand, in the trailing region. **Amended #939**: a glyph leads and names the state, which the numeral alone never did. **Amended #1074**: the capsule and the count go — the count is the pane's, and two one-glyph marks are what make the column scannable. It is `BlockageMark.symbol`, the sidebar's `ArgoSymbol.blockedView`, in `TicketsView.blocked.ink` — or `text.disabled` when stranded |
| `ClaimMark` | atom | a bare `ArgoGlyph` | **Added #1074**: that a live Session is on this ticket, in the trailing region inboard of the blockage mark. A glyph with no count and no capsule — claimed has no degree — in `state.running`. It is `ClaimMark.symbol`, the sidebar's `ArgoSymbol.inProgressView`, for #939's reason |
| `ClosureMark` | atom | a `Text` in the trailing region | **Added #1075**: how a closed row stopped being open — `resolved`, `ruled out`, or `closed` where the port could not read which. A word rather than a glyph, on `text.tertiary`. It never contends with `BlockageMark`: a closed ticket's edges are not read, and an open one has no closure to draw |
| `BacklogMore` | atom | a full-width `Button` at the foot of the list | **Added #1075**: there is another page of closed tickets, and this reads it. Drawn only on a cursor the provider served, so it cannot outlive the last page |
| `PriorityHeader` | atom | a `Section` header | label on `sectionLabel`, drawn count on `machineCaption`. **Amended #819**: it is a `List` ROW with `selectionDisabled()`, not a `Section` header — a section costs air this design has already measured, and what that trade returns and what it does not (pinning) is in the inventory |
| ~~`TicketsToolbar`~~ | — | **gone (#1242)** | the window row, and every control the room had. Three answers: #816 claimed the column boundary from one region, #836 split it into bands under the panes, then it was reassembled as one row. The fourth answer gives each pane its own header, so this room contributes nothing to `.toolbar` at all — see the column question |
| `TicketsPaneHeader` | atom | an `HStack` in the pane, reaching into the title strip | **Added #1242.** The band itself: the window's own strip height via `reach`, the pane's own column inset, a leading slot and a trailing one. **It paints nothing** — no ground and no rule. The window's chrome is ONE sheet ending in a single hairline (`ArgoChromeBar`), and this sits inside it; worn per pane it drew that sheet three times, putting a hairline under every header and breaking the bar across the column seams |
| `BacklogPaneHeader` | molecule | a `TicketsPaneHeader` | **Added #1242.** New ticket leading, search trailing. It is the LIST's, so both act on the list |
| `TicketPaneHeader` | molecule | a `TicketsPaneHeader` | **Added #1242.** The `StartControl` pill, leading, and nothing else. Empty of controls with no ticket open — it keeps its band, because a band that collapsed would move every pane beside it |
| ~~`BacklogControls`~~ | — | **gone (#1242)** | it wrapped `BacklogMenu` alone, and the menu is gone with it |
| `BacklogHeader` | molecule | an `HStack` at the head of the list pane | the heading and its count, and nothing else. **Renamed #836** from `BacklogToolbarLabel`; the controls left it when the row was reassembled. **Amended #1242**: it sits UNDER the pane's header now, which is where words about a list belong relative to the controls on it |
| ~~`TicketBand`~~ | — | **gone** | added by #836 to carry New ticket and the ticket's verbs over their column, then deleted when both became toolbar items. `TicketPaneHeader` is not it coming back: #836's band was drawn UNDER the title strip and cost the pane 44pt, and this one is drawn IN it |
| ~~`BacklogMenu`~~ | — | **gone (#1242)** | how the list is ordered. It opened onto one stated row after #900, and a menu whose only content is a sentence is a sentence behind a click. It returns with a second grouping (#388) |
| ~~`ToolbarVessel`~~ | atom | **lifted to `ArgoIconButtonGroup` (#1243)** | it grouped icon buttons in a capsule with no border and no shadow, and it did it well — but it was `internal` to this room, so every other header hand-rolled the same stack at its own size. Same shape, in `ArgoAtoms`, where the shell row and the composer can reach it |
| ~~`ToolbarIcon`~~ | atom | **lifted to `ArgoIconButton` (#1243)** | one glyph in the settled box, with the press, the tooltip and the spoken label |
| `NewTicketButton` | atom | an `ArgoIconButton` in its own `ArgoIconButtonGroup` | the call-to-action; survives the empty backlog. **Amended #1242**: one mark in a container of its own is a 36pt CIRCLE, exactly as tall as the Start pill in the pane beside it |
| `StartControl` | molecule | ONE `Capsule` with two segments | the verb and the command it will send, spawning in `Auto` (**amended #941**). **Amended #872**: it was `Button` + a Mode chevron, and that chevron is gone. **Amended #1242**: the two link icons and their rule are deleted, and the word and the command are segments of one pill rather than a button with a label — the command segment is the skill picker |
| `StartSkillMenu` | atom | `Menu` on the command segment | **Added #1242.** Which skill the Session opens on, and a Fresh Session with none. Not #872's chevron: that offered a Mode with one honest answer and a downstream control that owns it; this offers a command with six, and nothing downstream can change it |
| ~~`ModeMenu`~~ | — | **gone (#872)** | the four Mode rungs. The rung is the composer's, over a live Session (#608) |
| `BacklogSearchField` | atom | `.searchable` field | searches the list. **Amended #1242**: at the trailing edge of the LIST pane rather than of the window — it was over the ticket only because the row it sat in ran the window's width |
| `TicketDetail` | organism | a `ScrollView` | one column; no inner split |
| `TicketHead` | molecule | a `VStack` of `Text` | id, title, status pair, then the claimant line (#1092) |
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
| blockage count, mono | `ArgoTypography.machineCaption` | the same role again (#896), not `badge`: `badge`'s 0.6 tracking sets a numeral off-centre in a capsule, and a blocker count is a machine number like the roll-up beside it. The glyph that leads it since #939 is on the icon ladder, not this one |
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
