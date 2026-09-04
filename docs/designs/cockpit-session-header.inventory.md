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

**Extracted while passing:** `argoPressedByKey` (`ArgoAtoms`) — Space and Return handed back to a
`Button` that took its own key events with `.focusable()`. `PlanPill` had the pair inline and this
was the second site, so it moved rather than being pasted.

**Contract:** no promotions. Every value the build spends was already in the contract.

## #694 — the ⓘ panel says what the header stopped saying

**No component was extracted.** The `This Session` block is a heading over a column of term-and-
reading rows, in one caller, with one state — every one of the extraction triggers is a no. It is
two private methods on `SessionContextGuide`, beside the `line(_:)` the legend already had.

`SessionContextGuide` gained the one prop the block needs, `facts: [SessionHeaderProjection.Fact]`,
threaded from `TabLineInstruments` through `SessionHeaderContext`. The instrument forwards it
untouched and judges none of it, which is the same contract it has with the reading it draws.

**What the block reads:** `SessionHeaderProjection.facts(from:)`, a new pure function in
`SessionHeaderProjection+GuideFacts.swift`. It composes through the same `checkout(for:)`,
`marks(for:)`, `agent(cli:model:)`, `link(to:)` and `mark(for:)` the rest of the header reads, so a
rule added to one of them reaches the panel. It shares `workedReading(_:)` with `spend(from:)`, so
the zero that means "none of it" cannot come out two ways. Two of those needed widening:
`mark(for:)` from `private` to internal, and `Header.IssueLink` gained `number`, so the bare `#476`
comes off the projection rather than off a string the panel unpicks.

**What the block does not carry:** the checkout kind and subagent spend. Both are on the hover, and
the design's *The ⓘ panel explains, and then reports* says why each stays off — `background agents
spend stays on the header line and off the block` is the test that holds it. It was
`subagent spend stays on the line and off the block` until the line took the rail's drawn word
(#1014's decision, applied to the header afterwards).

**Isolated states:** `contextGuide` renders the full panel from the new `SessionHeaderFixture.
guided`, the fixture `header/guide.png` is drawn from. `contextGuideUnread` renders the same panel
over a Session whose spend Argo read and cannot use, where the block collapses to the two rows it
has — the state the happy path cannot show. No row is permanent: the context row goes too where no
spend has been reported (#1249), and the block goes with it.

**Contract:** one promotion, `ArgoContextBar.guideTermWidth` 96. See the design's *Contract
changes*.

## #404 — the tabs zone becomes a control

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `DeckTabs` | shell zone | `ArgoUI/Shell/Deck/Header/` — beside the line it sits in | `selection: Binding<DeckTab>` | `DeckTab` | the design's own tabs, row two's leading edge |
| `DeckTab` | value | the same folder | — | — | `cockpit-session-interior-decisions.md` C2.2 |

**Why it was extracted:** the zone drew `Deck tabs · placeholder` and could hold no keyboard,
which is the criterion #404 was left holding. A tab is a focus stop and a press, so it is a
component and not a `Text` in the line.

**One tab is drawn, and the model carries two.** C2.2 froze `Activity · Delivery`, and only
Activity has a pane behind it — Delivery's is #269. `DeckTab.shown` is the drawn list and the one
edit that adds a tab; `allCases` stays the design's set. A tab whose press changed nothing would
be a promise the deck cannot honour, which is why the second one is named here and not drawn.

**Deleted:** `DeckZone` and `DeckSlot`. The tabs were the last zone laid out and unbuilt — the
rail has drawn since #401 — so the placeholder list had nothing left in it.

**Measurements:** none new. The label is `ArgoTypography.control`, the rule is `ArgoStroke.indicator`
2 in `interaction.selectionIndicator` flush to the line's bottom edge, and the gap between tabs is
`ArgoSpacing.loose` — every one of them the design's own table. The label takes no inset of its
own, so that gap is the whole distance between two tabs and between the Ticket link and the first
of them; a ring inset would have quietly added itself to both.

**Isolated states:** `deckTabs` (the zone at rest, `docs/designs/renders/404-deck-tabs.png`) and
`cursoredDeckTabs` (the keyboard on the tab, ring and all, `404-deck-tabs-cursored.png`). The
second is the ticket's actual subject: a still is the only place the focus ring can be looked at.

**Extracted while passing:** `argoPressedByKey` (`ArgoAtoms`) — Space and Return handed back to a
`Button` that took its own key events with `.focusable()`. `PlanPill` had the pair inline and this
was the second site, so it moved rather than being pasted.

**Contract:** no promotions.
