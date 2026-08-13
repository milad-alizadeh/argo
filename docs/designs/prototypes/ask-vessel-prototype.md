# Ask vessel — throwaway prototype (#712)

**This is a primary source, not a starting point.** It exists so the design pass
[#712](https://github.com/milad-alizadeh/argo/issues/712) is blocked on can be *looked at*
rather than argued about. It was written under prototype constraints — no tests, no
abstractions, one file — and the decision it settles will live in the spec, not here.

## Run it

```sh
open docs/designs/prototypes/ask-vessel-prototype.html
```

No build, no server, no dependencies.

## The question it answers

*What does the cockpit put in the composer's slot when a Session asks a question?*

#712 says the vessel has no design and lists five things a design pass has to settle. Every
variant below answers all five, so the five are compared together rather than one at a time.

## Reading the URL

| Parameter | Effect |
|---|---|
| `?variant=A\|B\|C` | Which vessel. Also `←`/`→`, or the floating bar at the bottom. |
| `&case=pick\|multi\|many\|free\|unavailable` | Which question is live. Also the dropdown. |
| `&picked=1,3` | Options already taken on the first question. |
| `&other=some+text` | The free-text answer already typed. |
| `&sent=1` | The answer already given — the settled feed row and the composer back at rest. |

A state you cannot link to is a state nobody re-checks, which is why the two that need a click
to reach are on the URL as well.

## The three variants

- **A — the block.** The Permission vessel's own shape: one glass surface with an attention rim,
  the question as its subject, the options as the numbered list the terminal offered. One
  question at a time; several walk a stepper with pips. `Other…` opens a field under the list.
  Free-form skips the list and shows the ordinary field.
- **B — the strip.** The composer never leaves. The question rides above the field it already
  has and the options are numbered chips. The claim: an ask narrows what you can type, it does
  not replace typing — so **typing IS the `Other` answer** and `Other` never needs a row.
  Several questions stack as several rows of chips.
- **C — the live row.** The question is drawn exactly **once**, where it was asked. The ask row
  in the feed goes live: its numbered options are pressable and the row says to type in the
  composer instead if none of them fit. Picking one drops a chip carrying the **ordinal** into
  the ordinary composer, and the send arrow answers — so the composer stays the composer and
  never repeats the question. Editing the words in the field cannot change which option the
  answer names, because the ordinal rides on the chip and not on the text.

## What building it exposed

Four things came out of drawing all three, and would not have come out of prose:

1. **`Other` cannot carry a number.** #712's last acceptance criterion is that the vessel's
   ordinals match the feed row's for the same question. The feed numbers only what was offered
   (`FeedAskOffer.numbered`), so a numbered `Other…` at the end of the vessel's list puts the
   two one apart the moment anyone reads them side by side. It is drawn unnumbered in A for
   that reason, and B avoids the problem by not having the row at all.
2. **An ordinal alone does not name an option.** In the `many` case both questions number from
   1, in the feed row and in the vessel. So the answer has to carry the question as well as the
   ordinal — `(question index, ordinal)`, not `ordinal`. The readout prints what would be sent
   so this is visible rather than inferred.
3. **B cannot say a question takes several answers.** Its chips look identical whether the
   question is one-of or many-of; A's checkboxes say it in the shape. That is B's real cost and
   it shows up only against the `multi` case.
4. **A and B draw the question twice** — once in the feed row, once in the vessel, a few
   hundred pixels apart. #534 settled that the row is a reading, and the render makes the
   repetition plain. C is the only one without it: the question is read and picked where it was
   asked, and the composer below stays the composer. What C costs instead is that the
   affordance moves with the scroll, so a long feed can put the question off screen while the
   composer below it waits.

**A click on an option IS the answer**, in all three. A one-of question needs no confirm step,
so it draws no button — a control that can never be the thing you press is a control that lies.
The button comes back only for the two branches one click cannot finish: a many-of question,
and free text. A call carrying two questions sends when the second is picked.

**`esc` is unbound in all three.** An ask has no refusal — there is no answer that means *no*,
which is exactly what separates it from a Permission.

**The row is carried by its ground alone.** No rule around it and no leading accent bar: an
amber stroke on four edges reads as an alert banner dropped into the column rather than as a
row of it.

## What it is faithful to, and what it is not

Every colour, radius, spacing step, stroke and measurement is transcribed from
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/` — `GraphitePalette`, `ArgoGeometry`,
`ArgoFeedRow`, `ArgoComposerVessel`, `ArgoTypography`. The feed's ask row is `FeedAskLine.swift`
and `FeedAskOptions.swift` line for line, including the marker grid, the attention wash while it
waits and the neutral once it settles. The unavailable row is `ComposerUnavailable.swift`.
Nothing is invented.

The first case is **real**: it is the question this session actually put to the user when issue
#721 turned out not to exist.

It is **not** a component structure, a state machine, or anything to port line by line. The
projection this ends in — `AskPromptProjection.Prompt` and a `case ask` on `DeckVessel` — is the
real design; this only shows what it has to produce.

## What happens next

A variant wins (or bits of several do), the decision goes into
`docs/designs/cockpit-session-composer.md` via `prototype-to-design`, and #712 gets built from
that with `design-to-code`. This file and its HTML move to a throwaway branch at that point,
with a pointer left on the issue — they do not belong on `main`.
