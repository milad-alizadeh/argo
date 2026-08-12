<!-- status: approved
     approved-at: ad08d1d
     prototype: worktree-prototype-two-row-header -->

# The two-row Session header

The approved design for the **Session deck's chrome** (#696). The shipped header stacks three
rows — the window titlebar, a 56pt identity band and a 40pt tab line — and reads clunky at the
top of every Session. This cuts it to two: the titlebar, and one 40pt tab line.

**The renders in [`header/`](header/) are the spec.** The measurements below are the numbers a
ticket must carry.

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
| Instrument, label to reading | `ArgoSpacing.snug` 6 | |
| `CONTEXT` label | `ArgoTypography.badge` — interface · caption1 10 · semibold · tracking 0.6, uppercase, `text.tertiary` | **changed from `caption`**: a 40pt line has no room for the band's size |
| Reading | `ArgoTypography.machineCaption` — machine · subheadline 11, in the tier's ink | **changed from `machine`**, same reason |
| Unreadable reading | the word `unknown` in `text.tertiary` | absence is the one thing here that is not a claim |
| Bar | `ArgoLayout.contextBarHeight` 3, radius half its height | thin enough to read as a gauge, not a control |
| Threshold ticks | 1pt in `edge.strong`, standing `ArgoLayout.contextBarTickOvershoot` 2 proud each side | without the overshoot a hairline inside a 3pt bar is the fill's own edge |
| Threshold positions | 15% and 30% of the track | 150k and 300k against a 1M window |
| ⓘ | `ArgoSymbol.about` at `ArgoIconSize.inline` 10, `text.tertiary` | unchanged from #692 |
| ⓘ panel | `ArgoLayout.contextGuideWidth` 320, threshold column `contextGuideThresholdWidth` 74 | unchanged from #692 |
| State word | `ArgoTypography.rowMeta` in the state's tone, else `text.tertiary` | unchanged from the band |
| Hand off | `SessionHandoffButton` exactly as shipped | see below |
| Chrome material | one `argoChromeBar()` from the window's top edge to the tab line's hairline | the material is what makes two rows read as one bar |

**Hand off is the shipped outlined capsule**, not the prototype's filled amber button: tier ink
on the word and on a 1pt rim, `surface.overlay` as the ground, `ArgoTypography.caption`, padded
`snug` × `hair`. #692 landed that skin after the prototype was drawn, and the renders here are
corrected to it. A tier's colour is spent on a word and a rim, never on a ground.

## An external Session reads `unknown` over an empty track

The instrument is never absent — an unreadable context is still a context, and the absence lives
inside the reading. An external Session draws the `CONTEXT` label, the word `unknown` in
`text.tertiary`, and the 3pt track with **no fill and no ticks**. The empty track says Argo does
not have the number without inventing one, which is `CONTEXT.md`'s degrade-down rule. It draws
no Hand off either: the remedy is managed-only.

## Contract changes

All five already landed with #691/#692. This design adds none.

- `ArgoTypography.windowTitle` — the centred title's role
- `ArgoLayout.titlebarTitleMaximumShare` — 0.46, spent on both sides of the pane's midpoint
- `ArgoLayout.contextInstrumentWidth`, `contextBarHeight`, `contextBarTickOvershoot`
- `CockpitRoom.sessions` symbol: `waveform` → `apple.terminal`

**One retirement:** `ArgoLayout.deckHeaderHeight` goes, and with it the comment citing
`cockpit-sessions-liquid-glass.png` for the 56. This design supersedes that measurement.
`deckCanopyHeight` becomes the tab slot alone, so every zone inset by it moves up together.

Every value in the table above is an existing token. Nothing here is a promotion, and nothing in
the renders is raw.

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
