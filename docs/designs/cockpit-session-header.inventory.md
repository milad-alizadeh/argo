# Two-row header — build inventory

What each ticket's build actually extracted from
[`cockpit-session-header.md`](cockpit-session-header.md), one row per component, appended per
ticket. A component is here because evidence in the assembled screen forced it out, never because
the design was eyeballed for boundaries up front.

## #693 — the tab line takes the instruments

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `TabLineInstruments` | shell zone | `ArgoUI/Shell/Deck/Header/` — beside the three components it reseats, and it reads a projection rather than engine state | `header: SessionHeaderProjection.Header?`, `handOff: () async -> Void = {}` | `SessionHeaderContext`, `SessionHandoffButton` | the design's frozen name for the tab line's trailing group |

**Why it was extracted:** unexercised states. The happy path draws the instrument alone, and the
three states that carry the design's actual decisions — a state word present, an offer present,
an unreadable context — are each absent from it. They need a case of their own, which an inline
block in `SessionTabLine` could not carry.

`TabLineInstrumentsGallery` covers all four in one preview, including nothing-selected: an empty
line and a line with no mark on it are two different absences.

**What stayed inline:** the state word. It is one `Text` in one caller with a role and an ink, so
it is a private method on `TabLineInstruments`, not a component. It was on `SessionHeader` in
exactly the same shape before the band was deleted.

**Reseated, not rebuilt:** `SessionHeaderContext`, `ContextBar`, `SessionContextGuide` and
`SessionHandoffButton` moved from the deleted band to the tab line unchanged, except for the two
type roles the 40pt line forced — `CONTEXT` from `caption` to `badge`, and the reading from
`machine` to `machineCaption`.

**Deleted:** `SessionHeader`, and `ArgoLayout.deckHeaderHeight` with it.

**Contract:** no promotions. Every value the build spends was already in the contract.
