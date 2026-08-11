# Session composer — build inventory (#538, #539, #540, #608)

What assembling the composer's send slice actually forced out of
[`cockpit-session-composer.md`](cockpit-session-composer.md), per ticket. Names were frozen at
approval; renaming one is a migration. Later tickets against the same design append their rows
here rather than starting a second inventory.

## Extracted — #538 (send)

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `SessionComposer` | organism | `ArgoUI/Shell/Deck/Composer/` — the deck's own part, one caller (`FeedColumn`) | `composer: SessionComposerProjection.Composer`, `send: (String) throws -> Void`, `draft: ComposerDraft` (fixture seam, defaults empty) | `ComposerSeam` · `ComposerField` · `ComposerFooter` | frozen table, `SessionComposer` |
| `ComposerField` | molecule | same | `text: Binding<String>`, `placeholder: String`, `submit: () -> Void` | stock `TextField(axis: .vertical)` | frozen table, `ComposerField` |
| `ComposerFooter` | molecule | same | `mode: Binding<ComposerMode>`, `facts: String?`, `isSendable: Bool`, `send: () -> Void` | `ModePicker` · `SendButton` | frozen table, `ComposerFooter` |
| `SendButton` | atom | same | `isSendable: Bool`, `send: () -> Void` | `ArgoGlyph` in a 26pt circle | frozen table, `SendButton` |
| `ModePicker` | atom | same | `mode: Binding<ComposerMode>` | stock `Picker(.menu)`, `.controlSize(.small)`, boundary on `.help` | frozen table, `ModePicker` |
| `ComposerSeam` | molecule | same | `detail: String`, `retry: () -> Void` | text + retry, above the vessel | frozen table, `ComposerSeam` |

Extraction evidence: every name above is in the design's frozen-names table — a cross-screen
contract settled at approval — and two carry unexercised states the happy path never renders
(`ComposerSeam` exists only on a refused send; `SendButton` has a no-draft side).

## Extracted — #539 (multi-line, drafts, a queued follow-up)

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `QueuedTurnChip` | molecule | `ArgoUI/Shell/Deck/Composer/` — the vessel's own part | `turn: QueuedTurn`, `cancel: () -> Void` | `ArgoGlyph` + an accent rule, in the chip shape | frozen table, `QueuedTurnChip` |

One row, because #538 already extracted `ComposerSeam` — this ticket gave it its **second note**
rather than a second component. A seam that said only *refused* and a seam that said only *kept*
would be one line drawn twice, and the two can never be on screen together.

Extraction evidence: `QueuedTurnChip` is in the design's frozen-names table, and it carries a
state the happy path never renders — a Session mid-Turn with something waiting on it.

## Extracted — #540 (attach a file or image)

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `AttachButton` | atom | `ArgoUI/Shell/Deck/Composer/` — the footer's own part | `attach: ([SessionAttachment]) -> Void` | `ArgoGlyph` + stock `.fileImporter` | frozen table, `AttachButton` |
| `AttachmentTray` | molecule | same | `attachments: [SessionAttachment]`, `remove: (SessionAttachment.ID) -> Void` | `WrapFlow` over `AttachmentChip` | frozen table, `AttachmentTray` |
| `AttachmentChip` | molecule | same | `attachment: SessionAttachment`, `remove: () -> Void` | thumbnail or `ArgoGlyph`, name, mono size, an 18pt `×` | frozen table, `AttachmentChip` |
| `AttachmentDropTarget` | modifier | same | `canAttach: Bool`, `attach: ([SessionAttachment]) -> Void`, `isHeldOpen: Bool` | the dashed rim, the wash, and *Drop to attach* | `dragover.png` |

Extraction evidence: the first three are in the design's frozen-names table.
`AttachmentDropTarget` is not a component at all but the drag-over STATE — a whole-vessel rendering
with no other way to be reached, since only a real drag raises it. `isHeldOpen` is the seam a render
opens, the same one `PlanPill`'s `isRevealed` opens for a hover.

### What `/pixel-review` measured, and what moved

The chip was seated at `chipHeight` (20) on a reading that a 20pt thumbnail could fill a 20pt chip.
The approved render measures **28** — the thumbnail with `ArgoSpacing.tight` above and below it,
which is the row the study's own token reconciliation snapped `3px` to. `attachmentChipHeight` is
derived from those two rather than restated, and is deliberately NOT `chipHeight`: a standing allow
holds a word, this holds a picture, and #572's tray was approved at 20.

The drag-over wash was `state.muted` (0.16) and measured ~1.7× the approved lift. `StateRoles`
gains **`wash(_:)` at 0.1** — the third rung of the `muted`/`rim` family rather than a borrow from
`DiffRoles.wash`, because a chip's ground carries one word and this one sits under a field, a picker
and two controls. *Drop to attach* moved from `caption` to `control`, the rung the render sets it at.

**Two divergences left standing, both on a documented rule.** The `×` and the `+` draw their marks
at `ArgoIconSize.inline` and `.control` where the study drew lighter ones: the scale's own note
records a chevron shrunk below `inline` becoming "a control nobody could see they were allowed to
click", and both of these are controls. Adding a rung to that scale is a decision for the contract,
not a side effect of this ticket.

**A non-image chip takes the evidence panel's language-family mark**, not a second map of its own:
`AttachmentProjection.glyph(for:)` runs `EvidenceLanguage(declared:).symbol`. The study drew a
generic `<>` on a `.swift` file because its HTML carried no such map; the token contract does, so a
Swift file gets the Swift mark. That is drift **toward** the contract, and the one place the build
knowingly draws a different glyph from `attach.png`.

### The one place the build departs from the ticket

**Pasted bytes land in Argo's own per-machine data, not the Workspace.** #540 asked for the
Workspace; a screenshot written into the checkout shows up in `git status` and in Argo's own
`Workspace.dirty` reading, so pasting a picture would report as the user having changed something.
The handoff brief already establishes that an agent reads an absolute path outside its tree
(`Hub.handoffRoot`), which was the only thing the Workspace was buying. A **dropped file is not
copied at all** — it already has an address, and a copy would be a second, staler version of a file
the Session may be working in. The mechanism the ticket named is untouched: Argo injects a path and
the agent's own `Read` pulls the bytes in.

The chip's size figure spells its unit the way the platform does — `248 kB` where the study's HTML
typed `248 KB`. The number matches; the casing is `ByteCountFormatStyle(.binary)`'s, and
hand-spelling it would be a raw string standing in for a locale-aware value.

**Nothing reaps what lands under `attachments/`**, and that is the choice rather than an oversight:
the path is named in a transcript that outlives the Session, so bytes deleted later would leave a
historical Turn pointing at nothing. A refused send is survivable because the address is the
attachment's own id — pressing Retry rewrites the same file rather than leaving a copy beside it.

## Rewritten — #608 (the Mode menu goes bespoke)

No new name: this ticket **replaces** `ModePicker`'s row rather than adding one. Its
`composed-of` was *stock `Picker(.menu)`, `.controlSize(.small)`, boundary on `.help`*, and is now:

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `ModePicker` | atom | `ArgoUI/Shell/Deck/Composer/` — unchanged | `mode: Binding<ComposerMode>` — unchanged | bespoke `Menu` holding an inline `Picker`, a `Label` per rung, one drawn `chevron.down` beside it, in a 20pt bordered pill that hugs the rung; boundary still on `.help` | `run-modemenu.png`, `rest.png` |

It is the one control on this screen that is not stock, and the amendment to decision 1 records
why each of the three departures is worth a hand-rolled control.

`ComposerMode` gains **`mark`** beside `boundary`, and `ArgoSymbol` gains the four names it maps
to. The mapping sits on the enum rather than in the view because a rung's mark is a fact about the
rung, exactly as its boundary is — and a `switch` in the view would be a second place to forget a
rung when the ladder next changes.

### What the render measured, and what moved

Two things only a rendered specimen could catch, both invisible to the suite:

- `.menuStyle(.borderlessButton)` — the `GitVessel` idiom — wraps its label in about **10pt of its
  own padding**, which put the pill 10 over the width the design measures. `.menuStyle(.button)`
  with `.buttonStyle(.plain)` draws the same thing at the measured width.
- A button-styled `Menu` paints its label with the **accent**, and it reads the `tint` rather than
  a `foregroundStyle` set anywhere around it. Both spellings of `foregroundStyle` were rendered
  first; the rung came out Ion Blue and read as a link.

The chevron and the rung mark are sized by **font** (`argoIcon(.inline)`, which is what
`ArgoLabelStyle` already does) rather than framed by `ArgoGlyph`. `ArgoGlyph` frames by ink height,
and scaling a short wide glyph like `chevron.down` or `</>` up to a 10pt ink height scales its
**stroke** with it — rendered, the chevron drew a 2pt rule beside the word's 1pt one. What the frame
buys is several marks measuring alike side by side, and this control shows one rung at a time.

## Rewritten — #545 (the ladder reaches a Session)

No new name again: `ModePicker` stops holding a choice and starts drawing a reading.

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `ModePicker` | atom | `ArgoUI/Shell/Deck/Composer/` — unchanged | `reading: SessionModeReading`, `setMode: (SessionMode) -> Void` — was `mode: Binding<ComposerMode>` | unchanged, plus a section header naming what the CLI reported and an unticked menu wherever the reading is not exact | `run-modemenu.png`, `rest.png`, amendment to decision 1 |

`ComposerMode` is **deleted**. Its four rungs were a second spelling of `ArgoEngine`'s
`SessionMode`, which is what the drive port takes — two enums for one ladder is the drift the
frozen names exist to stop. The words, boundaries and marks move to `SessionMode+Rung`.

The binding goes with it. A control that held the rung could show one the Session was never put
on, so the value comes off the Session and the change goes out as a closure — the same shape
`send` and `stop` already have, and for the same reason: only the port knows whether it landed.

### What the render measured

`≈ Read Only` and `unknown` both leave the footer's trailing group where `rest.png` measures it,
because the Mode pill is the group's LEADING item — the widest word to date moves its own left
edge and nothing else. Specimens `composerModeNearly` and `composerModeUnknown`.

## View-model, not components

- `SessionComposerProjection` — the pure `derive(facts)`: presence (managed and not ended, else
  no composer at all), the placeholder addressed to the CLI, the run facts.
- `ComposerDraft` — the composer's whole memory, with the send rules (sent clears; refused keeps
  the text and the reason; submitted mid-Turn queues), testable against the port's in-memory fake.
- `ComposerDrafts` — the per-Session store, held in `CockpitView` because that is the one place
  above the deck's `.id(session)`, which discards everything under it on a switch. In memory only
  (#539).
- `ComposerSeamNote` — which of the seam's two sentences is up, and the words of the kept one.
- `QueuedTurn` — an identified follow-up, so two identical ones are two things the `×` can tell
  apart.
- `SessionMode+Rung` — each rung's `label`, `boundary` and `mark` (#608, #545). The rungs
  themselves are `ArgoEngine`'s `SessionMode`; only the words and marks are the composer's.
- `SessionModeReading+Label` — what the control SAYS for one reading: the word (with `≈`), the
  mark, the CLI's own value, and which rung — if any — may be ticked (#545).

## Stayed inline

- **Run facts** — one `Text` in `ComposerFooter`. It becomes `RunFactsButton` + popover when
  #558 makes Model/Effort real choices; a control that opens onto nothing today would be a
  promise the footer cannot keep.
- **The feed's bottom edge under the vessel** — clearance (`FeedTail`), fade mask and way-back
  lift are `FeedView`'s own (`isUnderComposer`): facts about the reading, not a component.
- **Vessel placement** — the `section`/`loose` insets live at the one call site in `FeedColumn`.

## Deliberately absent — owned by sibling tickets

`RunFactsButton` +
`RunSettingsPopover` (#558) · `ComposerUnavailable` (#546) · `SendButton`'s **Stop** state, which
`queued.png` draws and #541 owns — it needs an interrupt on the drive port, and a square that
stops nothing would be the promise decision 9 refuses to make about attachments.
