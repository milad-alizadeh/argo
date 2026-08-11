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

**Re-rendered on 2026-08-11 for ADR-0025.** Every state changed, because the Mode control appears
in all of them and it went from a three-segment `Ask · Plan · Code` picker to a four-rung menu.
`run-ask.png` became **`run-auto.png`** — `Ask` is not a rung any more, and `Auto` is the
non-default worth showing. `run-modemenu.png` is **new**: a menu has an open state that segments
never had, and it is where the four boundaries are legible at once.

Two exceptions, named so nothing downstream reads them as drift. `perm.png` and `perm-edit.png`
still draw the fuse and `denies in 0:43` that **decision 6 has since dropped**, and the standing
option they draw on the footer's trailing edge reads *Always allow Bash **here***, which
**decision 11 has since rewritten** — the option is back, saying its scope in full. Everything
else in those two renders stands.

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
| `ModePicker` | the `Read Only · Plan · Code · Auto` menu picker |
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

**The field** — `body` (13). Grows with content to a **six-line ceiling** — the study's 132pt said
in the unit the field actually grows by — then scrolls inside itself. The feed above is never
squeezed.

> **Corrected in build (#539).** This read *`body` (13) at 1.5 line height* and *a 132pt ceiling*.
> Both were unbuildable together with the control the table below names: a stock `TextField` is
> `NSTextField` underneath, draws the face's own leading (≈18pt at 13), and silently ignores
> `lineSpacing` — so 19.5pt is only reachable by replacing the control this same study says not to
> replace. The ceiling is therefore held in LINES, which is what the field grows by and what a
> reader counts; 132pt was the same number measured off the study's HTML, where the leading was
> CSS's to set.

**The footer row** — `base` (8) gap, `base` (8) top padding. Controls left to right: `+` (26pt),
spacer, `ModePicker`, `RunFactsButton`, `SendButton` (26pt circle).

**`SendButton`'s Stop state** — the same 26pt circle in the same place, ground `state.attention`,
and a **7pt square** in `text.onAccent` where the arrow was. Added in build (#541), measured off
`composer/running.png`: the mark is about a quarter of the disc, which no rung of the icon scale
reaches — `ArgoIconSize.inline` is 10, and a solid at the arrow's own `control` (13) fills half the
circle and reads as a second button inside the first. It is therefore the one mark in the shell
drawn as a **shape rather than a symbol**, and the number lives with the vessel's own measurements
(`ArgoComposerVessel.stopMark`) rather than on the icon scale.

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
| `.seg` (Effort) | `Picker(…).pickerStyle(.segmented).controlSize(.small)` |
| Mode | `Picker(…).pickerStyle(.menu).controlSize(.small)` — four rungs do not fit as segments |
| `.picklist` (Model) | `Picker(…).pickerStyle(.inline)` |
| `.runpanel` | `.popover(…)` with `.presentationBackground(.regularMaterial)` |
| the popover's groups | `Form` sections, each with its own header |

## Decisions the renders encode

1. **Mode is on the composer and never in the popover it opens.** Mode is Argo's standing
   autonomy stance and the one setting that decides how often the agent stops to ask you
   something, so it must be readable without opening anything — and once it is on the footer,
   restating it inside reads as two controls for one value.

   **Mode is a menu picker, not segments** (`Picker(…).pickerStyle(.menu)`). Four rungs of
   segments were rendered and measured at 760pt: they ate the footer's width and pushed the run
   facts off the row entirely, which decision 2 does not allow. The menu holds one word-pair and
   sizes to its widest item, so `Read Only` fits and the footer's width does not shift as the
   rung changes.

   **The menu carries no ink, and that is a loss taken knowingly.** macOS draws a `.menu` picker
   through `NSPopUpButton`, which ignores `.tint` and `.foregroundStyle` alike — both were tried
   and rendered identical to the untinted control. So a rung is read from its word alone. The
   thing this costs is loudness on `Auto`, the one rung with no boundary left, and giving it back
   means a bespoke `Menu` label rather than the stock control. Deferred rather than faked: an ink
   rule that does not render is worse than none, because the next reader believes it.
2. **Model and Effort are on the composer too, and the deck header states the CLI alone.** A
   value stated in two places is one you keep in sync by eye. (The rejected alternative put them
   on the header's fact line.)
3. **Acceptance is the echo, not a toast.** The field clears, the words appear in the feed as
   the user's own, the status flips to *Running*. A 1.4s accent wash marks the new row; there is
   no fourth signal.
4. **A queued follow-up rides above the field**, cancellable, and is sent when the Turn ends —
   **except when what ended it was the user stopping it** (amended in build, #541). An interrupt
   empties the whole vessel: the field, the tray and the queue. The queue is the half that would
   otherwise bite, and it is not a special case so much as the same rule read carefully — a
   follow-up is released the moment the Turn ends, and an interrupt IS that Turn ending, so the
   very next thing the Session received would be instructions written for the run somebody had
   just killed. Stopping and being about to say something else are the same gesture often enough
   that this cannot be left to the reader to undo in the half-second they have.

   It is **said, not done quietly** — one line on the `ComposerSeam` in the quiet ink, in the slot
   decision 8's refusal and decision 9's capability notice share. Everywhere else in the composer
   a message survives what went wrong with it; this is the one act that cannot let it, so a reader
   who typed something is told where it went rather than finding an empty vessel.

   **A refused interrupt clears nothing**, on decision 8's rule exactly: nothing was stopped, so
   the reason goes on the seam with a Retry and every character stays where it was typed. The
   composer must not report a Turn stopped on the strength of having asked.
5. **A prompt whose hook has gone leaves without a word; a prompt that ran out says so** (#573).
   The two are told apart by making one of them Argo's own act: the gate keeps a clock **shorter
   than the hook's**, so a call nobody answers is refused by Argo — DIRECT, published as a
   `PermissionExpiry`, and drawn at the foot of the reading as
   `Permission expired — denied, unanswered` in the roster's attention amber. *Denied* alone would
   claim a decision nobody made and *expired* alone would leave the tool call unaccounted for, so
   the row is both halves or it is worse than silence. The tool is named to a screen reader only —
   on the rule it would push the sentence past the column.

   The hook simply going stays silent, and that is now a *sound* silence rather than an accepted
   one: Argo's clock is the shorter of the two, so a peer close can only mean the turn was
   cancelled — and a prompt that vanishes when you cancel the turn it belonged to is the expected
   answer, not something that needs explaining. (Superseded: the earlier reading drew nothing in
   either case, on the argument that decision 6's day-long timeout left cancelling as the only way
   to reach the state. That is still nearly true — the row costs nothing until the patience comes
   down, which is now the one number that has to change to make it a live surface.)

   **The restart case #573 names is out of reach, and stays out.** An Argo that restarts under a
   live CLI did not observe the expiry: the claim, the PTY and the gate all die with the process,
   so the fresh Argo has no record to draw and the hook's own timeout is what refuses the call.
   Recording it would need the gate's state persisted, which the same reasoning that makes a
   standing allow die with its claim rules out. The Session demotes to **orphaned** instead, and
   that is the honest thing the reader is told.

   The row goes at the **foot**, not in place. The hook payload names a tool and its input and
   never the record's own id for the call, so there is no honest position in the stream to put it
   at — and the foot is where a live Session's reader is looking anyway.
6. **No clock is drawn — the prompt waits for the person.** The `PreToolUse` hook's `timeout` is
   set a day out, so expiry is never the thing that decides: nobody watches the cockpit for the
   whole of an agent's run, and a countdown on an unwatched surface only asks to be beaten. The
   prompt holds where it is until it is answered. Allow is focused, `⏎` allows, `esc` denies.
   Two clocks, a minute apart, and the order is load-bearing: **Argo's** is the day, and the
   **hook's** is the day plus a margin, so the gate always answers before the hook could be killed
   holding the question. That is what makes decision 5's expiry a fact rather than a guess.
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
11. **A standing allow is a thing on the screen, not a thing the gate remembers** (#572). The
    quiet third answer returns to the footer's trailing edge as *Always allow **Bash** in this
    Session* — the tool named, and the scope said in full rather than as *here*, which reads as
    the Workspace or the kind of call and was neither. Unbound to any key, because it is the one
    answer that outlives the call it is given for and so must not be reachable by muscle memory.
    What it makes is drawn: a **`StandingAllowTray`** above the field, in the slot decision 4
    gives a queued turn and the chips give an attachment, reading *Always allowed in this
    Session* over one chip per tool, each with an `×`. Scope stated once over the row rather than
    on each chip — a label repeated per chip is a label that gets shortened.

    The tray rides on the **prompt as well as the composer**: the prompt is where grants are
    made, and a reader ruling on the next tool should see what they already blessed. It is
    **absent, not empty**, for a Session holding none.

    **The grant ends with the Session and survives no restart.** The gate that would honour it is
    the per-claim socket, and managed-ness is not durable across a restart (`CONTEXT.md`) — a
    grant outliving its PTY would be a promise Argo cannot keep. That is why the label can say
    *in this Session* and be exactly true.

    **It composes with `--permission-mode` by not touching it.** #572 asked that the CLI-side
    baseline be composed with rather than duplicated, and the composition is that they act at
    different points: the mode decides whether the CLI runs a tool ungated at all, and the gate
    only ever sees calls the mode already sent to `PreToolUse`. A standing allow answers those
    without a round trip; it cannot widen what the mode permits, and nothing here writes the
    mode. A second way to say the same thing is what duplication would have been.

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
