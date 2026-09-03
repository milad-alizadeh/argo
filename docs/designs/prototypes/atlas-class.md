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

*Verdict: reads well at any degree, because the columns cap at nine a side and say `+30 more`.
It is the only reading that shows the members.*

### 2 · Wheel — one module

Every type the module declares set round a circle, ordered by kind so the rim itself means
something before a chord is followed, and every relation between two of them drawn as a chord
across the middle. The selection's chords are lit; the rest hold the shape at ten percent.

What you read here is shape: a module whose chords all cross the centre has no interior
structure; one whose chords hug the rim is really several modules.

*Verdict: the scale the plate cannot reach and the ledger cannot draw. Caps at the 96 most
connected types — ArgoUI declares 670, and a rim of 670 names is not a rim.*

*Rejected on the way: an **orrery** — the same neighbourhood as rings by relation kind, distance
meaning intimacy. Radial labels only work when every label is on one radius; on four rings an
inner name overprints the ring outside it, and every fix for that turns the diagram back into
the plate. Kept the geometry, changed the subject from one type to one module.*

### 3 · Ledger — the whole repository

No edges at all. Every type is a row and a column, ordered by module and then by depth in the
need-chain, so a dependency sits below the thing that needs it and **every cycle in the
repository lands above the diagonal, in rose, where it can be counted**. Today: 496 of 4041.
The module blocks are the squares on the diagonal; hovering reads a cell; the rail's selection
is banded so a name picked in the list is findable in the grid.

*Verdict: the only reading that survives 1349 types on one screen, and the only one that answers
a question about the repository rather than about a type.*

## What is still open

- **Ordering.** The depth walk is bounded at six passes rather than exact, because cycles make
  "deep" ill-defined. An ordering that is nearly right shows nearly all the cycles; a solver is
  not what this prototype is for. A real one would change the back-edge count.
- **Generics, `associatedtype`, and protocol witnesses** are invisible. A conformance is an
  edge; what the conformance *requires* is not.
- **`uses` is noisy** — 1788 of 4041 relations. Worth a filter chip per relation kind.
- No symbol-level linkage to the CodeCharta map yet: a file in the atlas and the types it
  declares are two datasets that share a path and nothing else.
