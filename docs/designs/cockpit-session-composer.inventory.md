# Session composer — build inventory (#538, #539)

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
| `ModePicker` | atom | same | `mode: Binding<ComposerMode>` | stock `Picker(.segmented)`, `.controlSize(.small)` | frozen table, `ModePicker` |
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
| `AttachmentChip` | molecule | same, `private` to the tray | `attachment: SessionAttachment`, `remove: () -> Void` | thumbnail or `ArgoGlyph`, name, mono size, an 18pt `×` | frozen table, `AttachmentChip` |
| `AttachmentDropTarget` | modifier | same | `canAttach: Bool`, `attach: ([SessionAttachment]) -> Void`, `isHeldOpen: Bool` | the dashed rim, the wash, and *Drop to attach* | `dragover.png` |

Extraction evidence: the first three are in the design's frozen-names table. `AttachmentChip` is
`private` to its tray rather than a file of its own — the tray is its only caller and the pair is
one subject — and `AttachmentDropTarget` is not a component at all but the drag-over STATE, which
is a whole-vessel rendering with no other way to be reached: only a real drag raises it, so
`isHeldOpen` is the seam a render opens (the same one `PlanPill`'s `isRevealed` opens for a hover).

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
- `ComposerMode` — the stance vocabulary; local until #545 gives it an effect.

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
