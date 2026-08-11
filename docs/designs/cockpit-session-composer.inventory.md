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

`AttachButton` + tray/chips (#540 — no adapter takes attachments yet; capability is declared,
decision 9, so the study's `noattach` state is today's honest render) · `RunFactsButton` +
`RunSettingsPopover` (#558) · `ComposerUnavailable` (#546) · `SendButton`'s **Stop** state, which
`queued.png` draws and #541 owns — it needs an interrupt on the drive port, and a square that
stops nothing would be the promise decision 9 refuses to make about attachments.
