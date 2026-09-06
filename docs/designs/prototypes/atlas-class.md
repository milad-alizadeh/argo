# Atlas · the class diagram — three readings

**Question.** The CodeCharta map says how big a thing is and how much it churns. It says nothing
about what a thing *is* or what it needs. This prototype asks: **what notation lets a reader see
how the types in a repository relate to each other**, and at what scale does each notation stop
working?

Run: `node docs/designs/prototypes/atlas-serve.mjs` then open
`http://localhost:8731/atlas-class.html`. Switch readings with the bar at the bottom, keys
`1 2 3`, or `?v=plate|wheel|ledger&t=TypeName`.

## The data

`atlas-types.mjs` reads declarations straight out of the working tree and writes
`atlas-types.json`. It is **not** a compiler front end and does not pretend to be one: comments
and string literals are blanked (same length, so every offset still points where it did), then a
per-language pack finds declarations, members and supertypes, and brace depth carves nested
types out of their host's body by range.

- **Project-agnostic by construction.** The packs are `SWIFT` and `TS`; a repo with neither
  produces an empty graph rather than a wrong one. Subtree and language are arguments.
- **A name only an `extension` introduced is not a type this project declares.** `View` and
  `CGRect` were the two largest hubs on the first run — that is a picture of SwiftUI, not of the
  repo. They now appear as an `adopts` line on the box that conforms, never as a node.
- Relations: `conforms` / `inherits` (supertype list), `holds` (a stored property whose type is
  a declared type, with arity from `[T]` / `T?`), `uses` (a parameter or return type),
  `nested`.

On this repo, today: **2072 types, 4041 relations, over 1861 Swift files, in 0.5 s.**
Kinds: 1492 struct, 394 enum, 127 class, 39 actor, 20 protocol. 695 of the types are test types,
filtered out by default and reachable from the `tests` chip.

## The three readings

They are three **scales**, not three skins. That is the point of the set — a reader with the
plate open and a bigger question has to change scale to ask it.

### 1 · Plate — one type

A drafting sheet. The subject in the middle as a full UML box with compartments; everything that
needs it down the left, everything it needs down the right; drafted orthogonal runs between
them, each landing on its own port along the box edge. UML's own arrowheads are kept — hollow
triangle on the general, filled diamond on the whole, dashed with an open head for a dependency
— because a reader who knows the notation should not have to learn a private one. Multiplicity
is on the member (`[*]`, `[0..1]`) and the property name is on the wire.

The corner ticks and the **title block** are the signature: subject, module, member and relation
counts, and the commit the sheet was plotted from. A drawing should say which revision it is.

Layout is **elkjs** (`layered`, `ORTHOGONAL`), not hand-rolled. The hand-rolled `wire()` ran
every left-hand elbow down one shared mid-channel, so nine incoming runs collapsed into a single
line and only the topmost could be traced; ELK gives each run its own channel. It also fixed a
notation bug that had been invisible: a tail marker draws *backwards* from its start point and
the runs were painted under the boxes, so **the filled aggregation diamond was occluded on every
edge in the old version**. The runs paint on top now and the diamonds show.

The centre box carries one ELK port per relation, `FIXED_ORDER`, WEST for incoming and EAST for
outgoing, which is what keeps the heaviest partner at the top of its column. `FIXED_SIDE` was
tried and produced byte-identical geometry — a bipartite star has no crossings for the port
sorter to improve — so the weaker constraint bought nothing.

*Verdict: reads well at any degree, because the columns cap at nine a side and say `+30 more`.
It is the only reading that shows the members. The sheet is about 20% wider than the hand-rolled
one, because ELK reserves real channel and label width; it reads spacious rather than padded.*

### 2 · Wheel — one module

Every type the module declares set round a circle, ordered by kind so the rim itself means
something before a chord is followed, and every relation between two of them drawn as a chord
across the middle. The selection's chords are lit; the rest hold the shape at ten percent.

What you read here is shape: a module whose chords all cross the centre has no interior
structure; one whose chords hug the rim is really several modules.

Geometry is **d3-chord**, specifically `chordDirected` + `ribbonArrow`: our relations point one
way, and the hand-rolled quadratic Béziers could not say which way. Ribbon width now carries
relation weight and arc width carries a type's total traffic, so a hub is visible before a single
line is followed.

One honest compromise. Roughly half of any module's types have no relation *inside* that module,
and a traffic-proportional rim gives them a zero-width slot with their name stacked on the
neighbour's. The layout pays a floor of `1.3 · W/N` on the **diagonal** — self-chords are dropped
before drawing, so it is invisible space — which guarantees every name a slot while real traffic
still decides most of the circle. The cost is real: hub-to-leaf ratios are compressed about 2:1
against the truth.

*Verdict: the scale the plate cannot reach and the ledger cannot draw. Caps at the 96 most
connected types — ArgoUI declares 670, and a rim of 670 names is not a rim. Filled ribbons read
as haze where thin strokes read as a web, so "does this module's traffic hug the rim or cross the
centre" is a slightly muddier judgement than before; direction is worth the trade.*

*Rejected on the way: an **orrery** — the same neighbourhood as rings by relation kind, distance
meaning intimacy. Radial labels only work when every label is on one radius; on four rings an
inner name overprints the ring outside it, and every fix for that turns the diagram back into
the plate. Kept the geometry, changed the subject from one type to one module.*

### 3 · Ledger — the whole repository

No edges at all. Every type is a row and a column, ordered so that a dependency sits below the
thing that needs it and **every cycle in the repository lands above the diagonal, in rose, where
it can be counted**. The module blocks are the squares on the diagonal; hovering reads a cell;
the rail's selection is banded so a name picked in the list is findable in the grid.

The ordering is exact, not approximated: iterative Tarjan for the strongly connected components
(recursion blows the stack at 1349 nodes), condensation, longest-path layering over the resulting
DAG, then Eades–Lin–Smyth greedy feedback-arc-set *inside* each component — the only place a back
edge can survive. Barycenter and reverse Cuthill–McKee then seriate the freedom the levels leave,
which is what makes sub-structure visible inside a block. Key **o** cycles three orderings.

**That correction changed the finding.** The first version relaxed depth over six passes and
reported 496 back edges of 4041:

| ordering | back edges | truly inside an SCC |
|---|---|---|
| depth walk (first version) | 496 | 198 |
| module blocks · topological · RCM (default) | 310 | 172 |
| topological, no module blocks | 169 | 169 |

About **300 of the original 496 were artefacts of the sort** — modules were ordered by type count,
so relations read backwards purely because of where their module sat, and the reader was counting
the sort rather than the repository. 82 components, largest 57 types. The residual 138 under the
default are the price of keeping module blocks: when two modules need each other, one direction
must read as back even where no type-level cycle exists. Dropping the blocks makes every rose
cell a true cycle but shatters ArgoUI into dozens of tiny runs, and the diagonal stops being
recognisable — so blocks stay the default and the readout prints both numbers. About 7 ms at
1349 types, against ~2900 canvas rects in the same frame.

*Verdict: the only reading that survives 1349 types on one screen, and the only one that answers
a question about the repository rather than about a type.*

## What is still open

- **Generics, `associatedtype`, and protocol witnesses** are invisible. A conformance is an
  edge; what the conformance *requires* is not.
- **`uses` is noisy** — 1788 of 4041 relations. Worth a filter chip per relation kind.
- **The extractor is still hand-written.** Surveying the field found no static tool that gives
  real type relationships without a build: everything usable assumes a compile database, a
  type-checker or an importable module, and the two projects that did it from source alone
  (GitHub's stack-graphs, GitHub Semantic) are both archived. tree-sitter under the packs is the
  one swap left worth making — it would replace the brace-depth carving with a real parse tree.
- No symbol-level linkage to the CodeCharta map yet: a file in the atlas and the types it
  declares are two datasets that share a path and nothing else.
