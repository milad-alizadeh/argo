## Atlas (cross-cutting)

The Atlas draws the active Project as a place (#1140). The domain had no word for a file as a
unit of analysis, none for a folder, none for a measure and none for the record itself — the only
**File** it defines is a live editable path in a Workspace, which cannot carry a measure. These
are those words. Everything here is DERIVED: the repository is the only source (#655), nothing is
authored, and the Session record is not an input.

- **Map** — one repository, measured. Argo-owned, per-machine app data under `userData`, **never
  committed and never watched**: generated whole on first Atlas open, read on every open after,
  and regenerated only when the reader asks. It holds `version`, `measuredAt`, the `commit` it
  measured (absent for a repository with no history), one root Plate and its Couplings. Scoped to the Project
  the window is on (ADR-0015); a monorepo is one Project and gets one Map.

- **Plot** — one file of the repository as the Atlas reads it: a path from the Map's root down,
  and its Measures. The path is the join key — search, picking and opening in an editor all key
  off it — so **no two Plots in a Map may share one path**.

- **Plate** — one folder: a path, and the nodes standing on it. It carries **no number of its
  own**. Every number a Plate reads by is its Plots summed over the whole subtree, computed on
  demand, so a Plate and what stands on it can never disagree.

- **Measure** — one named number about a Plot. **The set is OPEN**: which Measures exist is a
  property of the repository and the languages in it, never of Argo, so nothing may assume a
  fixed five. A Measure a Plot does not carry is **absent**, which is not the same reading as
  zero — a PNG has no lines to count rather than zero of them — though a sum over a subtree
  counts an absent Measure as nothing.

- **Coupling** — two Plots that keep changing in the same commit, and how tightly: **Jaccard**,
  the commits that touched both over the commits that touched either. Counted from git's history
  alone, which is the one coupling signal every repository has and the only one that sees a
  dependency no import declares. A pair is one Coupling and reads the same from either end. Two
  thresholds decide what is stated and both are the repository's own: commits larger than its
  **90th percentile** are not counted, because one sweeping commit would otherwise couple
  everything it touched to everything else it touched; and each Plot keeps its **twenty**
  strongest, so what is written follows the file count rather than how busy the history is.
  A repository of one commit states none — its files arrived together, which is not the same
  fact as changing together.

Not yet named, because nothing has built it: the inferred grouping that re-tiles the Map by
subject rather than by folder. It is in #1140 and takes its name in the ticket that builds it.

**Drawn forms are not domain entities.** Volume, band, legend, city and treemap are appearance,
settled by #650 and `docs/designs/cockpit-atlas.html`. A Plot is the file; the volume is one way
of drawing it.
