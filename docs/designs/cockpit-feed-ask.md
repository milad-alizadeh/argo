<!-- status: approved
     approved-at: HEAD
     prototype: worktree-ticket-534-ask-options -->

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
| answered | [`answered.png`](feed-ask/answered.png) | none | `text.tertiary` |
| undriveable (#546) | [`unavailable.png`](feed-ask/unavailable.png) | none — the row is a reading | `text.tertiary` |

**The row is carried by its ground alone.** No rule around it and no leading accent bar: an
amber stroke on four edges reads as an alert banner dropped into the column rather than as a row
of it. Answered, the ground goes and nothing moves.

## Measurements

| Measurement | Value | Source |
|---|---|---|
| Card radius | `ArgoRadius.control` 6 | the row is a control-scale surface, not a popover |
| Card padding | `comfortable` 12 top, `loose` 16 sides and bottom | the extra bottom is the answer row's own breathing space |
| Between two questions in one call | `ArgoSpacing.loose` 16 | |
| Question head → its options | `ArgoSpacing.comfortable` 12 | |
| Ask glyph | `ArgoSymbol.asked` (`questionmark.bubble`) at `ArgoIconSize.inline` 10 | already the feed's mark for an ask |
| Glyph column | `ArgoFeedRow.markerWidth` 18, trailing-aligned, `markerGap` 6 | the feed's own marker grid |
| Question type | `ArgoTypography.rowTitle` — body 13, medium | |
| Options indent | 24 = `markerWidth` + `markerGap` | the options hang off the question's own grid |
| Between options | `ArgoSpacing.snug` 6 | |
| Option ground | `surface.control` | "the ground under a control on a surface which is not the deck" — its own words |
| Option hover | `surface.hover` laid over `surface.control`; edge `edge.hairline` → `edge.subtle` | two layers, not a third opacity standing for the pair |
| Option pressed | **none** | one click answers, so it would be on screen for a few frames |
| Option border, radius | `edge.hairline`, `ArgoRadius.control` 6 | |
| Option padding | `base` 8 vertical, `comfortable` 12 horizontal | |
| Option number | `ArgoTypography.machineCaption` 11, `text.tertiary`, in an 18 column, trailing-aligned | monospaced so a two-digit list keeps one vertical |
| Number → label | `ArgoSpacing.comfortable` 12 | |
| Option label / detail | `ArgoTypography.body` `text.primary` / `rowMeta` `text.tertiary` | |
| Option ticked | ground `state.wash(attention)`, edge `state.rim(attention)`, number `state.attention` | the two rungs below `muted`, which the card itself wears |
| Checkbox | `ArgoComposerVessel.askBoxSize` **14**, `ArgoRadius.marker` 3, edge `edge.strong` | **promoted for this design** — see below |
| Checkbox ticked | ground `state.attention`, `ArgoSymbol.chosen` at `.inline`, ink `text.onAccent` | |
| Answer field and button | both `ArgoComposerVessel.decisionHeight` **27**, `ArgoSpacing.base` 8 apart | one height, so the row has one top and one bottom |
| Field | no ground; edge `edge.hairline` → `interaction.accent` focused; radius 6; padding-x 12 | `ComposerField` draws no ground either |
| Field type | `ArgoTypography.body` on `ArgoFeedRow.lineHeight` 20 | the feed's rhythm, not the font's own 18.85 |
| Answer button | `decisionMinimumWidth` 80 × `decisionHeight` 27, `interaction.accent`, `text.onAccent`, `ArgoTypography.control` | the Permission prompt's Allow, at its own measurements |
| Answer button, nothing to send | ground `surface.marked`, ink `text.disabled` | |
| Keycap | `ArgoTypography.machineCaption` on `surface.marked`, radius `marker` 3, padding `hair` 2 × `tight` 4 | `PermissionKeycap`'s own values |
| Settled options | gap `ArgoSpacing.hair` 2; taken `text.primary` + `ArgoSymbol.chosen` in `state.attention`; untaken `text.disabled` | `FeedAskOptions` already quiets the untaken |
| Hover motion | `ArgoMotion.selection` — 0.14, easeOut | it is a selection |

### The one promotion

`ArgoComposerVessel.askBoxSize = 14`, landed with this design. A many-of ask needs a box and the
contract had no measurement for one. It sits between `ArgoIconSize.inline` (10), too small to
aim at, and `chipDismissDiameter` (18), which is a control's whole hit area rather than a box
drawn beside a label. Everything else on this screen snapped to a token that already existed.

## Components

Frozen names — they become the view files and the ticket titles.

| Name | What it is | Status |
|---|---|---|
| `FeedAskLine` | the card: one call, one ground, its questions | exists (#534) — gains the waiting branch |
| `FeedAskOptions` | the settled reading, numbered and quieted | exists (#534) — unchanged |
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
