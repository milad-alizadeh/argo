# The settled ask, folded — throwaway prototype (#1207)

**This is a primary source, not a starting point.** It exists so the fold
[#1207](https://github.com/milad-alizadeh/argo/issues/1207) asks for can be *looked at and
measured* rather than argued about. It was written under prototype constraints — no tests, no
abstractions, one file — and the decision it settles will live in
[`../cockpit-feed-ask.md`](../cockpit-feed-ask.md), not here.

## Run it

```sh
open docs/designs/prototypes/settled-ask-fold-prototype.html
```

No build, no server, no dependencies.

## The question

*An answered `AskUserQuestion` is drawn at full length. What should it fold to?*

Today a settled ask draws the question in full, then every option it offered, one line each,
with a tick beside the one taken. `FeedAskLine` degrades the **ink** — the ground goes, the
glyph drops to `text.tertiary` — and nothing at all degrades the **length**. History costs what
a live question costs.

## Reading the URL

| Parameter | Effect |
|---|---|
| `?variant=now\|A\|B\|C\|D` | Which fold. Also `←`/`→`, or the bar at the bottom. |
| `&case=pick\|long\|two\|free\|none\|reported` | Which ask. Also `↑`/`↓`. |

Every state is reachable by URL, which is the point — a state you cannot link to is a state
nobody re-checks.

The column draws the **same ask three times**: waiting, settled as it ships today, and settled
in the chosen fold. The panel on the right measures all three, because "materially less
vertical" is a number and not an opinion. The strip between them is the lane
(`MinimapAskCard`), drawn off the rendered card, so a fold the lane cannot follow is visible
rather than inferred.

## The four folds

| | What it is | Cost |
|---|---|---|
| **A** | The question truncated to one line, and the chosen option's words under it on the indent they were offered on. | The unchosen offers are gone and not reachable. |
| **B** | One line: the question and the answer sharing the column. | They compete. At the `long` case both truncate and neither is readable. |
| **C** | The answer is the row at the prose rung; the question drops to the meta rung under it. | The ask glyph goes, so the row stops reading as a question at all. |
| **D** | A, plus a disclosure that swaps the answer line for the full numbered offer. | A control on a row that has never had one. |

## The numbers

Measured in the browser at the 672pt column the feed draws, `now` being what ships today.
Heights in points, per case.

| Case | waiting | today | A | B | C | D collapsed |
|---|---|---|---|---|---|---|
| `pick` — one-of, 3 offers | 212 | 110 | **65** | 44 | 61 | **65** |
| `long` — one-of, 5 offers, question wraps | 316 | 174 | **65** | 44 | 61 | **65** |
| `two` — two questions, one call | 275 | 162 | **118** | 76 | 111 | **119** |
| `free` — free-form | 82 | 43 | 65 | 44 | 61 | 65 |
| `none` — no option named | 178 | 110 | **65** | 44 | 61 | **65** |
| `reported` — companion plugin | 163 | 115 | **93** | 72 | 89 | **93** |

A settled ask under fold A is **21–37% of the same ask waiting**, and it is a **fixed** height
whatever was offered: five offers cost what three do, which is the whole of the complaint.

`free` is the one row that grows, from 43 to 65, and that is a **bug being fixed rather than a
cost being paid** — see below.

## What building it exposed

1. **A settled free-form ask draws no answer at all today.** `FeedAskQuestion` draws
   `FeedAskOptions` only `if !offers.isEmpty`, and a free-form question offered none. So the row
   states the question and stops: what the person typed is not on screen anywhere. Only visible
   by drawing the case.
2. **Neither is an answer that named no option.** `FeedAsk.chosen(in:)` is deliberately weak — it
   reads the answer for a label it *contains*. Where none matches, `anyChosen` is false, so every
   offer stays full-length and unquieted and the answer is again nowhere. `none` is the case, and
   today it is the worst row in the feed: full height, no tick, no answer.
3. **A fold has to carry the record's own prose, not only a label.** Which follows from 1 and 2:
   the answer line is a label where an option was named and the record's prose where it was not,
   at a quieter rung, because prose is what it is.
4. **A disclosure must REPLACE the answer line, not join it.** Drawn as A-plus-the-list, the
   chosen option appears twice, two lines apart. `D` swaps them.
5. **The fold applies per question, not per card.** In `two` the step between the questions stays
   `blockStep` 12 and each question folds on its own, which is what keeps one call one ground.
6. **A reported row is settled by definition.** Argo answers a companion-plugin call the moment
   it arrives (#1205), so the fold is the state that row is *always* in — the caption stays under
   it and costs the 28pt the table shows.
7. **The ordinal has nowhere to go.** The settled reading numbers its options because the number
   is how an answer names one. A fold that draws one line has no column for it: A and D put the
   tick in the marker column where the number was. Whether the fold keeps `2.` with a trailing
   tick instead is a call the design has to state.

## What it is faithful to, and what it is not

Every colour, radius, spacing step and type role is transcribed from
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/` and from `ArgoFeedRow.swift` —
`askCardInset` 12, `markerWidth` 18, `markerGap` 6, `stepBeforeProse` 2, `askOptionGap` 4,
`blockStep` 12. `chosen(in:)` and `FeedAskOffer.numbered` are transcribed line for line, so the
cases resolve exactly the way the app resolves them. The waiting card is `FeedAskOfferList` as
#712 shipped it and **nothing here touches it**.

The lane is a **sketch** of `MinimapRowShape.card`, derived from the rendered row rather than
from `ProseMetrics` — enough to show that the fold shortens the lane too, not enough to state a
lane measurement from.

It is **not** a component structure or anything to port line by line.

## What happens next

The winning fold goes into `docs/designs/cockpit-feed-ask.md` — the **Settled — the reading**
table and a render in `feed-ask/` — via `prototype-to-design`, and #1207 is built from that with
`design-to-code`. This file and its HTML move to a throwaway branch at that point, with a
pointer left on the issue.
