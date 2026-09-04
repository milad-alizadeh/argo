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

## The thesis

**A question and its answer are one fact, so they are one paragraph.**

The answer alone says nothing — *The design route* is not a fact until you know what was asked.
The question alone is finished business. Stacking them as two rows is the lazy reading of that;
setting the answer **inline, as the resolution of the question's own sentence**, is the honest
one — and it is also the cheapest, because where the answer fits on the question's last line the
whole decision is one line and the fold paid nothing for it.

Everything else stays exactly where the feed already puts it. The ask glyph keeps the marker
column its offers were numbered in; the words keep the prose column after it. The palette, the
radii, the spacing steps and the single typeface are **not open here** — they are ArgoDesign's,
and the app has one theme. The setting is the whole of what this drawing spends itself on.

**What the thesis gives up**, stated plainly: the answer no longer has a fixed x. You cannot run
your eye down a column of answers. You scan the marker column for *where a decision happened*,
stop, and read the sentence — which is what a transcript is for. The `chip` treatment exists to
buy some of that back.

## Reading the URL

| Parameter | Effect |
|---|---|
| `?variant=now\|inline\|chip\|stack` | Which fold. Also `←`/`→`, or the bar at the bottom. |
| `&ink=answer\|question` | Which half of the pair carries the ordinary ink. |
| `&offer=out\|disclose` | Whether the full numbered offer stays reachable. |
| `&case=pick\|long\|two\|free\|none\|reported` | Which ask. Also `↑`/`↓`. |

Every state is reachable by URL, which is the point — a state you cannot link to is a state
nobody re-checks.

The column draws the **same ask three times**: waiting, settled as it ships today, and settled
in the chosen fold. The panel on the right measures all three, because "materially less
vertical" is a number and not an opinion. The strip between them is the lane
(`MinimapAskCard`), drawn off the rendered card, so a fold the lane cannot follow is visible
rather than inferred.

## The three folds

| | What it is | What it costs |
|---|---|---|
| **inline** | The answer resolves the question's sentence: a mark, then its words, in the same paragraph, at `text.primary` against a `text.secondary` question. | The answer has no fixed x, and a long one breaks across lines mid-phrase. |
| **chip** | The same paragraph with the answer set as an object — a capsule at `surface.control` that wraps *with* the text (`box-decoration-break: clone`, so both fragments keep rounded ends). | A shape in the middle of a sentence. |
| **stack** | The answer as a row of its own under the question, mark in the marker column. The reading this drawing started from, kept as the thing to beat. | Always a whole line, even when the answer is two words and the question ended mid-column. |

The mark is `checkmark` where an option was named and a **continuation** mark where none was —
a tick over words nobody offered claims a pick that never happened. For the same reason the chip
declines to draw a capsule around a prose answer: a capsule says *a thing that was offered, and
taken*, and the shape must not claim what the mark is careful not to.

## The numbers

Measured in the browser at the 672pt column the feed draws, `now` being what ships today.
Heights in points, per case. `inline` and `chip` measure identically — the capsule adds no line.

| Case | waiting | today | inline / chip | stack |
|---|---|---|---|---|
| `pick` — one-of, 3 offers | 216 | 116 | **44** | 68 |
| `long` — 5 offers, question wraps to 2 lines | 324 | 184 | **84** | 88 |
| `two` — two questions, one call | 281 | 172 | **76** | 124 |
| `free` — free-form | 83 | 44 | 44 | 68 |
| `none` — no option named | 182 | 116 | **64** | 68 |
| `reported` — companion plugin | 167 | 121 | **73** | 97 |

A settled ask is **20–44% of the same ask waiting**. Against what ships today the inline fold
saves 72pt on the ordinary case and 96pt where one call carried two questions — because there
each answer joins its own question's line, and the stacked reading pays for two extra rows.

`free` lands on 44pt, which is exactly what it costs today — and today's 44pt **does not include
the answer at all**. Same height, one more fact.

## What building it exposed

1. **A settled free-form ask draws no answer at all today.** `FeedAskQuestion` draws
   `FeedAskOptions` only `if !offers.isEmpty`, and a free-form question offered none. So the row
   states the question and stops: what the person typed is not on screen anywhere. Only visible
   by drawing the case.
2. **Neither is an answer that named no option.** `FeedAsk.chosen(in:)` is deliberately weak — it
   reads the answer for a label it *contains*. Where none matches, `anyChosen` is false, so every
   offer stays full-length and unquieted and the answer is again nowhere. `none` is that case,
   and today it is the worst row in the feed: full height, no tick, no answer.
3. **The fold has to carry the record's own prose, not only a label** — which follows from 1 and
   2, and is why the mark has two spellings.
4. **Truncating the question was the wrong economy.** It was drawn first and it reads badly: the
   row states a question nobody can finish reading, and it saves 18pt. The length is in the
   OFFER, and taking the offer out is worth 72pt on the same case.
5. **Two rows was the wrong structure**, which is a bigger finding than the first: it is the
   `two` case that shows it, where stacking costs 124pt against 76pt for the same six facts.
6. **A disclosure must REPLACE the answer, not join it.** Drawn as the fold plus the list, the
   chosen option appears twice. The chevron sits at the end of the sentence — where the sentence
   finishes — and what it opens takes the answer's place.
7. **A reported row is settled by definition.** Argo answers a companion-plugin call the moment
   it arrives (#1205), so the fold is the state that row is *always* in. The caption stays.
8. **The ordinal has nowhere to go.** The settled reading numbers its options because the number
   is how an answer names one. A sentence has no marker column to put it in. Whether the fold
   keeps `2.` before the answer's words is a call the design has to state.

## What it is faithful to, and what it is not

Every colour, radius, spacing step and type role is transcribed from
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/` and from `ArgoFeedRow.swift` —
`askCardInset` 12, `markerWidth` 18, `markerGap` 6, `stepBeforeProse` 2, `askOptionGap` 4,
`blockStep` 12, prose 13 on `lineHeight` 20. `chosen(in:)` and `FeedAskOffer.numbered` are
transcribed line for line, so the cases resolve exactly the way the app resolves them. The
waiting card is `FeedAskOfferList` as #712 shipped it and **nothing here touches it**.

The two symbols are **drawn** to match SF's `questionmark.bubble` and `checkmark`, because the
browser has no access to SF Symbols and a `?` typed as a character sits on the text baseline at
the text weight — it reads as punctuation somebody left behind, not as a mark in a column.

The lane is a **sketch** of `MinimapRowShape.card`, taken off the rendered row's client rects
rather than from `ProseMetrics` — enough to show the fold shortens the lane too, not enough to
state a lane measurement from. Note that an inline answer gives the lane a **part-line**, which
is a shape `MinimapProseWords` does not draw today.

It is **not** a component structure or anything to port line by line.

## What happens next

The winning fold goes into `docs/designs/cockpit-feed-ask.md` — the **Settled — the reading**
table and a render in `feed-ask/` — via `prototype-to-design`, and #1207 is built from that with
`design-to-code`. This file and its HTML move to a throwaway branch at that point, with a
pointer left on the issue.
