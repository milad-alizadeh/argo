# Project Atlas — three navigation models, one content set

Three prototypes for [#650](https://github.com/milad-alizadeh/argo/issues/650). They are throwaway,
they are not on `main`, and they exist to be reacted to.

They share the same 62 fact-checked nodes and the same token sheet, so any difference between them
is a **navigation model** difference and not a styling one.

```sh
python3 -m http.server 8731 --directory docs/designs/prototypes
open http://127.0.0.1:8731/atlas-route.html
open http://127.0.0.1:8731/atlas-workbench.html
open http://127.0.0.1:8731/atlas-levels.html
```

## Why the previous build was replaced

The radial chart drew four different kinds of thing in one picture and three of them were the wrong
shape for it.

- A 12-step flow rendered as **two lit circles and one curve**. All the teaching sat in the text
  column beside it. A sequence has a time axis and a ring has none.
- A ring has no up and no down, which destroys the most important structural fact about Argo:
  `ArgoEngine ⊥ ArgoUI ⊥ app target`, with `ArgoTerminal` off to the side because it links AppKit.
- 17 of the 21 `ui` nodes are regions of one window. The reader already has a spatial model of that
  window and the ring contradicted it.
- The 8 concepts have **zero authored relations between them**. There was no graph to draw, so
  placing them by mean angle was invented position.

## The three models

They differ on what "where am I" means. Do not blend them.

| | `atlas-route.html` | `atlas-workbench.html` | `atlas-levels.html` |
|---|---|---|---|
| Position is | a step in a story | one node's neighbourhood | an aspect and a rung |
| Serves | someone who knows nothing | someone who knows Argo | both, by splitting the question |
| Map? | none, deliberately | none, deliberately | one per aspect |
| Entry | pick a route | search or the index | pick an aspect |
| Bounded by | one idea per step | **one hop, never two** | ~20 elements per rung |
| Deep link | `?route=&step=` | `?at=&aspect=` | `?aspect=&rung=&sel=` |

**Route** — three walkthroughs whose figures grow one element per step, with at most one prediction
gate each. The whole navigation UI is a picker and back/next.

**Workbench** — one active node, three panes that are all projections of it, movement as history.
Every truncation is labelled on the picture: "6 of 11 drawn", a dashed "5 more" bundle, "21 inside,
not drawn here".

**Levels** — six aspects, six diagram types, three rungs each, and no minimap.

## One diagram per aspect

| Aspect | Question | Diagram | Source |
|---|---|---|---|
| Context | What does it touch? | C4 system context | `argo.leaving` |
| Structure | What is it made of? | layer stack → grouped components | `inside`, `groups`, `among` |
| Runtime | What happens, in order? | UML sequence, `alt` frames, dashed returns | flow `steps` |
| Cockpit | Where is it on screen? | annotated wireframe | `region` |
| Vocabulary | What does this word mean? | none — a glossary | concepts |
| Rules | What may I not do? | table + struck-through arrows | `argo.rules` |

There is no deployment view. Argo is one macOS app, and inventing one would be a convenient lie.

## What the content had to grow

The old node set could not feed these diagrams. Seven changes, all anchored to lines that were
opened:

1. Concept ownership resolved against **leaf** parts. It had been tying against containers, so five
   concepts landed on `engine` and none on `e-drive` — even though `c-drive-port`'s own evidence is
   `Drive/SessionDriver.swift`.
2. A `group` on every depth-2 part, taken from the containers' own prose. 21 loose siblings became
   4–5 groups of at most 6.
3. A `region` tree on 17 `ui` parts: containment, z-order, room.
4. Flow steps became objects carrying `actor` (the lifeline), `kind`
   (`call`/`self`/`return`/`alt`/`loop`), optional `from`/`to`, and `answers`.
5. `person` and `agent-process` added as `external: true` parts. They bracket every flow and were
   nodes nowhere.
6. A `sense` on every edge — `data` or `call` — which is what the 36 contradictory `among` pairs
   were actually disagreeing about. `among` is now derived, not hand-authored.
7. Six boundary rules from `scripts/swift-boundaries.sh`, each with its ADR and what breaks.

## Known gaps

- **C4 wants a technology tag on every external.** `argo.leaving` carries a name and cargo only.
  Route hardcodes nine defensible tags; Levels refuses to invent them and shows edge sense instead.
  The externals want a `tech` field.
- **Every wireframe coordinate is authored.** The content gives containment, z and room, never
  geometry.
- `engine.among` has 59 edges and `ui.among` 80, undrawable at any rung. Structure shows a count and
  puts the list in the panel.
- **The four flows touch 11 of 45 leaf parts.** 76% of the code is on no flow, including the whole
  off-machine half and all 1,068 lines of `e-codex`. Four flows is not a design choice; it is the
  four that got written.
- One `among` pair had no `leaving` edge behind it — `e-ticket / e-account`. Either `e-ticket` is
  missing a claim or the old edge was wrong. Not re-added.

## Not settled by these

Which model is right, and whether the atlas is a map at all. Every product surveyed whose primary
artifact was a map is dead or pivoted; what survived was bounded on-demand neighbourhoods and
human-authored routes with line-level citations. That is an argument for Route or Workbench over
Levels, and it is exactly what #650 is for.
