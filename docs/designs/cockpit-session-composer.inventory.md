# Session composer — build inventory (#538)

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

## View-model, not components

- `SessionComposerProjection` — the pure `derive(facts)`: presence (managed and not ended, else
  no composer at all), the placeholder addressed to the CLI, the run facts.
- `ComposerDraft` — region-local state with the two send rules (sent clears; refused keeps the
  text and the reason), testable against the port's in-memory fake.
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
`RunSettingsPopover` (#558) · `QueuedTurnChip` (#539) · `PermissionPrompt` (#542/#543) ·
`ComposerUnavailable` (#546).
