# 0030 · Geometry is settled before it is shown

Status: accepted · 2026-09-03

Binding on `apps/macOS`. Extends [ADR-0029](./0029-a-feed-opens-at-its-tail.md) and supersedes
[ADR-0028](./0028-cost-is-a-gate.md) Rule 5 (one table re-keyed by `FeedReading`). Decided in a
grilling session on 2026-09-03 against `main` at `9f6cd7d4`.

## Decision

**No row and no Minimap mark is drawn until every row of the reading has a final height at the
current width.** Heights are computed off the main thread, never estimated, and never corrected on
scroll. Each opened Session keeps its own deck off-screen; switching back shows it unchanged.

## Why

Five feed defects in a year — #473, #476, #477, the seam shake (#858) and today's overprint on
`9f6cd7d4` — were one bug: rows measured lazily as `heightOfRow` asked for them, so the document's
total height kept moving under the scroller and under the Minimap. Every fix moved the estimate
somewhere else. Xcode's editor is not the counter-example it looks like: TextKit 2 lays out the
viewport and *estimates* the rest, which is why its scroll indicator jumps in large files. VS Code
resizes instantly because its heights are arithmetic (monospace, fixed line height). Argo's prose is
proportional-font markdown and needs real typesetting — but Core Text already does that for prose,
off-main and in parallel, in tens of milliseconds for thousands of rows. The only thing forcing the
main thread and the estimate was the SwiftUI ruler (`NSHostingController.sizeThatFits`) used for
every non-prose shape. ADR-0029 measured the same: the constant per row was the defect, not the
row count.

A wait of a few seconds on the first open of a 63 MB Session is accepted. A document whose
geometry is still moving is not.

## Rules

1. **Heights are arithmetic or Core Text, never a SwiftUI layout pass.** A prose row is typeset by
   `FeedRowMeasure` (Core Text). Every other `FeedRowShape` — `call`, `survey`, `gallery`,
   `skillLoaded`, `ask`, `mark`, `unreadable` — has a stated height formula, tested per shape as
   "formula equals drawn". The ruler is deleted, with no fallback: a fallback is where estimation
   crawls back in.
2. **A prose row is drawn by the `CTFrame` that measured it**, so height equals drawn by
   construction rather than by test. Fenced code and mermaid stay inside the prose row: monospace
   runs for code; `MermaidLayout` measures a diagram headless and `MermaidView` draws it at the
   frame the measure gave. Non-prose shapes may stay SwiftUI over their arithmetic height.
3. **One whole-document measure pass, off-main, parallel across rows, before the first draw.**
   The click paints the selected ground within the existing budget; the deck then stands in the
   one provisional state (`Argo has not read this Session yet`, held back `unreadDelay`, now with
   an activity indicator — see the status vocabulary amendment) until the pass completes; the feed
   and the Minimap then appear together, both correct. Gate: **≤ 3 s** for the 4 800-record shape,
   in `PerfBudgets`, with a cost test.
4. **Kept Sessions.** Every Session opened this launch has its own deck — table, heights, scroll
   position, folds — **kept** off-screen when the reader leaves it and shown again by a hide/show,
   never a reload. The opposite is **evicted**. Cap: 6 kept decks, LRU, a hidden `UserDefaults`
   default (`argo.keptSessions`) rather than a preference screen; readings remain bounded by
   `ReadingCeilings`. Eviction drops the deck and lets the reading go; **heights stay for every
   Session opened this launch**, so an evicted Session re-opens over known geometry with no measure.
   Rooms are kept too: Sessions → Tickets → Sessions costs nothing. A Subagent scope is its own
   kept deck sharing the parent's row heights. Pinned-to-tail (ADR-0029) is a preserved *state*;
   a fixed row is a preserved *position*.
5. **Live Sessions grow at the tail.** Appended rows are measured off-main and inserted
   atomically, heights final before insertion, no indicator. A Result arriving late changes one
   row's height: measured first, replaced in place, scroll anchor held on the row above the
   viewport's top edge. These are the only two ways a settled document changes.
6. **Resize freezes, then remeasures once.** During a window drag the table stays at its old
   width, clipped and unreflowed; at drag end one off-main pass remeasures everything, and the
   indicator appears only past the `unreadDelay` ceiling.
7. **The Minimap is a structural map over settled heights** (D25 as amended): one mark per row by
   kind at its true position, viewport drawn over it. Its geometry code stays; the estimate it was
   fed goes.
8. **Selection is a layer, never a cell property.** Page-wide text selection across rows is a
   follow-on, and this ADR constrains it: every prose cell exposes its `CTFrame` for hit-testing,
   so a selection is a span of `(row, character range)` drawn over the table. Links are live now.

## Consequences

- ADR-0028 Rule 5's "one table opens the same reading afresh" is gone; there is one table per kept
  deck and none is ever re-pointed. The overprint on `9f6cd7d4` — two readings drawn through one
  reloaded table — is subsumed rather than fixed on code the redesign deletes.
- `FeedGeometries` moves from "survives the room switch" to "survives eviction": the height store
  is per (Session, width) for the launch.
- The Minimap's D25 weight cap applies to a mark's *drawn* size, not to the vertical span a row is
  allotted: position must coincide with the settled document or the map and the scroll ratio
  disagree again.
- Fixtures in three tiers: small checked-in transcripts for unit tests; a checked-in
  **shape-preserving synthetic** of the 63 MB session (same record count, kinds, prose lengths,
  Subagent tree; text replaced by lorem of equal length) drives the CI cost gate; the real 63 MB
  transcript is **gitignored** and drives the local figure recording when present. The repo is
  public, and a real transcript in git is permanent.
- Feed, Deck and Minimap remain UI surfaces outside `CONTEXT.md`
  (`docs/domain/not-domain-entities.md`); this vocabulary lives here and in the design docs.

## Delivery

Serial lanes, each green on `main` on its own. Each later lane depends on the one before it.

1. **Arithmetic heights, ruler deleted** — formula + "formula equals drawn" test per non-prose
   shape; `FeedTableCoordinator+Measuring` loses its ruler branch.
2. **Prose draws its own `CTFrame`** — an AppKit prose cell over the measuring frame; links
   hit-tested on the frame; `ProseText` gains the drawing surface.
3. **Whole-document off-main measure + provisional state + gate** — parallel pass, indicator per
   the vocabulary amendment, ≤ 3 s cost test on the synthetic fixture, gitignored real transcript
   for the figure.
4. **Kept decks** — one deck per Session, cap and hidden default, rooms kept, Subagent scopes,
   tail-pin and position preserved, heights kept past eviction.
5. **Minimap over settled heights** — true positions, D25 weight cap on drawn size only.
6. **Resize freeze** — clip during drag, one remeasure at drag end.
