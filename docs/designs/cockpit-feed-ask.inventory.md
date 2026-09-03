# Answering an ask in the feed — build inventory (#712)

What assembling the row actually forced out of [`cockpit-feed-ask.md`](cockpit-feed-ask.md). The
names were frozen at approval; renaming one is a migration.

## Extracted — #712

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `FeedAskProjection` | value | `ArgoUI/Shell/Deck/Feed/Ask/` — beside the row it feeds | `live(for: CockpitPresentation.Session?) -> Live?`, `matches(_:_:)`; `Live` is `(sessionID, askID, ask)` | — | frozen table, `FeedAskProjection` |
| `FeedAskHeld` | value | same | `subscript(question:) -> Marks` (`ordinals`, `other`, `isOtherOpen`, `isClosed`); `isSettled`, `needsClosing`, `hasSomethingToSend`, `answer(for:)` | — | "A click is the answer" table |
| `FeedAskOfferList` | molecule | same, one caller (`FeedAskLine`) | `question`, `offers`, `held` binding, `needsClosing`, `hasSomethingToSend`, `pick`, `send` | `FeedAskOfferRow`, `FeedAskAnswerRow`, and `Other…` inline | frozen table, `FeedAskOfferList` |
| `FeedAskOfferRow` | molecule | same | `offer`, `isMultiple`, `isTicked`, `press` | `FeedMarker`, the 14pt box inline | frozen table; [`one-of.png`](feed-ask/one-of.png), [`many-of.png`](feed-ask/many-of.png) |
| `FeedAskAnswerRow` | molecule | same | `text` binding, `placeholder`, `canSend`, `send` | `TextField`, `FeedKeycap` | frozen table; [`free-form.png`](feed-ask/free-form.png) |
| `FeedKeycap` | atom | `ArgoUI/Shell/Deck/Feed/` — two callers | `key: String` | one `Text` on `surface.marked` | promoted, not designed — see below |

Extraction evidence: the four frozen names each carry states the happy path never renders (ticked,
hovered, nothing-to-send, `Other` open). `FeedAskHeld` was not in the frozen table and was forced
out by the settle rule — one call is one answer, so *when the whole thing goes* is a fact about
the card rather than about any one question, and a view holding it as loose `@State` would answer
"is this finished" in two places.

`FeedKeycap` is a **promotion, not a new component**: it was `PermissionKeycap`, private inside
`PermissionPromptFooter`, and the design says the ask's keycap takes "`PermissionKeycap`'s own
values". A second region picking a part up *is* the promotion (`rules/swift.md`).

## What stayed inline

- **The 14pt checkbox** — `FeedAskBox`, private in `FeedAskOfferRow`, its one caller. A rounded
  rect with a tick; the design calls it a measurement, not a component.
- **`Other…`** — `FeedAskOtherRow`, private in `FeedAskOfferList`. It is one label on the option
  card's own ground with the number column left empty, and its whole reason for existing is that
  it must NOT be a `FeedAskOfferRow` — an offer carries an ordinal and this carries none.
- **The waiting branch of the card** — `FeedAskQuestion` already existed inside `FeedAskLine` and
  gained a `Waiting?`; absent, the question draws exactly what #534 shipped.
- **The join to the live question** — `FeedProjection.offering(_:_:)`, one pass over the built
  contents. Which row the gate's question belongs to is a fact about the feed, like `toldApart`.

## Contract changes this needed

- **`ArgoComposerVessel.askBoxSize = 14`** — the design's one proposal, promoted here as
  `rules/swift.md` requires: the token lands with the view that reads it. Everything else on
  this screen snapped to a token that already existed.

## What the build corrected in the design

Nothing in the measurements. One thing in the **States** table's reach: the design gives the
undriveable row no ground and `text.tertiary` ink, and the build reads that off `isWaiting` rather
than `isPending` — so the attention ground now means *this is waiting on YOU*, and it goes wherever
the affordance goes. That also quiets the minimap lane for the same row, which the design does not
mention and follows from it.
