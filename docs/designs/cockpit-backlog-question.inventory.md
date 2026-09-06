# A question asked of the backlog — build inventory (#1317)

What building [`cockpit-backlog-question.md`](cockpit-backlog-question.md) actually forced out of
it. Sections are grouped by ticket and **appended, never re-ordered**.

The names were frozen at approval. **Read the shipped name off the design's table, not out of a
section below** — a section written during a build says the name that was true that week.

#1317's own framing: **this is the tracer bullet.** It builds `found`, `asking` and `answered` and
nothing else. `BacklogAnswerCitation` is #1319's, `BacklogAnswerAttribution` is #1318's, and
`BacklogAskVacancy` with the `empty` and `wrong` states is #1320's. Every one of those has a row in
the design's frozen table and no file here yet, which is deliberate: a component drawn before its
ticket would be a surface nobody can reach.

## Extracted — #1317

| name | tier | location | props | composed-of |
|---|---|---|---|---|
| `BacklogSearchField` | molecule | `ArgoUI/Shell/Tickets/Chrome/` — one caller (`BacklogPaneHeader`). **Amended, not new**: it shipped at #1242 and this widened it | `query: Binding<String>` · `pane: CGFloat` · `ask: () -> Void` | `SearchFieldLine` in `argoFloatingGlass(in: .capsule)`, at `searchWidth` or `askWidth(inPaneOf:)` |
| `BacklogAskAffordance` | molecule | same — one caller (`BacklogPaneHeader`), hung off the field's own bottom edge | `matches: Int` · `reads: Int` | two `Offer` lines — `ArgoGlyph`, two `Text`, one `KeyCap` — on `argoFloatingGlass` at `ArgoRadius.control` |
| `BacklogAskWait` | molecule | same — one caller (`BacklogAnswerSheet`) | `reads: Int` | a `40 × 2` `Capsule` with a lit run on `ArgoMotion.working`, and one `Text` |
| `BacklogAnswerSheet` | organism | same — one caller (`TicketsRoom.answer`), applied as an overlay on `TicketDetail` and never on the pane | `question: String` · `reads: Int` · `prose: String?` · `stop: () -> Void` · `close: () -> Void` | head (`ArgoGlyph` + `Text` + `ArgoIconButton`), body (`Text` or `BacklogAskWait`), foot (the read line + one `Button`) |

`prose: String?` is what makes the wait and the answer **one component and not two**: they share a
head, a foot, a ground and a rise, and the sheet's whole job is that the head does not switch
strings under the reader when the prose lands.

## Stayed inline

- **The key cap** in the affordance — `KeyCap`, a `private struct` in the same file. It is a `Text`
  with a rim, it appears twice, and both are in that file. A shared atom for it would be a
  cross-screen unit nothing else on any screen asks for.
- **The sheet's head, body and foot** — three private properties on `BacklogAnswerSheet` rather
  than three components. Each appears once, none is a shape the design system reuses, and the
  states they differ across (`prose` present or not) are covered by the sheet's own two cases.
- **The offer line** in the affordance — `offer(_:)`, one private method over an `Offer` enum. It
  appears twice in one file, which is repetition inside a component rather than across screens.

## Values this build added, and where they went

| value | where | why there |
|---|---|---|
| `ArgoTicketsChrome.askWidth` | beside the surface | a measure is not a token (`rules/swift.md`). A CEILING; `askWidth(inPaneOf:)` is `min(268, what the pane affords)`, floored at `searchWidth` |
| `BacklogAskWait.barWidth` / `.barHeight` / `.runShare` | beside the surface | same rule. `40 × 2` is the design's; the run is the share the prototype's keyframes travel |
| `ArgoSymbol.askBacklog` | `ArgoDesign` | a mark is the contract's. Shares `skill`'s glyph the way `newTicket` shares `newSession`'s — the two never appear in one surface |
| `SearchFieldLine.Look` / `.Lead` | `ArgoUI/Shell/` | the shared field line's own, since both of this app's search fields take it |

**Nothing was promoted and the token contract did not change** — which is what the design's snap
table predicted.

## Engine changes this needed

- **`BacklogQuestion`** (`ArgoEngine/Backlog/`) — the one public door to the ask. `BacklogAskPort`
  and `CodexBacklogAsk` stay internal, so which transport answers, and that it must stay on
  subscription-included tokens (ADR-0031), is not a choice a caller makes.
- **No `CockpitActions` slot.** The ask reaches no panel, no Finder and no registry, so it is
  reached the way `actions.drive` is: the room calls the engine, and the app layer stands in front
  of nothing. `CockpitView+Tickets.backlogAsk(over:)` is the whole wiring.
- **`TicketsRoomProjection.listing(of:in:)`** — the open view's whole set by number, before any
  query. A function rather than a tenth field on `Room`, which is at its grandfathered init width.

## What the rule cost

The design's proposed detection rule was tested by #1316, **failed**, and reopened this design.
#1317 replaced the rule rather than the variant — see the design's **How a question is told from a
term**. The superseded rule is kept runnable as `BacklogQueryIntentSupersededRule` in the ArgoUI
test target, so #1316's verdict stays checkable rather than becoming a claim in a comment.

## Regroupings the 4-parameter cap forced

Named because each one is a real seam and not a shuffle, and a reader of the diff will meet them
before they meet the feature:

- `SearchFieldLine` — `prompt` and `lead` became `Look`. The two are one statement: a wand beside
  `Search the backlog` would be a field saying two things at once.
- `BacklogPaneHeader` — `narrows: Bool` and the four values behind the field became
  `narrowing: Narrowing?`. **Absence rather than a flag**: everything the field needs is inside the
  thing that is absent.
- `TicketsRoom.Held` — `query` and the ask became `Held.Field`, and `Held` moved to
  `TicketsRoom+Held.swift` with the sheet in `TicketsRoom+Asking.swift`, both off
  `type_body_length`.
- `BacklogAskAffordance.Offer` — five parameters became an **enum of two lines**. The mark, the
  words, the key and the emphasis are all decided by which verb the line offers.

## Judged

`/pixel-review` against [`found.png`](backlog-question/found.png),
[`asking.png`](backlog-question/asking.png) and
[`answered.png`](backlog-question/answered.png), all three **re-rendered by this ticket** — see
below. Measured at true pixels against a control shot of the shipped field holding a plain term,
so an inherited defect could be told from a new one.

**Clean, measured:** the field's capsule (the suspicion that it had gone was refuted — it draws,
and is pixel-identical to the shipped field's); the width (268 exactly, trailing edge coincident
with the 210 field's); the offer's geometry (edge-flush with the field, as `= the field's` asks);
the sheet (content only, `Start` still standing, insets 34/32); and **the list, which is
pixel-identical across all three states** — not cleared, not dimmed, not moved.

**Fixed after judging:** `Close` was drawn as a second filled button and is now plain; the read
line had lost half the words the design states and is restored; the offer panel's edge was darker
than its own ground (a shadow, no rim) and now carries the hairline.

**Two divergences stand, both stated rather than waved off:**

1. **The still shows the field's HEAD, not its tail.** The design decides the tail stays visible,
   and a focused field draws it — but a render can only focus programmatically, which SELECTS ALL
   and scrolls to the head. macOS 14 has no `TextSelection` to place a caret, so no still can
   reproduce a typed one. This is the case the design already names: *"Detection cannot be judged
   from a still… it needs a real keyboard."* `argoOpensSearchFocused` is what a render sets to get
   as close as a still gets.
2. **The wait bar's accent run is not distinguishable at 2pt in a still.** It used to draw
   *nothing* — `ArgoMotion.working` has no reduced answer and every render forces Reduce Motion,
   so the run parked off the end of its own track. It now parks ON the track, which is the fix
   that matters; whether the accent reads at that size is open.

## What this ticket did to the design

Three changes, each because building it found the design wrong rather than because the code was:

- **The example question was reworded.** It drew `spacing between nodes on the chart` — a noun
  phrase caught only by the six-word floor #1316 failed, and structurally identical to the pasted
  titles that floor misread. Under the shipped rule the old string is a TERM, so `found.png` drew
  a state no reader could reach.
- **The drawn field showed its head.** `unicode-bidi: plaintext` took the paragraph direction from
  the first strong character, which for English is LTR, so the design's own `direction: rtl` trick
  was inert and the render contradicted the decision above it.
- **The elapsed line drew `2.4s`.** #1315 measured the wait and the design's own **The wait,
  measured** says a rendering should carry the honest figure. It now draws `4.4s`.
