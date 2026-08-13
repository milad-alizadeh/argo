# Answering an ask — throwaway prototype (#712)

**This is a primary source, not a starting point.** It exists so the design pass
[#712](https://github.com/milad-alizadeh/argo/issues/712) is blocked on can be *looked at*
rather than argued about. It was written under prototype constraints — no tests, no
abstractions, one file — and the decision it settles will live in the spec, not here.

## Run it

```sh
open docs/designs/prototypes/ask-vessel-prototype.html
```

No build, no server, no dependencies.

## The answer

**The ask is answered in the feed, where it was asked.** The options are the thing you press,
a click on one IS the answer, and the composer below is untouched — it stays what it is, the
place you talk to the Session, not the place you answer it.

This is the shape Claude Code's own desktop client uses, and it is the one the ticket's own
framing pointed at: #534 already draws the question as the numbered list the prompt offered,
and this makes that reading pressable rather than building a second drawing of it somewhere
else.

The file is still named `ask-vessel-*` after the ticket's word for it. There is no vessel:
that is the finding.

## Reading the URL

| Parameter | Effect |
|---|---|
| `?case=pick\|multi\|many\|free\|unavailable` | Which question is live. Also `←`/`→`, or the bar at the bottom. |

`reset` on the bar puts the question back, so a case can be answered more than once without a
reload.

## The five things #712 asked a design pass to settle

- **A click on an option is the answer.** No confirm step and no button — a control that can
  never be the thing you press is a control that lies.
- **Free-form asks** take a field inside the row, with the question above it. Never in the
  composer: the composer talks to the Session, it does not answer it.
- **Many-of questions** toggle their rows and keep an `Answer` button, because there a second
  click is a second answer rather than a correction. **Several questions in one call** are one
  ground with one mark each, answered top to bottom.
- **`Other`** is the last row, unnumbered, and opens the same field the free-form branch uses.
- **Keyboard**: the digits the rows already draw pick; `⏎` sends where there is something to
  send. **`esc` is unbound** — an ask has no refusal, which is exactly what separates it from
  a Permission.
- **The feed row changes**, and that is the whole design. #534 settled that the row is a
  reading; this makes the reading the affordance while it waits, and puts it back to a reading
  the moment it is answered.

## What building it exposed

1. **`Other` cannot carry a number.** #712's last acceptance criterion is that the ordinals
   match what the feed draws. The feed numbers only what was offered
   (`FeedAskOffer.numbered`), so a numbered `Other…` puts the two one apart. It is drawn
   unnumbered.
2. **An ordinal alone does not name an option.** In the `many` case both questions number from
   1. The answer has to carry the question as well as the ordinal — `(question, ordinals)`, not
   `ordinals`. The readout prints what would be sent, so this is visible rather than inferred.
3. **One call is one ground.** Two questions drawn as two cards put a seam through a single
   stop; they are one thing the agent is waiting on.
4. **The row is carried by its ground alone.** No rule around it and no leading accent bar —
   an amber stroke on four edges reads as an alert banner dropped into the column rather than
   as a row of it.

## What it is faithful to, and what it is not

Every colour, radius, spacing step, stroke and measurement is transcribed from
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/` — `GraphitePalette`, `ArgoGeometry`,
`ArgoFeedRow`, `ArgoComposerVessel`, `ArgoTypography`. The settled row is `FeedAskLine.swift`
and `FeedAskOptions.swift`, including the marker grid and the quieting of the options that were
not taken. The unavailable row is `ComposerUnavailable.swift`. `ArgoSymbol.asked` is
`questionmark.bubble`, drawn here since the browser has no access to SF Symbols.

The first case is **real**: it is the question this session actually put to the user when issue
#721 turned out not to exist.

It is **not** a component structure or anything to port line by line. What #712 ends in — a
projection off the presentation, and a live handle with a request id coming over the companion
plugin — is the real design; this only shows what it has to produce.

## What happens next

This shape goes into `docs/designs/cockpit-session-composer.md` (or a study of its own) via
`prototype-to-design`, and #712 gets built from that with `design-to-code`. This file and its
HTML move to a throwaway branch at that point, with a pointer left on the issue — they do not
belong on `main`.
