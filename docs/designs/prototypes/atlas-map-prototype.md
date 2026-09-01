# Project Atlas — the atlas as a chart

**This is a primary source, not a starting point.** It exists so that the content model settled
across [#643](https://github.com/milad-alizadeh/argo/issues/643) can be *used* instead of argued
about, and so that [#650](https://github.com/milad-alizadeh/argo/issues/650) has something to
react to. It was built under prototype rules: no tests, no abstractions, and it is not on `main`.

It replaces an earlier build of the same content that had no chart in it. That build was three
prose-card treatments. The reaction was that an atlas without a chart is not an atlas. Its record
is commit `a4d34014`.

## Run it

```sh
open docs/designs/prototypes/atlas-map-prototype.html
```

No build, no server, and no network. Both layout libraries are vendored under `vendor/`.

## The question it answers

*Is the atlas a chart?* An eagle-eye view of the whole Project, with the ability to drill. If the
answer is yes, then two more questions follow, and this artifact asks them at the same time. Which
chart form teaches the system? And is the drill step the right size?

## Reading the URL

Every state has a link. A state that you cannot link to is a state that nobody checks again.

| Parameter | Effect |
|---|---|
| `?variant=A\|B\|C` | Which chart. Also `←` and `→`, or the floating bar. |
| `&n=<node>` | Open at a node: `argo`, `read`, `read-reader`, `flow-line`, `c-person`, and the rest. |
| `&open=<domain>` | Open a domain in place. A URL that names an Area opens its parent for you. |
| `&overlay=<flow\|concept>` | Light a Flow path, or the homes of a Concept, across the map. |
| `&len=long` | Open the card at its long prose length. |
| `&render=1` | Hide the switcher, for a committed PNG. |
| `Esc` | Turn the overlay off. With no overlay, go back. |

Four states worth going to first:

- `?variant=A&open=read` — the drill step. dagre puts the five Areas inside the domain as a
  cluster, in the same layout pass, so the machine around them keeps its shape.
- `?variant=C&overlay=flow-line` — the strongest argument for a chart. The Flow lights its own
  path across the field and numbers each node in the order that it reaches it.
- `?variant=B&n=read` — the whole atlas in one circle, with the Areas of one domain on the outer
  ring.
- `?variant=A&overlay=c-person` — a Concept that lights nothing, because the search found none.

## The three charts

The content is the same in all three. They disagree about what a chart is for.

- **A — Pipeline**, laid out by **dagre**. A layered graph. Position means dataflow and nothing
  else. Each edge carries the phrase that says what crosses it, and dagre reserves the space for
  that label instead of dropping it on top of a node. An opened domain becomes a cluster, and its
  Areas are placed inside it by the same pass.
- **B — Orrery**, laid out by **d3-hierarchy**. `d3.cluster` places containment, and the result is
  mapped to polar coordinates. The Project sits at the centre and the nine domains sit on a ring.
  Relations cross the middle as chords. The whole atlas fits in one circle with no scrolling.
- **C — Field**, settled by **d3-force**. Every node is here at once: the Project, the nine
  domains, the five Areas, the two Flows and the seven Concepts. A Concept has no place of its
  own, so links to the domains of its evidence pull it between them. Its position is a result, not
  a decision. Scroll to zoom, drag to pan.

## What this means in Swift

The libraries were chosen for the port, not only for the prototype.

| Chart | Library here | In Swift |
|---|---|---|
| C — Field | `d3-force` | **Grape** is a SwiftUI port of `d3-force` with the same force names. Confirm the version before anyone commits to it. |
| B — Orrery | `d3-hierarchy` (`d3.cluster`) | About 60 lines of Swift. `d3.cluster` is one tree walk that spaces the leaves evenly, and SwiftUI needs the same output. |
| A — Pipeline | `dagre` | **No Swift port exists.** The options are a port of the ranking pass, `dot` through `mattt/Graphviz`, or a hand-placed layout that only works while the domain count stays at nine. |

So chart A is the one with a real build cost, and chart C is the one with a library ready for it.
That is a fact for the decision, not the decision itself.

## The graph is derived, not drawn

The chart cannot claim a relation that the content does not carry.

- A node knows its home domain from the directory in its own anchor paths.
- A Flow knows its path from its own steps, mapped the same way. `flow-line` touches four domains,
  and the map shows exactly that.
- A Concept lights the domains that its own evidence points to. `Person` lights nothing.

The hand-written part is the eight relation labels. The content keeps those as prose, and each
label is a phrase from the "what leaves it" Claim of its own node.

## The content is real

Nine domains, one path down to a leaf Area, two Flows, and seven Concepts. They were read out of
`apps/macOS` on 2026-09-01. Every path and line number resolves.

**One path only, by design.** #650 asks for one path from top to bottom. So
`Argo → Reading the record → The reader that keeps state` is written in full, and the other eight
domains stop at one level and say so on the card. To fake the other branches makes the drill-step
question unanswerable.

The prose obeys Simplified Technical English. Sentences hold 25 words or fewer, one paragraph
holds one topic, and the voice is active.

## What it is faithful to

Every colour, radius, spacing step, elevation and duration comes from
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/`. The type is San Francisco, and the
contract has no serif. Two house rules are worth checking on the render:

- A node kind is told by its word and the rule under it, never by a hue. Ion Blue stays selection,
  focus and links.
- Selection is the ground alone. There is no leading accent rule anywhere.

The invented values are material that the contract does not name: the canvas dot grid, the desktop
ground, and the two arrowheads. They are marked `INVENTED` in the file.

## What it deliberately does not do

The settled spec is mostly a list of refusals, and this artifact must be judged against them. It
keeps all of them except one.

**It breaks the refusal of a boxes-and-lines diagram, and the refusal of meaningful card
position** ([#648](https://github.com/milad-alizadeh/argo/issues/648)). That is the study.

It keeps the rest: no provenance badge, no tier chip, no graded freshness, no progress or
seen-tracking, no tour mode, no global next, no jump list, no per-Claim expand, no third prose
length, no edit surface, and no file viewer. An anchor is an exit, and it says so.

Two open questions from the map are visible as absences. There is no question box (#648 left it as
fog), and there is nothing that brings a person back (#656 ruled out every entrance).

## Not settled by this artifact

Whether the atlas is a chart at all, which chart form wins, and whether the drill step is right.
That is what #650 is for.
