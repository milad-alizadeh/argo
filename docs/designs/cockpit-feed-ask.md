<!-- status: built
     approved-at: 068e7370
     built-at: 8188bad7
     prototype: worktree-ticket-534-ask-options
     amended-at: d641ebdb
     amendment: #1207 — the settled fold. BUILT at 604c0d7f: every row of
                "Settled — the reading" marked `to build` is now what the app draws.
     amendment-prototype: worktree-ticket-1207-settled-ask-fold
     amendment-built-at: 604c0d7f -->

# Answering an ask, in the feed

The approved design for **how a Session's question gets answered** (#712). The answer is given
in the feed row where the question was asked. **There is no vessel**, and the composer's slot is
not involved: the composer talks to the Session, it does not answer it.

**The renders in [`feed-ask/`](feed-ask/) are the spec.** The measurements below are the numbers
a ticket must carry.

The study lives at
[`prototypes/ask-vessel-prototype.html`](prototypes/ask-vessel-prototype.html), where every
state is reachable by URL. It is there to be re-explored, not built from.

## What won, and what lost

Three shapes were drawn. Two put the question in the composer's slot the way a Permission
already sits there — as a block with an attention rim, or as a strip of chips above a field that
never leaves. Both lost for the same reason, and it is visible in their renders: **they draw the
question twice**, once in the feed row #534 already ships and once in the vessel a few hundred
pixels below.

The winner makes the row #534 already draws into the thing you press. It is the shape Claude
Code's own desktop client uses, and it follows from what #534 settled rather than working
against it: the row *is* the numbered list the prompt offered, so making that list pressable
while it waits costs one state and no new surface.

What it gives up is a fixed place to look — the affordance moves with the scroll, and a long
feed can put the question off screen. That is the accepted cost.

**This supersedes #712's own "What to build".** The ticket proposes `AskPromptProjection` and a
`case ask` on `DeckVessel`, in the resolution order
`unavailable → permission → ask → composer`. There is no `case ask`: the vessel resolution is
unchanged, and the ask is a feed row. The engine half of the ticket — a live handle on
`HubSession`, keyed by request id, arriving over the companion plugin — stands exactly as
written.

## A click is the answer

| Question | How it is answered | Why |
|---|---|---|
| one-of | click an option — that is the whole act | no confirm step, and **no button at all**: a control that can never be the thing you press is a control that lies |
| many-of | tick boxes, type beside them, then `Answer` | a second click is a second answer rather than a correction, so the act has to be closed |
| free-form | type in the row's own field, then `Answer` | there is nothing to click |
| several in one call | one ground, one mark each, answered top to bottom | one `AskUserQuestion` is one thing the agent is waiting on; two grounds put a seam through a single stop |

**`Other` carries no number.** The feed numbers only what was offered
(`FeedAskOffer.numbered`), so a numbered `Other…` would put the ordinals one past the ones the
answer names — and #712 requires that they agree. On a one-of question it is the last row, and
opening it swaps the pick for a field. On a many-of question the field is **already open beside
the boxes**, because ticking two and adding a word is one answer, not two acts.

**The answer names its question.** An ordinal alone does not identify an option: in a call
carrying two questions both number from 1. The payload is `(question, ordinals, other)`.

**`esc` is unbound.** An ask has no refusal — no answer means *no*. That is exactly what
separates it from a Permission, where `esc` denies. The digits the rows already draw pick; `⏎`
sends where there is something to send.

**An undriveable Session draws no affordance at all** (#546), and the reason takes the deck's
foot as `ComposerUnavailable` already draws it. The row above stays a reading.

## States

| State | Render | Ground | Glyph ink |
|---|---|---|---|
| one-of, waiting | [`one-of.png`](feed-ask/one-of.png) | `state.muted(attention)` | `state.attention` |
| many-of, waiting | [`many-of.png`](feed-ask/many-of.png) | `state.muted(attention)` | `state.attention` |
| two questions, one call | [`two-questions.png`](feed-ask/two-questions.png) | one ground for both | `state.attention` |
| free-form, waiting | [`free-form.png`](feed-ask/free-form.png) | `state.muted(attention)` | `state.attention` |
| answered — **folded** (#1207) | [`answered.png`](feed-ask/answered.png) | none | `text.tertiary` |
| answered, no option named (#1207) | [`answered-unnamed.png`](feed-ask/answered-unnamed.png) | none | `text.tertiary` |
| undriveable (#546) — pending, so **not folded** | [`unavailable.png`](feed-ask/unavailable.png) | none — the row is a reading | `text.tertiary` |

**#1207's two renders are column crops, not window shots**, unlike the six above them: the fold
changes a row, not a screen, and a half-built shell around it would be a drawing of chrome
nobody checked. `/pixel-review` judges the built row against the running app — the three
specimens it renders are `feedAskAnswered`, `feedAskAnsweredUnnamed` and `feedAskAnsweredFreeForm`,
judged against `feedAskOneOf`, which is the same question waiting.

**The row is carried by its ground alone.** No rule around it and no leading accent bar: an
amber stroke on four edges reads as an alert banner dropped into the column rather than as a row
of it. Answered, the ground goes and nothing moves.

## Measurements

**`ships` means the value is in the app today; `to build` means #712 puts it there.** Read the
column — a table that does not say which is which reads as satisfied when half of it is not.
Nothing here changes a value #534 already shipped: where the two disagreed, this design was
corrected to the code, not the other way round.

### The card — `FeedAskLine`

| Measurement | Value | | Source |
|---|---|---|---|
| Radius | `ArgoRadius.control` 6 | ships | a control-scale surface, not a popover |
| Padding | `ArgoSpacing.comfortable` 12, all four | ships | |
| Between two questions in one call | `ArgoFeedRow.blockStep` — `comfortable` 12 | ships | one call, one ground: the step is within a block, not between rows |
| Waiting ground | `state.muted(attention)` | ships | |
| Waiting edge | **none** | **to build** | today the row strokes its edge in the attention ink; the waiting row is carried by its ground alone, so #712 **removes** that stroke |
| Settled ground and edge | none | ships | |
| Ask glyph | `ArgoSymbol.asked` (`questionmark.bubble`) at `ArgoIconSize.inline` 10 | ships | |
| Glyph ink | `state.attention` waiting, `text.tertiary` settled | ships | |
| Glyph column | `ArgoFeedRow.markerWidth` 18 trailing, `markerGap` 6 | ships | the feed's own marker grid, via `feedMarkerColumn()` |
| Question type | `ArgoFeedRow.proseRung` — body 13, regular, `text.primary` | ships | no weight of its own: the ground and the mark already carry it |
| Question head → what is under it | `stepBeforeProse` — `hair` 2 | ships | the offer where the row is a pending reading, the answer where it is settled (#1207) |
| Question head → its options | `ArgoSpacing.comfortable` 12 waiting | **to build** | pressable cards need the room a bare list does not |

### Waiting — the pressable options

All **to build**. `FeedAskOfferList`, `FeedAskOfferRow`, `FeedAskAnswerRow`.

| Measurement | Value | Source |
|---|---|---|
| List indent | 24 = `markerWidth` + `markerGap` | the cards hang under the question's words, not under its mark |
| Between options | `ArgoSpacing.snug` 6 | |
| Option ground | `surface.control` | "the ground under a control on a surface which is not the deck" — the role's own words |
| Option hover | `surface.hover` laid over `surface.control`; edge `edge.hairline` → `edge.subtle` | two layers, not a third opacity standing for the pair |
| Option pressed | **none** | one click answers, so it would be on screen for a few frames |
| Option border, radius | `edge.hairline`, `ArgoRadius.control` 6 | |
| Option padding | `base` 8 vertical, `comfortable` 12 horizontal | |
| Option number | **`FeedMarker`** — `proseRung`, monospaced digits, `text.tertiary`, 18 trailing | the settled reading numbers its options with exactly this, so a pressable option and a read one carry the same digit in the same column |
| Number → label | `ArgoFeedRow.markerGap` 6 | the same grid, so the two states do not shift under each other |
| Option label / detail | `ArgoFeedRow.proseRung` `text.primary` / `ArgoTypography.rowMeta` `text.tertiary` | |
| Option ticked | ground `state.wash(attention)`, edge `state.rim(attention)`, number `state.attention` | the two rungs below the `muted` the card itself wears |
| Checkbox | **14**, `ArgoRadius.marker` 3, edge `edge.strong` | a **proposal**, not yet a token — see below |
| Checkbox ticked | ground `state.attention`, `ArgoSymbol.chosen` at `.inline`, ink `text.onAccent` | |
| Field and button | both `ArgoComposerVessel.decisionHeight` 27, `ArgoSpacing.base` 8 apart | one height, so the row has one top and one bottom |
| Field | no ground; edge `edge.hairline` → `interaction.accent` focused; radius 6; padding-x 12 | `ComposerField` draws no ground either |
| Field type | `ArgoFeedRow.proseRung` on `ArgoFeedRow.lineHeight` 20 | the feed's rhythm, not the font's own 18.85 |
| Answer button | `decisionMinimumWidth` 80 × `decisionHeight` 27, `interaction.accent`, `text.onAccent`, `ArgoTypography.control` | the Permission prompt's Allow, at its own measurements |
| Answer button, nothing to send | ground `surface.marked`, ink `text.disabled` | |
| Keycap | `ArgoTypography.machineCaption` on `surface.marked`, radius `marker` 3, padding `hair` 2 × `tight` 4 | `PermissionKeycap`'s own values |
| Hover motion | `ArgoMotion.selection` — 0.14, easeOut | it is a selection |

### The three readings a row that is not pressable can be

**Amended by #1207.** #534 and #712 branched on one question — *is this row the thing you
press?* — and everything that was not got the same drawing: the question, then every option it
offered, one line each. That put two different facts in one shape. There are **three** readings,
and the fold applies to exactly one of them.

| Reading | When | What it draws | |
|---|---|---|---|
| **waiting** | `isPending && live != nil` | the pressable cards, the field, `Answer` | ships |
| **pending, not pressable** | `isPending && live == nil` | the numbered offer, exactly as #534 built it | ships |
| **settled** | `isAnswered` | the fold below — the question and the way it went | **to build** |

**The branch is on `isAnswered`, not on `waiting == nil`.** Three rows are pending and not
pressable, and every one of them would be wrecked by folding: a question on a Session Argo
cannot drive (#546), one whose gate has not raised it yet, and one reported over the companion
plugin — which `FeedProjection+Ask.reported` builds `isAnswered: false`, so it is **never** a
settled row whatever the caption says. None of the three has an answer, so a fold there would
draw a decision nobody made.

### Settled — the reading

**The offer folds out; the question stays whole.** What a settled ask loses is its list of
options, not the words somebody was asked: a truncated question is a fact the row stops stating,
and truncating it saves 18pt where dropping the offer saves 96. So the settled block is the
question, wrapping in full, and **one row under it carrying the way it went** — on the same
marker grid the offers were numbered on.

**Every option that was not taken stops being a line, and is not reachable.** No disclosure: an
offer the record has settled is history, and a control to reopen it is a control for reading
what the answer already tells you.

| Measurement | Value | | Source |
|---|---|---|---|
| Question | `ArgoFeedRow.proseRung`, `text.primary`, wraps in full, never truncated | ships | the loud half: the answer is meaningless without it |
| Question → its answer | `ArgoFeedRow.stepBeforeProse` — `hair` 2 | ships | the step the offer used to take |
| Answer mark | `ArgoSymbol.chosen` at `ArgoIconSize.inline` 10, `text.tertiary` | **to build** | in `markerWidth` 18 trailing, `markerGap` 6 — the column the offers were numbered in |
| Answer mark, where the answer named no option | **`ArgoSymbol.answered`** at `.inline`, `text.tertiary` | **to build** | a **promotion** — see below |
| Answer words | `ArgoFeedRow.proseRung`, `text.secondary`, wraps | **to build** | a step back, not out: it is history, and the question above it is what a reader needs first |
| The offer | **not drawn** | **to build** | |
| Between two questions in one call | `ArgoFeedRow.blockStep` 12, unchanged | ships | the fold applies per question; one call is still one ground |

**Heights it settles**, measured in the PROTOTYPE at the 672pt column, against what the same row
costs waiting. The built row was measured again at the same column and comes in lower than the
drawing promised — one question with three options: **208 waiting, 106 settled today, 62 folded**,
which is 30% of waiting. `FeedAskFoldTests` is where those numbers are held:

| The ask | waiting | settled today | settled folded |
|---|---|---|---|
| one-of, 3 offers | 216 | 116 | **68** |
| one-of, 5 offers, question wraps to 2 lines | 324 | 184 | **88** |
| two questions in one call | 281 | 172 | **124** |
| free-form | 83 | 44 | **68** |
| answered, no option named | 182 | 116 | **68** |

A settled ask is **27–41%** of the same ask waiting. `free-form` is the one row that grows, 44 →
68, and it grows because **today it draws no answer at all** — `FeedAskQuestion` draws the
options only `if !offers.isEmpty`, so what the person typed has never been on screen. Same for an
answer that named no option: `chosen(in:)` matches nothing, `anyChosen` is false, and today every
offer stays full-length while the answer appears nowhere. The fold puts both on screen for the
first time.

### The one promotion

**`ArgoSymbol.answered` = `arrow.turn.down.right`.** The answer row needs a mark, and it cannot
always be `chosen`: `FeedAsk.chosen(in:)` is DERIVED and deliberately weak — it reads the answer
for a label it *contains* — so a free-form answer, and any answer that agreed with nothing on the
list, names no option. A tick over words nobody offered claims a pick that never happened, which
is the one thing degrade-down forbids. The mark says **continues** there instead.

It carries the same SF name as `ArgoSymbol.delegated`, and is a second role rather than a reuse
of that one: `delegated` means *a subagent went from here*, and one word has one meaning
(`externalFile` and `openOnHost` already share `arrow.up.forward.square` on the same ground).

Everything else on this screen **snapped** to a token that already existed.

### The one proposal

**The checkbox, 14pt.** A many-of ask needs a box and the contract has no measurement for one.
It sits between `ArgoIconSize.inline` (10), too small to aim at, and `chipDismissDiameter` (18),
which is a control's whole hit area rather than a box drawn beside a label.

It is a **proposal** and not yet in `ArgoComposerVessel`, per `rules/swift.md`: the token
lands with the view that reads it, in #712. Everything else on this screen snapped to a token
that already existed.

## Components

Frozen names — they become the view files and the ticket titles.

| Name | What it is | Status |
|---|---|---|
| `FeedAskLine` | the card: one call, one ground, its questions | exists (#534) — gains the waiting branch, and **loses its stroked edge**. #1207 splits its reading branch in two, on `isAnswered` |
| `FeedAskOptions` | the offer as a reading, numbered and quieted | exists (#534) — #1207 narrows it to the **pending** reading; a settled row no longer draws it |
| `FeedAskAnswer` | the settled row: the mark, and the way it went | new — #1207, built |
| `FeedMarker` | the marker column, for numbers and marks alike | exists (#534) — unchanged |
| `FeedAskOfferList` | the pressable options while it waits | new |
| `FeedAskOfferRow` | one option — number, label, detail, box | new |
| `FeedAskAnswerRow` | the field and its `Answer` button | new |
| `FeedAskProjection` | what the row states, derived off the presentation | new — replaces #712's `AskPromptProjection` |

## What the prototype exposed that the renders do not show

1. **`Other` cannot carry a number** without putting the ordinals one past what the feed draws.
   Only visible by drawing both.
2. **An ordinal alone does not name an option.** Two questions in one call both number from 1,
   so the answer must carry the question too. The prototype prints its payload for this reason.
3. **One call is one ground.** Drawn as two cards, two questions put a seam through a single
   stop — a seam that is obvious in motion and easy to miss in prose.
4. **`min-height` is not a height.** The field and its button, both floored at 27 and stretched,
   still settled a couple of points apart. Both now state the height.

## What the #1207 prototype exposed

Drawn in `settled-ask-fold-prototype.html` on `worktree-ticket-1207-settled-ask-fold`, against
the shipped row at the same width, with every height measured.

1. **A settled free-form ask has never drawn its answer.** `FeedAskQuestion` draws its options
   only `if !offers.isEmpty`, and a free-form question offered none, so the row states the
   question and stops. Nobody saw it because nobody drew that case beside the others.
2. **Neither has an answer that named no option.** `chosen(in:)` matches nothing, `anyChosen` is
   false, so every offer stays full-length and unquieted and the answer is again nowhere. Today
   that is the worst row in the feed: full height, no mark, no answer.
3. **Three readings, not two** — the finding that decides the build. Today's branch is
   `waiting == nil`, which draws a settled row and a pending-but-unpressable one identically. The
   fold must branch on `isAnswered`, or it folds #546's row and #1205's into an answer neither
   of them has.
4. **Truncating the question was the wrong economy.** Drawn first, and it reads badly: the row
   states a question nobody can finish, and it saves 18pt where taking the offer out saves 96.
5. **The lane folds with the row or the map stops matching the column.**
   `MinimapRowShape.asked` lays a line per offer at `askOptionGap`; under the fold a settled card
   is the question's lines plus one. `askOptionGap` survives — the pending reading still uses it.
6. **A disclosure was drawn and dropped.** Keeping the offer behind a chevron costs a control on
   a row that has never had one, and re-reads what the answer already says. It also has to
   *replace* the answer rather than sit above it, or the chosen option appears twice.
