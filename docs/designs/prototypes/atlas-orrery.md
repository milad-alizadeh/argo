# Project Atlas — one chart, one part at a time

**This is a primary source, not a starting point.** It exists so that the content model settled
across [#643](https://github.com/milad-alizadeh/argo/issues/643) can be used instead of argued
about, and so that [#650](https://github.com/milad-alizadeh/argo/issues/650) has something to
react to. It was built under prototype rules: no tests, no abstractions, and it is not on `main`.

It replaces two earlier builds of the same idea. The first was three prose-card treatments, and
the reaction was that an atlas with no chart is not an atlas. The second was three chart forms,
and the reaction was that the circle was right but the drill was wrong. Their records are commits
`a4d34014` and `e2e22fb4`.

## Run it

```sh
open docs/designs/prototypes/atlas-orrery.html
```

No build, no server, and no network.

## What changed, and why

**The drill is a zoom, not an expansion.** A click makes the part you chose the new centre. Its
own parts become the ring. The old ring goes away. One view holds one part, so the picture never
gets denser than the picture you are looking at now.

**No node says what kind of thing it is.** A circle is a part of the program. A chevron is a path
through it. A diamond is a word the code spells. A legend at the foot of the canvas says that
once, and no node repeats it.

**The prose teaches the code.** Each part says what it does before it says what it is, and names
the parts it talks to. The words are Simplified Technical English: 25 words per sentence, one
topic per paragraph, active voice.

## Reading the URL

Every state has a link. A state you cannot link to is a state nobody checks again.

| Parameter | Effect |
|---|---|
| `?at=<id>` | Open inside a part: `argo`, `engine`, `ui`. |
| `&sel=<id>` | Read one node, and light it on the chart. |
| `&len=long` | Open the reading at its long length. |
| `&render=1` | Hide the legend and the hint, for a committed picture. |
| `Esc` | Clear the reading. With nothing selected, go up one level. |

Four states worth going to first:

- `?at=engine` — 21 parts on one ring, sized by their line count. The three ghosts at the foot are
  the sibling targets this one reaches.
- `?sel=f-write` — the path from a keystroke to the bytes on the pseudo-terminal, numbered in the
  order it reaches each part.
- `?at=engine&sel=f-permission` — the path that answers a blocked tool call over a socket.
- `?at=ui&sel=u-composer` — the write surface, which the previous atlas did not have at all.

## The content is generated, and it is checked

Two skills now exist, under `packages/argo-skills/skills/`.

- **`atlas-write`** finds the real parts from the build manifests and the imports, anchors every
  claim to a `path:line` it has opened, writes each node as the same four things, and emits JSON.
- **`atlas-review`** reads an emitted node in a context that never saw it written, splits it into
  claims, resolves every anchor, settles each relation at a call site, and marks each claim
  `true`, `false` or `cannot tell`. It fixes nothing, because a checker that edits the node stops
  being an independent reading of it.

The content here was written by `atlas-write` running against `apps/macOS`, one writer per build
target, and then checked by `atlas-review`.

Run `node docs/designs/prototypes/build-content.mjs` after editing anything under `nodes/` — it
merges the writers' files, derives which part spells which concept from the evidence paths, and
reports any id that no node defines.

## The graph is derived, not drawn

The chart cannot claim a relation the content does not carry.

- A circle's size is the line count of the code it covers.
- A diamond sits at the mean angle of the parts that spell it.
- A chevron sits at the mean angle of the parts it passes through.
- A ghost outside the ring is a part this one reaches, and it is a click away.

The written part is the edge cargo — the words on each edge saying what crosses it. Every one of
those is quoted from the node's own claim about what leaves it.

## About the layout library

The previous build used dagre and d3 and recorded what each would cost in Swift. This build
computes the ring itself, because one ring of siblings is even spacing and `d3.cluster` returns
the same positions for it. The Swift cost of this layout is a `cos` and a `sin` per node.

That is a saving, not a decision. If the chart later needs bundled edges or a second ring with
its own ordering, `d3-hierarchy` is the port to reach for, at roughly 60 lines of Swift.

## What it is faithful to

Every colour, radius, spacing step, elevation and duration comes from
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/VisualContract/`. The type is San Francisco, and the
contract has no serif. Two house rules are worth checking on the render:

- A kind is told by shape and by the legend, never by a hue. Ion Blue stays selection, focus and
  the lit path.
- Selection is the ground alone. There is no leading accent rule anywhere.

The invented values are material the contract does not name: the canvas ground, and the two node
shapes that are not circles.

## What it deliberately does not do

The settled spec is mostly a list of refusals, and this artifact must be judged against them. It
keeps all of them except one.

**It breaks the refusal of a boxes-and-lines diagram, and the refusal of meaningful position**
([#648](https://github.com/milad-alizadeh/argo/issues/648)). That is the study.

It keeps the rest: no provenance badge, no tier chip, no graded freshness, no progress or
seen-tracking, no tour mode, no global next, no jump list, no per-claim expand, no third prose
length, no edit surface, and no file viewer. An anchor is an exit, and it says so.

One refusal is worth naming because a new skill sits near it. #645 refused a model grading the
atlas. `atlas-review` does not grade it — it settles each claim against a line of code, and it
reports rather than edits. If that reading is wrong, the skill is the thing to argue with.

## Not settled by this artifact

Whether the atlas is a chart at all, whether the zoom is the right drill, and whether three
depths is the right ceiling for a repository this size. That is what #650 is for.
