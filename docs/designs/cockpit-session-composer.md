<!-- status: approved
     approved-at: cb9516a
     prototype: prototype/536-composer -->

# Session composer, attachments and Permission

The approved design for how a user speaks to a Session, settling
[#536](https://github.com/milad-alizadeh/argo/issues/536) under
[#535](https://github.com/milad-alizadeh/argo/issues/535) / ADR-0024. The terminal leaves the
Session experience; this replaces it.

**The renders in [`composer/`](composer/) are the spec.** One PNG per state, 1440×860, taken
from the study with its switcher hidden. The measurements below are the numbers a ticket must
carry — prose that omits them cannot be failed for getting them wrong.

Two exceptions, named so nothing downstream reads them as drift. `perm.png` and `perm-edit.png`
still draw the fuse and `denies in 0:43` that **decision 6 has since dropped**, and they still
draw the *Always allow Bash here* option on the footer's trailing edge, which **#542 removed and
#572 will bring back properly**: the grant it made was a set of tool names nobody could see or
undo, which is the class of thing this prompt exists to prevent. Everything else in those two
renders stands.

The study itself lives on the throwaway branch `prototype/536-composer`
(`docs/designs/prototypes/composer-permission-prototype.html`), where every state is reachable
as `?variant=B&state=<key>`. It is there to be re-explored, not built from.

## The Dock does not survive

It promised a Session terminal and there is no longer one to hold. The composer **floats over
the feed** rather than sitting in an attached seam, so the deck's bottom edge belongs to the
feed again. The visible `LocalProcessTerminalView` is re-pointed at the Code room's scratch
Terminal (#274), as ADR-0024 says.

## Component names — frozen

These become file names and ticket titles; renaming later is a migration.

| Name | What it is |
|---|---|
| `SessionComposer` | the glass vessel and everything in it |
| `ComposerField` | the growing text view |
| `ComposerFooter` | attach · Mode · run facts · send |
| `AttachButton` | the leading `+` |
| `AttachmentTray` / `AttachmentChip` | chips above the field |
| `ModePicker` | the `Ask · Plan · Code` segmented picker |
| `RunFactsButton` | the `Opus 5 · Medium` fact line that opens the popover |
| `RunSettingsPopover` | Model list + Effort scale + reset |
| `SendButton` | the arrow, and its Stop state |
| `QueuedTurnChip` | a follow-up held until the Turn ends |
| `ComposerSeam` | the line above the vessel: draft, failure, capability notice |
| `PermissionPrompt` | takes the composer's slot while a decision is pending |
| `ComposerUnavailable` | the replacement for a Session that cannot be driven |

## Measurements

**The vessel** — inset `section` (24) left and right, `loose` (16) from the deck's bottom edge.
Radius `ArgoRadius.popover` (12). Padding: `comfortable` (12) top, `loose` (16) leading, `base`
(8) trailing and bottom — asymmetric because the trailing edge ends in a 26pt control and the
leading edge in text. Ground `glassTint`, edge `glassRim`, blur behind it; a specular inset
highlight along the top is the depth cue (`ArgoElevation`'s bounded-glass rung).

**The feed under it** — 128pt bottom padding and a mask fading from opaque at `100% − 108pt` to
clear at `100% − 28pt`. The feed runs *under* the vessel; it is never clipped by it.

**The field** — `body` (13) at 1.5 line height. Grows with content to a **132pt ceiling** — six
lines — then scrolls inside itself. The feed above is never squeezed.

**The footer row** — `base` (8) gap, `base` (8) top padding. Controls left to right: `+` (26pt),
spacer, `ModePicker`, `RunFactsButton`, `SendButton` (26pt circle).

**No keyboard hint is printed.** `⇧⏎` and `esc` are platform conventions; the controls carry
them in tooltips rather than the composer explaining itself forever.

**Attachment chips** — radius `control` (6), 20pt leading thumbnail or kind glyph, name at
`subheadline` (11) ellipsizing, size in mono, an 18pt `×`. **One chip shape for every source**:
a pasted screenshot and a dropped file differ only in the name the chip derives.

**Drag-over** — the whole vessel takes a 2pt (`ArgoStroke.indicator`) dashed accent rim and an
accent wash reading *Drop to attach*.

**The popover** — 264pt wide, radius `popover` (12), the same material as the vessel. Two
sections: **Model** as an inline list with checkmarks, **Effort** as a four-stop segmented
scale. It has **no second layer** — three model names fit inline, so nothing opens on top of
anything.

## Controls are stock, not bespoke

| In the study | In the app |
|---|---|
| `.seg` (Mode, Effort) | `Picker(…).pickerStyle(.segmented).controlSize(.small)` |
| `.picklist` (Model) | `Picker(…).pickerStyle(.inline)` |
| `.runpanel` | `.popover(…)` with `.presentationBackground(.regularMaterial)` |
| the popover's groups | `Form` sections, each with its own header |

## Decisions the renders encode

1. **Mode is on the composer and never in the popover it opens.** Mode is Argo's standing
   autonomy stance and the one setting that decides how often the agent stops to ask you
   something, so it must be readable without opening anything — and once it is on the footer,
   restating it inside reads as two controls for one value. `Ask` takes the attention ink,
   `Plan` the accent: both are departures from acting autonomously.
2. **Model and Effort are on the composer too, and the deck header states the CLI alone.** A
   value stated in two places is one you keep in sync by eye. (The rejected alternative put them
   on the header's fact line.)
3. **Acceptance is the echo, not a toast.** The field clears, the words appear in the feed as
   the user's own, the status flips to *Running*. A 1.4s accent wash marks the new row; there is
   no fourth signal.
4. **A queued follow-up rides above the field**, cancellable, and is sent when the Turn ends.
5. **A prompt whose hook has gone leaves without a word.** Decision 6 moved the timeout a day out,
   which leaves cancelling the turn as the only way anyone reaches this in practice — and a prompt
   that vanishes when you cancel the turn it belonged to is the expected answer, not a silence
   that needs explaining. (Superseded: the earlier reading rendered
   `Permission expired — denied, unanswered`, on the argument that *denied* alone would claim a
   decision nobody made. That argument still holds for a real expiry; #573 is where it goes if
   the timeout ever comes back down.)
6. **No clock is drawn — the prompt waits for the person.** The `PreToolUse` hook's `timeout` is
   set a day out, so expiry is never the thing that decides: nobody watches the cockpit for the
   whole of an agent's run, and a countdown on an unwatched surface only asks to be beaten. The
   prompt holds where it is until it is answered. Allow is focused, `⏎` allows, `esc` denies.
   (Superseded: the earlier reading drew the window as a fuse and `denies in m:ss`, on the
   argument that walking away otherwise looks free. It is free — that is the point.)
7. **A degraded composer is absent, not disabled.** A greyed field invites a click and gives no
   reason; one line saying *read-only — Argo did not spawn this Session* answers the question the
   field would have raised. Orphaned additionally offers a fresh Session on the same branch.
8. **A failed send does not clear the field.** The message stays where it was typed, with the
   reason and a Retry on the seam.
9. **Capability is declared, not discovered.** An adapter that cannot take attachments has **no
   `+`**, and a drop is refused with the reason.
10. **The roster row carries *Needs input*** with an amber dot while a Permission is pending, so
    a blocking Session is visible without opening it (#502's row, one addition).

## Token reconciliation

Everything snapped; **nothing was promoted**, so the contract is unchanged by this screen.

| Explored | Verdict | Landed as |
|---|---|---|
| `12.5px` · `11.5px` · `10.5px` | snap | `callout` 12 · `subheadline` 11 · `footnote` 10. The scale is Apple's HIG ladder and its own doc comment records that half-points are what it replaced |
| `13px` · `12px` · `11px` · `10px` | snap, exact | `body` · `callout` · `subheadline` · `footnote` |
| `18px` vessel radius | snap | `ArgoRadius.popover` (12). 18 and 12 were rendered against each other at real size and were indistinguishable, so a fifth rung was not earned |
| `999px` · `7px` · `5px` segment radii | not ours | the stock segmented picker brings its own shape |
| white `.065 → .03` gradient | snap | flat `GraphitePalette.glassTint` |
| white `.14` rim | snap | `GraphitePalette.glassRim` |
| `1.5px` drop-target dash | snap | `ArgoStroke.indicator` (2) |
| `3px` chip and row padding | snap | `ArgoSpacing.tight` (4) |

## What the study exposed that the renders do not show

- **A 40pt attached seam is a poor drop target.** The rejected variant matched the Dock's height
  exactly, which read well at rest and badly with a file over it — the drop wash was a 40pt strip
  across the window's bottom edge. It is part of why the composer floats.
- **A pop-up button inside the popover does not fit.** Its menu overflowed the popover's right
  edge and covered the Effort row. That is the reason Model is an inline list, not a preference.
- **A popover nested in the deck header's fact line is invisible** — the fact line clips its own
  overflow so long branch names ellipsize. Anything dropped from that line must anchor to the
  band.

## Next

`/to-tickets` against this, then `design-to-code` per ticket. Judge the result with
`/pixel-review` against [`composer/`](composer/).
