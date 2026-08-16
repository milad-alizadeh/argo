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
| 2 | the context instrument, 200pt, with ⓘ inside it | always, including `unknown` |
| 3 | Hand off | past 150k **and** managed |

**Hand off takes the trailing edge, so the instrument slides inward when it appears.** That is
the prototype's order and what the renders show. It costs a reading that moves at the moment the
reader is watching it, and it was accepted because a remedy belongs at the trailing edge and
because the movement is itself the signal that a line was crossed.

**The ⓘ stays inside the 200pt instrument**, beside the uppercase `CONTEXT` label, where #692
put it — it annotates that label rather than the tab line. The prototype draws it outside; the
shipped placement supersedes it.

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
| Instrument width | `ArgoLayout.contextInstrumentWidth` 200 | fixed, never a share — a shrinking instrument would move its ticks on every resize |
| Instrument, label row to bar | `ArgoSpacing.tight` 4 | |
| Instrument, `CONTEXT` to ⓘ | `ArgoSpacing.tight` 4 | the label row's own spacing |
| Instrument, ⓘ to reading | a spacer, `ArgoSpacing.snug` 6 as its FLOOR | not the gap: the reading is pinned to the instrument's trailing edge and the spacer takes whatever is left, so 6 is only what a reading long enough to close the gap would keep |
| `CONTEXT` label | `ArgoTypography.badge` — interface · caption1 10 · semibold · tracking 0.6, uppercase, `text.tertiary` | **changed from `caption`**: a 40pt line has no room for the band's size |
| Reading | `ArgoTypography.machineCaption` — machine · subheadline 11, in `ContextTierInk.readingInk` | **changed from `machine`**, same reason. The ink is amber past 150k and red past 300k, but `text.secondary` under the first line — a reading that celebrates is one the eye stops sorting from the facts beside it. The BAR keeps the tint at every tier |
| Unreadable reading | the word `unknown` in `text.tertiary` | absence is the one thing here that is not a claim |
| Bar | `ArgoLayout.contextBarHeight` 3, radius half its height | thin enough to read as a gauge, not a control |
| Threshold ticks | 1pt in `edge.strong`, standing `ArgoLayout.contextBarTickOvershoot` 2 proud each side | without the overshoot a hairline inside a 3pt bar is the fill's own edge |
| Threshold positions | 15% and 30% of the track | 150k and 300k against a 1M window |
| ⓘ | `ArgoSymbol.about` at `ArgoIconSize.inline` 10, `text.tertiary` | unchanged from #692 |
| ⓘ panel | `ArgoLayout.contextGuideWidth` 320, threshold column `contextGuideThresholdWidth` 74 | unchanged from #692 |
| Panel section heading | `ArgoTypography.badge`, uppercase, `text.tertiary` | the `CONTEXT` label's own role — the panel now has two blocks, so each is named |
| Panel, heading to its block | `ArgoSpacing.base` 8 | |
| Panel, between blocks | `ArgoSpacing.comfortable` 12 on each side of the `DeckSeparator` hairline that divides them | |
| `This Session` term column | `ArgoLayout.contextGuideTermWidth` 96 | wider than the threshold column because it holds words; fixed, so the readings stay on one edge whichever facts a Session has |
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

The instrument is never absent — an unreadable context is still a context, and the absence lives
inside the reading. A Session whose records carried no usage draws the `CONTEXT` label, the word
`unknown` in `text.tertiary`, and the 3pt track with **no fill and no ticks**. The empty track
says Argo does not have the number without inventing one, which is `CONTEXT.md`'s degrade-down
rule.

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
would claim a figure nobody measured. The one permanent row is the context reading, which says
`unknown` where it cannot be read — the same degrade-down the instrument draws. A Session read off
an empty record therefore shows a block of exactly one row.

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

## Contract changes

The five from #691/#692, and **one promotion** with #694 — `ArgoLayout.contextGuideTermWidth`, the
96pt term column the `This Session` block needs. It is a second column in a panel that already owns
one, and it is fixed for the same reason the threshold column is: a column sized to its own rows
would move the readings as facts came and went.

- `ArgoTypography.windowTitle` — the centred title's role
- `ArgoLayout.titlebarTitleMaximumShare` — 0.46, spent on both sides of the pane's midpoint
- `ArgoLayout.contextInstrumentWidth`, `contextBarHeight`, `contextBarTickOvershoot`
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
   `0 subagents`, which would claim none ran.
4. **`ran` and `worked` differ by 5–8× on a long session** (9h 25m against 1h 35m). Either
   number alone is read as the other, so the demoted telemetry line shows both.

## Frozen names

`TabLineInstruments` — the tab line's trailing group. It becomes the component name and #693's
ticket title; renaming later is a migration. `ContextBar`, `SessionContextGuide` and
`SessionHandoffButton` keep the names they shipped under and are reseated, not rebuilt.
`SessionHeader` is deleted.
