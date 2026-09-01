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

**Re-rendered on 2026-08-11 for ADR-0025**, because the Mode control went from a three-segment
`Ask · Plan · Code` picker to a four-rung menu. Nineteen of the twenty-one changed; `external.png`
and `orphaned.png` draw no composer at all, so they re-rendered byte-identical. `run-ask.png`
became **`run-auto.png`** — `Ask` is not a rung any more, and `Auto` is the non-default worth
showing. `run-modemenu.png` is **new**: a menu has an open state that segments never had.

**Re-rendered again for #608**, when the Mode menu became bespoke. Seventeen changed. Every one is
byte-identical to its predecessor *outside* the Mode control — checked pixel by pixel, which is how
a re-render proves it changed only what it meant to. `perm.png` and `perm-edit.png` join
`external.png` and `orphaned.png` in not changing: the prompt takes the composer's slot, so there
is no footer in them to hold the control.

**Not re-rendered for #875**, which took the Mode control back to stock. Every render that draws a
footer therefore draws a Mode pill with a ground, a stroke and a hand-drawn chevron the app no
longer has; `run-modemenu.png` draws that pill open. The rungs, their marks, the width that hugs
the selected one and everything else in those renders stands — see *Controls are stock, not
bespoke*, which is where the revert is recorded.

Two further exceptions, named so nothing downstream reads them as drift. `perm.png` and
`perm-edit.png` still draw the fuse and `denies in 0:43` that **decision 6 has since dropped**, and
the standing option they draw on the footer's trailing edge reads *Always allow Bash **here***,
which **decision 11 has since rewritten** — the option is back, saying its scope in full. Everything
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
| `AddButton` | the leading `+`. Renamed from `AttachButton` by [`cockpit-composer-picker.md`](cockpit-composer-picker.md) (#590, done in #708): it opens files, skills and commands, and two of those are not attachments. The glyph is unchanged, and its sentence stays *Attach a file* until #689 gives it the menu |
| `AttachmentTray` / `AttachmentChip` | chips above the field |
| `ModePicker` | the `Read Only · Plan · Code · Auto` menu. Bespoke, not a `Picker` (#608) |
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

**The field** — `body` (13) at **1.5 line height** (19.5pt, `ArgoComposerVessel.fieldLineHeight`).
Grows with content to a **six-line ceiling** — the study's 132pt said in the unit the field actually
grows by — then scrolls inside itself. The feed above is never squeezed.

> **Corrected in build (#539), and put back in #734.** #539 struck the 1.5 line height as
> unbuildable: a stock `TextField` is `NSTextField` underneath, draws the face's own leading (≈18pt
> at 13), and silently ignores `lineSpacing`. #734 replaced the control, for a reason the table
> below now records — Shift-Return needs a caret and an `NSTextField` has none — and the line height
> came back with it. The ceiling stays held in LINES, which is what the field grows by and what a
> reader counts; 132pt was the same number measured off the study's HTML, where the leading was
> CSS's to set.
>
> One number the build had to find: TextKit adds the face's own leading ON TOP of a line height, so
> the box is set at `19.5 − leading` and a fragment then measures 19.5 exactly. Without that, six
> lines measure 121 against a 117pt ceiling and the sixth is drawn cut in half.

**The footer row** — `base` (8) gap, `base` (8) top padding. Controls left to right: `+` (26pt),
spacer, `ModePicker`, `RunFactsButton`, `SendButton` (26pt circle).

**`ModePicker`'s closed control** — **the platform's, measured by nobody here** (amended in build,
#875). It was 20pt high, radius `control` (6), `snug` (6) padding each side and `snug` (6) between
mark, word and chevron, mark and chevron both at `ArgoIconSize.inline` (10), the chevron in
`text.secondary` against the word's `text.primary`. Every one of those numbers described a ground
this control no longer draws, and none of them is spec any more — `ArgoComposerVessel.modeHeight`
went with them and is in no Swift file. What is left to state is the **label**: mark and word at
`ArgoTypography.control`, sized by font rather than by ink height, and the whole control `.tint`ed
`text.primary`, because a `Menu` paints its label with the accent and reads the tint rather than a
`foregroundStyle` set around it. The indicator is the system's and takes the system's ink.

The one measurement that survives the revert is the **width**, because it is a decision and not a
box: `.fixedSize()`, so the control hugs the selected rung. Measured off `composer/rest.png`, where
the pill is 77pt wide at `Code` against the 88pt the pinned width gave it — the 11pt difference is
the whitespace decision 1 refuses.

> The renders draw the four marks at **12**, two over the rung they were built to. They are
> hand-drawn SVG stand-ins, and a multi-element one smudges to a blob at 10 where SF's own
> small-size variant stays legible. The rung is now `ArgoTypography.control`'s own, since the label
> style sizes the mark by font; the render is there to say which mark sits where.

**`SendButton`'s Stop state** — the same 26pt circle in the same place, ground `state.attention`,
and a **7pt square** in `text.onAccent` where the arrow was. Added in build (#541), measured off
`composer/running.png`: the mark is about a quarter of the disc, which no rung of the icon scale
reaches — `ArgoIconSize.inline` is 10, and a solid at the arrow's own `control` (13) fills half the
circle and reads as a second button inside the first. It is therefore the one mark in the shell
drawn as a **shape rather than a symbol**, and the number lives with the vessel's own measurements
(`ArgoComposerVessel.stopMark`) rather than on the icon scale.

**The badges** — `PERMISSION` on the prompt's first line and `NEEDS INPUT` on the roster row are
one mark at one size: uppercase, tracked 0.6, semibold, at **10** (`ArgoTypography.badge`,
`ArgoBadge`). Measured off `composer/perm.png`, where both draw a 7px cap height at 1x. Ink is the
state's — `state.attention` for both of these.

> **Corrected in build (#544).** The prompt's `PERMISSION` shipped at `sectionLabel`'s 11 in #542,
> before the roster's badge gave the pair a second member to disagree with. Both are the same mark
> naming the same fact, so they now take one role at the size the render sets.

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
| `.modemenu` (Mode) | `Menu`, indicator and all — bespoke from #608, stock again since #875 |
| the field | **`NSTextView` behind an `NSViewRepresentable`** (#734) — see the note under this table |
| `.picklist` (Model) | `Picker(…).pickerStyle(.inline)` |
| `.runpanel` | `.popover(…)` with `.presentationBackground(.regularMaterial)` |
| the popover's groups | `Form` sections, each with its own header |

**One exception now, and it was forced by something the stock control cannot do.** There were two
until #875 gave the second one back.

**The field, in #734.** Return submits a Turn here, so Shift-Return is the only way to a second
line — and breaking a line needs a caret, which an `NSTextField` does not expose. The same
replacement is what made the 1.5 line height above reachable. Nothing else about the control
changed: no ring of its own, plain text only, the platform's own undo, and the substitutions off
because a draft is a line about to be handed to a CLI.

**Mode, in #608 — and back to stock in #875** (amended in build). It began as
`Picker(…).pickerStyle(.menu)`, which macOS draws through `NSPopUpButton`. Three things this
screen wants are things that control cannot do: one chevron instead of the stepper pair, a width
that follows the selected rung, and a mark in each row. Decision 1 records what each is worth.

None of the three needed a control of its own, which is what #608 spent. SwiftUI's `Menu` gives all
three away, so the ground, the `edge.subtle` stroke at `ArgoRadius.control`, the pinned height and
the drawn chevron were four decisions spent arriving at what `Menu` draws by itself — and the
hand-drawn half put this pull-down's press, focus and hover on a different footing from every other
one the reader meets. **#875 took the drawing back and kept the three wins**: `ModePicker` is a
`Menu` whose ground, capsule and indicator are the system's, its label a `Label` at
`ArgoTypography.control`, `.tint`ed to `text.primary` and `.fixedSize()`d so it still hugs the
rung. `GitVessel` was reverted in the same ticket, off the same argument.

So this table is now what its own heading says. The Mode row was the exception the heading did not
allow, and every row above is a stock control but the field. (The heading is about controls, not
about every mark on the footer: `SendButton`'s Stop is still a drawn square and the attachment
chips are still drawn, both for reasons stated where they are measured.)

## Decisions the renders encode

1. **Mode is on the composer and never in the popover it opens.** Mode is Argo's standing
   autonomy stance — how far the agent may act before it stops (ADR-0025) — so it must be
   readable without opening anything, and once it is on the footer, restating it inside reads as
   two controls for one value.

   **Mode is a menu picker, not segments** (`Picker(…).pickerStyle(.menu)`). Four rungs of
   segments were rendered and measured at 760pt: they ate the footer's width and pushed the run
   facts off the row entirely, which decision 2 does not allow.

   **The control hugs the selected rung** (amended in build, #608). It was sized to the widest
   rung, `Read Only`, which `NSPopUpButton` does for free and the study's stand-in was pinned to
   match — on the argument that a trailing edge moving with the rung is a worse tic than the width
   it saves. Rendered, the reverse is true: at `Code` the pinned width leaves 11pt of empty pill to
   the right of the word, and empty space inside a bordered control reads as a control that failed
   to draw something. **A moving trailing edge is accepted instead** —
   and it moves less than the reasoning assumed, because the control is the *leading* item of a
   trailing-aligned group, so the run facts and send button do not move at all. Only the pill's
   own left edge does.

   **Each rung carries a mark, and the tooltip keeps the boundary** (amended in build, #608). The
   original loss was threefold — no ink, no mark, no per-row caption — because `NSPopUpButton`
   ignores `.tint` and `.foregroundStyle` and its rows take a title and nothing else. **The mark
   half is taken back**; ink and per-row captions stay out. A word alone is what forced the
   boundary onto a tooltip, and the boundary stays there — `Read Only — no writes` — but a mark
   gives `Auto` back the loudness it lost as the one rung with no boundary left. The rows draw the
   selected rung's **checkmark themselves**, since that is the other thing the stock control gave
   for free.

   | Rung | Mark | Why |
   |---|---|---|
   | Read Only | `eye` | already the shell's mark for looking without touching |
   | Plan | `list.bullet.rectangle` | the rung whose deliverable is a list |
   | Code | `chevron.left.forwardslash.chevron.right` | `ArgoSymbol.programSource`, the code room's own mark |
   | Auto | `bolt` | no boundary, so the loudest mark of the four |

   **The closed control is mark · word · the `Menu`'s own indicator** (amended in build, #875). It
   was drawn as mark · word · one `chevron.down` of the composer's own, at `ArgoIconSize.inline`
   and quieter than the word, placed **beside** the label and never inside it — a `Menu`
   re-synthesises its label from icon and title alone, so a chevron put in there never draws at all
   (`GitVessel` learned this first). What that chevron was arguing for is what `Menu` already
   draws: one indicator rather than the stepper pair, because this drops a list and a stepper pair
   says *cycle through values*, which is a different control. Drawn a second time it was a second
   mark for a job the platform had done, so **#875 kept the argument and dropped the drawing**. The
   framework fact stands and is why nothing may be put inside a `Menu`'s label.

   **A reading that is not an exact rung ticks nothing** (amended in build, #545). The study drew
   one selected rung and no other case, because it was drawn before the control had a Session
   behind it. It has one now, and a CLI can sit where the ladder has no rung: `claude` `default`
   is `Read Only ≈`, and `dontAsk` is `unknown` (ADR-0025). Neither is a rung the user chose, so
   neither may carry the checkmark — a tick is the control saying *this is where you are*, and on
   an approximation it would be the one lie the honesty tiers exist to stop.

   - `≈` goes **before the word** on the closed control, `≈ Read Only`, where it reads as a
     qualifier on what follows rather than a fifth mark. The rung keeps its own mark.
   - `unknown` draws the word `unknown` and `questionmark`. It is not a rung, so it never appears
     among them and takes no place in the mark table above.
   - **The CLI's own value is on the tooltip, verbatim** — `≈ Read Only — no writes · reported as
     default`. The tooltip already carried the boundary, and this is the same reader asking the
     same question one step further. The sentence does not name the CLI, because the control
     cannot: the reading carries the value and not who said it.
   - **The menu names it too, as one section header above the rungs**, so the fact survives a
     reader who opens the control instead of hovering it. It is one header and not a per-row
     caption, so the rule above stands: the rows are still a word and a mark. An exact reading has
     nothing to footnote and gets no header.

   **A rung picked mid-Turn is held under the same `≈`** (amended in build, #940). The port
   refuses a walk while a Turn runs, so the picked rung is kept and walked at the boundary. Until
   it lands the closed control reads `≈ Auto` and ticks nothing, and the footnote — tooltip and
   menu header both — reads `Code until this Turn ends, then Auto`, which is the one place the
   rung the Session is actually standing on is still stated. The seam carries the port's own
   refusal beside what Argo did with the intent.

   The four rungs are always all offered, in both cases. What Argo can *read* and what it can
   *set* are different questions, and a Session Argo cannot place on the ladder can still be put
   on a rung.
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

   **There is a third reason, and the study drew neither of the two it resembles** (added in build,
   #546). A **managed** Session whose companion reported itself `ended` has lost nothing: Argo still
   holds its PTY, so *orphaned*'s sentence would claim a death that did not happen, and *read-only*
   would deny an ownership Argo has. It is `Ended — this Session is over, so there is nothing left
   to send to.`, and it takes the quiet `info.circle` rather than a triangle, because nothing here
   went wrong. Before this it drew nothing at all, which is the blank foot this decision exists to
   stop.

   **The exit belongs to both of the reasons that were Argo's**, orphaned and ended, and to neither
   external one. Argo never owned an external Session, so a fresh Session beside it is a guess about
   what the reader wanted rather than the way on from where they are.
8. **A failed send does not clear the field.** The message stays where it was typed, with the
   reason and a Retry on the seam.

   **The Retry is neutral, not accented** (corrected in build, #546). It shipped Ion Blue in #538
   and read as a link on a line whose other half is already the failure ink. `failed.png` draws it
   in the quiet ink and always did; a `.bordered` button takes its label from the `tint` and ignores
   a `foregroundStyle` set anywhere around it, which is the same trap decision 1's Mode menu hit.
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
