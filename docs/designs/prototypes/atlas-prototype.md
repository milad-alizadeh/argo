# Project Atlas — rough atlas for Argo itself, one path top to bottom

**This is a primary source, not a starting point.** It exists so the content model decided across
[#643](https://github.com/milad-alizadeh/argo/issues/643)'s tickets can be *read* rather than
argued about, and so [#650](https://github.com/milad-alizadeh/argo/issues/650) can be answered by
reacting to something. It was written under prototype constraints — no tests, no abstractions, one
file — and it is deliberately not on `main`.

## Run it

```sh
open docs/designs/prototypes/atlas-prototype.html
```

No build, no server, no dependencies.

## The question it answers

*Does this content model teach the system, does it read aloud, and is the drill step the right
size?* Three questions in one artifact, because they are only separable on paper: a card that
teaches badly usually reads badly too.

## Reading the URL

Every state is linkable, which is the point — a state you cannot link to is a state nobody
re-checks.

| Parameter | Effect |
|---|---|
| `?variant=A\|B\|C` | Which treatment. Also `←`/`→`, or the floating bar at the bottom. |
| `&n=<node>` | Open at a node: `argo`, `read`, `read-reader`, `flow-line`, `flow-turn`, `c-session`, `c-person`, … |
| `&len=long` | Open the card at its long prose length. |
| `&render=1` | Hide the switcher, for a committed PNG. |
| `Esc` | Back — retraces actual moves, as distinct from the breadcrumb. |

Three states worth going to directly:

- `?variant=A&n=read-reader` — the bottom of the atlas: two enclosing frames, a stale Claim whose
  refresh **cannot run**, and five exits into the code.
- `?variant=B&n=flow-line` — the Flow as one card with all nine steps visible.
- `?variant=C&n=c-person` — a Concept the code does not spell, rendered as **none found** rather
  than as *there is none*.

## The three treatments

Same content in all three; they disagree about structure, not colour.

- **A — Enclosure.** Descending zooms into a card and the parent stays literally around it: one
  nested frame per altitude, the surface ramp stepping down as you go in. Containment is the whole
  visual idea; card position carries nothing. Areas as a grid, Flows and Concepts in a rail beside
  them.
- **B — Spine.** No canvas and no cards. One reading column, set larger than anything in the app,
  with ancestors collapsed into ribs pinned above it. Children hang off a single hairline with mono
  ordinals, because the teaching order is a real Claim here. This is the variant asking whether the
  atlas is a reading surface first and a canvas second.
- **C — Room.** The atlas as a cockpit room rather than a canvas: containment lives in the sidebar
  as an indented stack, Flows and Concepts as sidebar sections, and the card sits in the deck at the
  feed's own 720pt measure. It is the only variant that shows the atlas beside the rest of Argo, and
  it asks whether the zoom is needed at all.

## The content is real

Nine domains, one path down to a leaf Area, two Flows, seven Concepts — read out of `apps/macOS` on
2026-09-01. Every path and line number resolves. The prose is what a model would have to produce:
Tier C, a Claim like any other, and the thing to judge.

**One path only, by design.** #650 asks for one path top to bottom, so
`Argo → Reading the record → The reader that keeps state` is written in full and the other eight
domains stop at one level and *say so* on the card. Faking the other branches would have made the
drill-step question unanswerable.

Three things the real content exposed that invented content would not have:

1. **Nine domains is a lot of cards, and the honest number.** #647 refuses an invented middle
   layer, so the Project canvas carries nine — which is what a reader actually meets, and it is
   already at the edge of comfortable in variant A's grid.
2. **A leaf Area's prose is longer than a Domain's.** The interesting sentences are at the bottom
   ("an actor with four pieces of memory, and no more"), not the top, which inverts the usual
   assumption that detail thins as you descend.
3. **`Person` has no type in the code.** That made the difference between *none found* and *there
   is none* concrete rather than theoretical, and it is the clearest single card in the artifact.

## What it is faithful to

Every colour, radius, spacing step, elevation and duration is transcribed from
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/` — `GraphitePalette`, `ArgoRadius`,
`ArgoSpacing`, `ArgoElevation`, `ArgoMotion`, `ArgoTypeScale`. Type is San Francisco throughout;
the contract has no serif. Two house rules are honoured deliberately and are worth checking:
**a node kind is told by its word and the rule under it, never by a hue** (Ion Blue stays
selection, focus and links), and **selection is the ground alone** — no leading accent rule.

The only invented values are material stand-ins the contract does not name: the `backdrop-filter`
blur figures, the page ground behind the fake window, the window radius, and the traffic lights.
They are marked `INVENTED` in the file.

## What it deliberately does not do

The settled spec is mostly a list of refusals, and the prototype has to be judged against them:
no boxes-and-lines diagram, no meaningful card position, **no provenance badge or tier chip**, no
graded freshness, no progress or seen-tracking, no tour mode, no global next, no jump list, no
per-Claim expand and no third prose length, no edit surface, and no file viewer — an anchor is an
exit and says so.

Two open questions from the map are visible as absences rather than filled in: there is **no
question box** (#648 left it as fog), and there is **nothing that brings a person back** (#656
ruled out every event-attached entrance).

## Not settled by this artifact

Which variant wins, and whether the drill step is right. That is what #650 is for.
