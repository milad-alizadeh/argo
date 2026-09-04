<!-- status: built
     approved-at: ad08d1d
     built-at: eb92be06
     prototype: worktree-prototype-two-row-header -->

# The two-row Session header

The approved design for the **Session deck's chrome** (#696). The shipped header stacks three
rows — the window titlebar, a 56pt identity band and a 40pt tab line — and reads clunky at the
top of every Session. This cuts it to two: the titlebar, and one 40pt tab line.

**The renders in [`header/`](header/) are the spec.** The measurements below are the numbers a
ticket must carry. Six states: `rest` under the first line, `warn` past 150k, `crit` past 300k,
`external` where the context cannot be read at all, `handoff-on-read-only` where it can but the
Session cannot be driven, and `guide` with the ⓘ panel open.

The study lives on the throwaway branch `worktree-prototype-two-row-header`
(`docs/designs/prototypes/header-two-row-prototype.html`), where the two rejected layouts are
still switchable (`?variant=B|C`). It is there to be re-explored, not built from — and in three
places noted below the shipped components already supersede it.

## What won, and what lost

**Variant A — document title plus tab line.** The Session title moves to the titlebar's centre,
where macOS puts a document title. The identity band's instruments — the context reading, its
bar, the ⓘ control and Hand off — move to the tab line's trailing edge. The band is then empty,
and is deleted. The band's fact line and the tab line's telemetry line are demoted to the
title's hover and to the ⓘ panel, where they are read at leisure rather than glanced past.

The two rejected layouts each kept a deck row. **B — one working band** merged title, tabs and
instruments into a single 48pt band under an untouched titlebar; it saved the same row but
bought back a deck-scale title at the cost of centring, and the pill tabs lost the underline
vocabulary the deck uses everywhere else. **C — ring and spine** put a 16pt conic context ring
beside the centred title and ran the budget as a 2pt rail across the deck's top edge; the rail
read as an alert bar rather than as an instrument, and a ring with no figure at rest answers
*how full* only to someone who already knows the scale.

## The two rows

**Row one is the window titlebar.** The scope capsule keeps the leading edge and the Rooms
capsule the trailing one, both unchanged. The Session title is centred against the **detail
pane**, not the window, so it never sits over the sidebar's glass. It ellipsizes at
`titlebarTitleMaximumShare`, and everything the band's fact line said rides its hover. This row
shipped in #691 and #692.

**Row two is the tab line.** Tabs keep the leading edge and their underline vocabulary. The
trailing edge takes the group named `TabLineInstruments`, in this order:

| | Member | When it draws |
|---|---|---|
| 1 | the state word — `Needs input`, `Stopped` | `permission`, `asking`, `stopped` only |
| 2 | the context instrument, 200pt, with ⓘ inside it | once a spend has been reported, `unknown` included |
| 3 | Hand off | past 150k **and** managed |

**Hand off takes the trailing edge, so the instrument slides inward when it appears.** That is
the prototype's order and what the renders show. It costs a reading that moves at the moment the
reader is watching it, and it was accepted because a remedy belongs at the trailing edge and
because the movement is itself the signal that a line was crossed.

**The ⓘ stays inside the 200pt instrument**, beside the uppercase `CONTEXT` label, where #692
put it — it annotates that label rather than the tab line. The prototype draws it outside; the
shipped placement supersedes it.

### Amended #1092: the Ticket link takes the tab line's other empty edge

The Issue row #894 built reached one surface — a line of text inside the ⓘ panel — and nothing
about it was pressable. `TabLineInstruments` is the trailing group and already spoken for; the
line's LEADING edge is where the ticket goes, ahead of the tabs zone, which drew nothing at all
until #404 built it (`DeckTabs`; it was `DeckSlot`'s own placeholder before). That is the one
stretch of this 40pt line that was empty, and it is where a reader's eye already lands first.

`SessionIssueLink` draws the three readings `TicketLinkReading` carries, the same three the ⓘ
panel's `Issue` row already draws from `row(for:)`:

- **`.link`** is a route: `ArgoSymbol.ticketsRoom` beside the label, both in `interaction.accent` —
  the same ink `FeedMarkLine`'s handoff link spends and the ticket head's own claimant line spends
  back. Pressing it is `navigation.ticket` then `navigation.room = .tickets`, the mirror of
  `TicketStart`'s own room switch and of the head's route back.
- **`.unlinked`** states the reading in `text.tertiary`. With a backlog behind it, that reading is
  also the repair — see below.
- **`nil`** (`.unread`, no Ticket provider bound) draws nothing at all, the same absence rule the
  panel's own row follows: with nothing to link TO there are no Tickets to attach.

No measurement changes: the link sets on the line at its own intrinsic width, in the same
`ArgoSpacing.loose` gap the tabs and the instruments already keep between them.

### Amended #1092: the unlinked reading is the repair, because most branches name no ticket

The route above lit up for almost nobody, and the reason is upstream of it. `TicketLink.number`
derives a Ticket from `#<N>` in a branch or from a `ticket-<N>-` worktree folder, and a checkout
named after WORDS — `ticket-hub-roster` on `argo/hub-roster`, which is how most of this repo's own
work is cut — carries neither. Those Sessions read `.unlinked`, so the tab line drew a dead-end
word, no claim was ever placed, and the ticket head at the other end had nobody to name. The route
was built and both of its ends were empty.

So `.unlinked` stops being a statement about a branch and becomes the gesture that fixes it:

- With tickets to pick from, the line reads **`Link a ticket…`** in `interaction.accent` — the ink
  every other pressable thing on this line takes. The reading it replaces is quiet because it is a
  statement; this one is an offer, and the ellipsis says the press opens a choice rather than a
  room. Pressing it opens the open backlog, newest first. Choosing writes a **pin**: Argo's own
  record that this
  Session is on that Ticket, held in `sessions.json` beside the rename, and DIRECT, because the
  reader said it.
- With nothing to pick — no backlog read, no pin to drop — it stays `Header.unlinkedWord`, the
  reading it was. A picker that would refuse every press is not drawn.
- On a **`.link`**, the press stays the route and the same picker sits on the secondary click:
  re-linking is the rarer act, and a Session pinned to the wrong Ticket has no other repair. The
  menu ends in `Unlink from this Ticket`, which is only ever drawn over a pin — dropping it gives
  the derived link straight back.

A pin outranks both a branch number and the number a spawn claimed. Both spawn and pin are DIRECT;
the pin wins because it is the later of the two and the only one a reader can revise. Moving a pin
drops the title held for the ticket it moved off, so no ticket's words are ever printed under
another ticket's number.

The measurement is unchanged: `Link a ticket…` is nine characters wider than the word it replaces
and the line is intrinsically sized.

## Measurements

| Measurement | Value | Source |
|---|---|---|
| Deck chrome, total | titlebar reach + 40 | the row this design exists to save |
| Tab line height | `ArgoLayout.deckTabSlotHeight` 40 | unchanged |
| Canopy height | `ArgoLayout.deckCanopyHeight` = the tab slot alone | `deckHeaderHeight` is **retired** |
| Horizontal inset | `ArgoSpacing.section` 24 | the tab line's own today |
| Gap between trailing members | `ArgoSpacing.loose` 16 | the prototype's `.tabslot` gap |
| Tab label | `ArgoTypography.control` — interface · callout 12 · medium | the prototype's 12px |
| Selected tab underline | `ArgoStroke.indicator` 2, `interaction.selectionIndicator` | the deck's existing vocabulary; the prototype's 1.5px snaps up |
| Instrument width | `ArgoContextBar.instrumentWidth` 200 | fixed, never a share — a shrinking instrument would move its ticks on every resize |
| Instrument, label row to bar | `ArgoSpacing.tight` 4 | |
| Instrument, `CONTEXT` to ⓘ | `ArgoSpacing.tight` 4 | the label row's own spacing |
| Instrument, ⓘ to reading | a spacer, `ArgoSpacing.snug` 6 as its FLOOR | not the gap: the reading is pinned to the instrument's trailing edge and the spacer takes whatever is left, so 6 is only what a reading long enough to close the gap would keep |
| `CONTEXT` label | `ArgoTypography.badge` — interface · caption1 10 · semibold · tracking 0.6, uppercase, `text.tertiary` | **changed from `caption`**: a 40pt line has no room for the band's size |
| Reading | `ArgoTypography.machineCaption` — machine · subheadline 11, in `ContextTierInk.readingInk` | **changed from `machine`**, same reason. The ink is amber past 150k and red past 300k, but `text.secondary` under the first line — a reading that celebrates is one the eye stops sorting from the facts beside it. The BAR keeps the tint at every tier |
| Unreadable reading | the word `unknown` in `text.tertiary` | absence is the one thing here that is not a claim |
| Bar | `ArgoContextBar.height` 3, radius half its height | thin enough to read as a gauge, not a control |
| Threshold ticks | 1pt in `edge.strong`, standing `ArgoContextBar.tickOvershoot` 2 proud each side | without the overshoot a hairline inside a 3pt bar is the fill's own edge |
| Threshold positions | 15% and 30% of the track | 150k and 300k against a 1M window |
| ⓘ | `ArgoSymbol.about` at `ArgoIconSize.inline` 10, `text.tertiary` | unchanged from #692 |
| ⓘ panel | `ArgoContextBar.guideWidth` 320, threshold column `guideThresholdWidth` 74 | unchanged from #692 |
| Panel section heading | `ArgoTypography.badge`, uppercase, `text.tertiary` | the `CONTEXT` label's own role — the panel now has two blocks, so each is named |
| Panel, heading to its block | `ArgoSpacing.base` 8 | |
| Panel, between blocks | `ArgoSpacing.comfortable` 12 on each side of the `DeckSeparator` hairline that divides them | |
| `This Session` term column | `ArgoContextBar.guideTermWidth` 96 | wider than the threshold column because it holds words; fixed, so the readings stay on one edge whichever facts a Session has |
| `This Session` term | `ArgoTypography.caption` in `text.tertiary` | |
| `This Session` reading | `ArgoTypography.machineCaption` in `text.primary`, wrapping | a branch or an issue title is what the reader opened the panel to read whole |
| `This Session` row gap | `ArgoSpacing.snug` 6 | the legend's own |
| State word | `ArgoTypography.rowMeta` in the state's tone, else `text.tertiary` | unchanged from the band |
| Hand off | `SessionHandoffButton` exactly as shipped | see below |
| Chrome material | one `argoChromeBar()` from the window's top edge to the tab line's hairline | the material is what makes two rows read as one bar |

**Hand off is the shipped outlined capsule**, not the prototype's filled amber button: tier ink
on the word and on a 1pt rim, `surface.overlay` as the ground, `ArgoTypography.caption`, padded
`snug` × `hair`. #692 landed that skin after the prototype was drawn, and the renders here are
corrected to it. A tier's colour is spent on a word and a rim, never on a ground.

## An unreadable context reads `unknown` over an empty track

An unreadable context is still a context, and the absence lives inside the reading. A Session
whose records reported a spend Argo could not take one token off draws the `CONTEXT` label, the
word `unknown` in `text.tertiary`, and the 3pt track with **no fill and no ticks**. The empty
track says Argo does not have the number without inventing one, which is `CONTEXT.md`'s
degrade-down rule.

**A spend of zero is not that.** The CLI writes records of its own and prices them at nothing,
and no real request is made against an empty window — so such a record says nothing about the
context and moves no reading. It is the same record whose model the feed drops (#1249), and the
two halves of it are read the same way. What reaches `unknown` is a `usage` object naming not one
token field this reader knows: the host's keys moved, and Argo read something it cannot use.

## A Session Argo has not heard from draws no instrument at all

`unknown` is for a record Argo READ and cannot use. A Session that has reported no spend yet —
which every Session is for its first seconds — has said nothing about its window, and the zone
is **empty**: no label, no reading, no track, and no `Context` row in the ⓘ panel (#1249). The
reading appears with the first spend the records carry.

An absent fact is not an unreadable one. Worn on a Session that has only just started, `unknown`
reads as a fault the reader is being asked to do something about, and it is the one word on the
header that says Argo tried and failed. `contextUnread.png` is the empty zone;
`contextUnknown.png` is the word.

**What triggers it is the absent reading, not the access posture.** Argo reads an external
Session's context off its transcript, so it often has the number — DERIVED rather than DIRECT,
but a number. Such a Session gets the ordinary coloured reading and its filled track, and **no
Hand off**: the remedy is gated on `managed`, because handing off means typing at a prompt Argo
does not own. The warning without the button is the whole of what an external Session over the
line looks like, and `handoff-on-read-only.png` is that state.

The two are separate facts and either can hold without the other. `external.png` happens to show
both at once — an external Session that also carried no usage — which is why it is easy to read
the one as causing the other.

## The ⓘ panel explains, and then reports

The panel is two blocks under two headings. **`Context budget`** is the legend #692 shipped: the
two thresholds each wearing the ink they turn the reading, and what the remedy actually does.
Nothing in it is per-Session, because the thresholds are Argo's own policy and it is the same panel
over every header.

**`This Session`** is new with #694, and it is where every fact the two rows demoted becomes
readable at leisure: the context reading, tokens spent, cached, started, worked, agent, branch,
issue, and access where the Session is not a plain managed one. It is what makes the title's hover
a convenience rather than the only route — a tooltip is unreachable by keyboard and invisible to a
screenshot.

**A fact Argo does not have is absent from the block**, never a zero and never a dash: `0 cached`
would claim a figure nobody measured. The context row is no exception (#1249): it says `unknown`
where a spend was read and cannot be used, and it is gone where none has been reported. A Session
read off an empty record therefore shows an empty block.

**The block says the same facts as the hover, in the panel's own register.** The hover is prose and
speaks in sentences; a column speaks in readings. So the row reads `Issue` · `#476 — …`, because
`Issue #476` under a term saying `Issue` says it twice; `Access` carries the posture's word where
the hover carries its whole sentence; and the uncommitted and unpushed counts hang off the branch,
the way the deleted fact line drew them.

Two things the hover has that the block does not. The **checkout kind** — worktree or the Project's
own — is a mark on every roster row, so the panel would be its third home. **Subagent spend** is
`nil` on every CLI in use, so its row would be absent from every real Session; the spend line still
carries it, because a line that composes what is present costs nothing to leave it in.

**The way in is a click, a hover, or ⌘I** (#718). The mark is a real `Button`, so Full Keyboard
Access reaches it and VoiceOver reaches it whether or not that setting is on — which is the
cockpit's contract, not a gap in this panel. ⌘I is bound on the mark itself rather than in a menu,
because the popover is anchored to it, and the key is written into the `.help` since a control
outside a menu has nowhere else to say it. Escape and a click outside are `.popover`'s own.

### Amendment · a tenth row, `Companion` (#493) · 2026-09-02

The block's nine rows are ten. **`Companion`** sits under `Access`, because the two answer one
question between them: what Argo owns of this Session, and what it can still hear from it. The
reading is one of three — `Live`, `Not dialled in — …`, `Dropped — …` — and the fourth state of
the channel draws **no row at all**, which is the same absence rule the rest of the block follows:
an external Session was never going to have a companion channel, and a row saying so on every one
of them trains the reader past the one row where it means something.

Two of the three carry a sentence where the rest of the block carries a reading, and that is
deliberate: `Dropped` alone says a channel went and not what went with it. The panel is the only
surface that says any of this — the two rows above it are full, and a state with nothing to say on
three Sessions in four does not earn a mark on a 40pt line.

No measurement changes. It is a row in the existing term/value column, and its value wraps like
the branch and the issue title do.

## Contract changes

The five from #691/#692, and **one promotion** with #694 — `ArgoContextBar.guideTermWidth`, the
96pt term column the `This Session` block needs. It is a second column in a panel that already owns
one, and it is fixed for the same reason the threshold column is: a column sized to its own rows
would move the readings as facts came and went.

- `ArgoTypography.windowTitle` — the centred title's role
- `ArgoLayout.titlebarTitleMaximumShare` — 0.46, spent on both sides of the pane's midpoint
- `ArgoContextBar.instrumentWidth`, `height`, `tickOvershoot`
- `CockpitRoom.sessions` symbol: `waveform` → `apple.terminal`

**One retirement:** `ArgoLayout.deckHeaderHeight` goes, and with it the comment citing
`cockpit-sessions-liquid-glass.png` for the 56. This design supersedes that measurement.
`deckCanopyHeight` becomes the tab slot alone, so every zone inset by it moves up together.

Every other value in the table above is an existing token, and nothing in the renders is raw.

## What the prototype exposed that the renders don't show

1. **The centred title cuts at 46% of the detail pane.** A long derived title ellipsizes where
   the 19pt band title survived whole. The full text stays on the hover and in the roster row.
   That is the price of the row saved, and it was accepted when the variant was approved.
2. **The band was not empty when the instruments left it.** The state word was still there. The
   prototype had no slot for it and would have dropped it silently; it rides to the tab line
   instead, because the roster's badge is in the sidebar and the composer answers `permission`
   but never `stopped`.
3. **Subagent spend is not attributable.** Checked in both places `CONTEXT.md` says it lives —
   `message.usage` on sidechain records, and `toolUseResult.usage` on the delegating call — and
   every real session reports zero. The ⓘ panel therefore omits the figure rather than rendering
   `0 in background agents`, which would claim none ran.

   **The words changed, the reasoning did not** (amended in build). The zero this point refuses was
   written `0 subagents`, and the line it would have sat on said `4.1M in subagents`. #1014 settled
   that drawn copy takes the reader's word for a delegated Agent — `Background Agents`, the rail's
   word (`C3a.1b` in `cockpit-session-interior-decisions.md`) — and left the header's line behind;
   it was brought over afterwards, so the line now reads `4.1M in background agents` and the zero it
   still refuses reads as above. `Subagent` stays the model's word, here and everywhere the panel is
   not being quoted.
4. **`ran` and `worked` differ by 5–8× on a long session** (9h 25m against 1h 35m). Either
   number alone is read as the other, so the demoted telemetry line shows both.

## Frozen names

`TabLineInstruments` — the tab line's trailing group. It becomes the component name and #693's
ticket title; renaming later is a migration. `ContextBar`, `SessionContextGuide` and
`SessionHandoffButton` keep the names they shipped under and are reseated, not rebuilt.
`SessionHeader` is deleted.
