## Atlas (cross-cutting)

The Atlas draws the active Project as a place (#1140). The domain had no word for a file as a
unit of analysis, none for a folder, none for a measure and none for the record itself — the only
**File** it defines is a live editable path in a Workspace, which cannot carry a measure. These
are those words. Everything here is DERIVED: the repository is the only source (#655), nothing is
authored, and the Session record is not an input.

- **Map** — one repository, measured. Argo-owned, per-machine app data under `userData`, **never
  committed and never watched**: generated whole on first Atlas open, read on every open after,
  and regenerated only when the reader asks. It holds `version`, `measuredAt`, the `commit` it
  measured (absent for a repository with no history), one root Plate and its Couplings. Scoped to
  the Project the window is on (ADR-0015); a monorepo is one Project and gets one Map.

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

- **Domain** — a group of Plots that are about one subject, **inferred** (#1157). The second
  partition of a Map: the folder tree files code by layer, and nothing files it by subject, so
  this one is guessed from the only two signals every repository has — what files are **called**
  (TF-IDF over filename tokens, with **directory names counting for nothing**, or the clustering
  rediscovers the folder tree) and what **changes together** (the Couplings). A Domain is named
  after the word most **concentrated** in its files, never the heaviest: a word on a fifth of the
  repository, and the repository's own name, are barred from every label. **A Plot may belong to
  no Domain**: it keeps one only where it is more that Domain than the runner-up by a margin, and
  the margin is its **confidence**. What belongs to nothing is derived from what belongs to
  something, never written twice.

- **Inference** — the Domains of one Map, and what the guess is worth. A Domain is never reached
  except through it, because the recovery literature is blunt that inference here is unreliable —
  the same technique scores 36 on one codebase and 94 on another. It carries the **resolution**
  the partition was taken at, whether the repository **settled** on that grain (a stretch of the
  knob over which files stop moving between Domains — **no plateau is a real answer** and is
  stated as one), and the **agreement** between the blended reading and a reading of the filenames
  alone. With no answer key, how often two independent signals agree is the only accuracy number
  there is; it is reported, never acted on.

**A Domain is INFERRED, which is a third kind of fact.** Every Measure is measured and every
Coupling is counted; a Domain is guessed. It is labelled that way wherever it appears, and the
appearance of that label is settled by #650.

**Drawn forms are not domain entities.** Volume, band, legend, city and treemap are appearance,
settled by #650 and `docs/designs/cockpit-atlas.html`. A Plot is the file; the volume is one way
of drawing it.
