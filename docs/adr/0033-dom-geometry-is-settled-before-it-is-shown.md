# 0033 · DOM geometry is settled before it is shown

Status: accepted (#1795) · 2026-09-09

Binding on `apps/desktop`, which does not exist yet: this is the contract it is built to. It
restates [ADR-0030](./0030-geometry-is-settled-before-it-is-shown.md) for a DOM Feed and
**supersedes it for `apps/desktop`**, and with it
[ADR-0029](./0029-a-feed-opens-at-its-tail.md), which ADR-0030 extended and whose whole-document
Minimap contract is carried forward by rule 7 below. Both stay on disk **scoped to `apps/macOS`**:
they are the record of the Swift app, they stay authoritative for the Swift code and doc comments
that cite them, and the reasoning in them is why this contract exists at all. ADR-0030's
supersession of [ADR-0028](./0028-cost-is-a-gate.md) Rule 5 — "one table opens the same reading
afresh" — is restated here rather than left resting on a superseded file: there is one deck per
Session and none is ever re-pointed. Nothing else here is a new decision — the contract was
settled in the resolution of
[Decide the Feed's list primitive, and whether ADR-0030 survives the DOM](https://github.com/milad-alizadeh/argo/issues/1752),
and this file is where the repo keeps it. The one addition is rule 3's async answer, asked by
[Decide how an async-rendered Feed row gets a final height](https://github.com/milad-alizadeh/argo/issues/1793)
and **recorded here**: the ticket is where the question is stated, and this ADR is the only place
the answer exists.

## Context

ADR-0030's first line binds it to `apps/macOS`, which is deprecated and verified by nothing. So
the repo's only written geometry contract described an app nobody runs, while the contract that
governs the app being built lived as a comment on a closed issue. That is the whole gap this file
closes.

Two facts moved between the two apps and change how the rules read.

**The primitive owns scroll, not geometry.** `MessageScroller` from `@shadcn/react`, pinned at
exactly 0.3.1 behind one Argo-owned module (#1766), was read from its own tarball:
`MessageScroller.Viewport` and `.Item` are plain `div`s forwarding every prop, `ref` and
`onScroll`; it does no virtualisation, and it contains no `content-visibility` and no
`contain-intrinsic-size`. The estimate-then-correct behaviour first attributed to it is the doc
page's suggested CSS, not the package. **The package owns scroll behaviour and the tail/anchor
mechanics. Argo owns every height.**

**The document is 459 rows, not 4,800.** The 63 MB Session named as the subject of every
settled-document gate holds 4,800 JSONL records, and those render as 459 Feed rows. Records are
transcript lines; rows are what the Feed draws. Every sizing judgement below is made against 459.

Three platform facts constrain the rules and are the reason two obvious shortcuts are refused.

- **A worker cannot measure text.** `OffscreenCanvas.measureText` forms a hypothetical
  infinitely-wide line box containing a single inline box, does no line breaking, and condenses
  the font rather than wrapping under `maxWidth`. `Intl.Segmenter` cannot substitute: `line`
  granularity was cut in 2019, and it implements UAX#29 where Blink's breaker is UAX#14 and is
  tailored four ways at once. Breaking and shaping are mutually dependent, so a JS
  reimplementation cannot be exact either. Houdini's CSS Layout API never shipped, Canvas
  Formatted Text is "no longer pursuing", and `utilityProcess` has no DOM.
- **A hidden second window cannot be trusted.** It does paint, and a forced reflow does return
  correct geometry. It is refused on device pixel ratio: `LayoutUnit` stores layout in 1/64ths of
  a pixel in an `int32_t` and truncates on construction, so a measuring renderer at DPR 1 can
  return heights that differ from a visible renderer at DPR 2, and which display a never-shown
  window adopts is undocumented. Against a standing rule that 3pt of drift is a bug rather than
  noise, that is an unbounded correctness risk bought to avoid one freeze per Session per launch.
- **`content-visibility: auto` cannot be measured through.** While a row skips its contents, size
  containment is active, so `offsetHeight` returns the `contain-intrinsic-size`-derived value and
  not the real height. Blink also discards a scroll anchor that lands on such a row, and the
  unskip costs a double layout and a second paint. `content-visibility: hidden`, by contrast, is
  the spec's own sanctioned measurement technique (css-contain-2 §4.2).

## Decision

**No row and no Minimap mark is drawn until every row of the reading has a final height at the
current width.** *The reading* is the whole set of rows a Session projects at the moment it is
opened — all 459 of them for the largest Session on record, not a window over them. There is no
bounded reading in this contract: a pass that measured a prefix would be an estimate of the rest,
which is the thing this ADR exists to refuse. Nothing is estimated, and no height is corrected on
scroll: rule 5's appended-row and late-Result cases are the only two ways a height changes after
the first paint, and both settle before the row is drawn again.

The reason is unchanged from ADR-0030 and is not a DOM reason: five Feed defects in a year were
one bug, the document's total height moving under the scroller and under the Minimap, and every
fix moved the estimate somewhere else. Chromium has the same failure mode with weaker tools —
scroll anchoring is normatively best-effort, exclusion-only, and suppressed by any computed height
change on the path from the anchor node to the scroller.

## Rules

1. **Heights are arithmetic or a real Blink layout, never a guess.** Every non-prose row shape
   keeps a stated height formula and its "formula equals drawn" test, one per shape. Prose is laid
   out by Blink at the real column width. There is no ruler and no fallback ruler: a fallback is
   where estimation crawls back in.

2. **A prose row is drawn by the layout that measured it.** In a DOM this is automatic rather than
   contractual: the same element, at the same width, with the same fonts, measured and then shown.
   Fenced code and mermaid stay inside the prose row.

3. **One whole-document measure pass before the first draw, in a `content-visibility: hidden`
   container in the visible renderer.** Not a worker, which cannot line-break; not a hidden second
   window, which cannot be trusted on DPR. The pass **awaits every asynchronous row to its natural
   size** before it ends: a mermaid diagram is rendered and its produced SVG measured, a remote
   image is awaited to its intrinsic size, a code block is highlighted first, and
   `document.fonts.ready` is awaited before any height is read. A row is given a fixed frame it
   draws inside only where a design in `docs/designs/` states the frame's height for that row
   shape; the pass never invents a frame to shrink itself, and an implementor who wants one asks
   for the design, not for a default. A row that fails to render at all falls to its stated
   `unreadable` formula, which is arithmetic, so a failure has a height like anything else. The
   pass runs **once per Session per width**, not once per switch. **Whether it is one long task or
   many short ones is free**: the contract is that nothing is drawn until every height is final,
   not that the cockpit freezes. `scheduler.yield()` ships in Chromium 152, the tree Electron 44
   pins, so a chunked pass that keeps the window responsive satisfies this rule exactly as a
   blocking one does.

4. **Kept decks stay at 6, LRU, and heights stay for every Session opened this launch.** The cap
   is a stored setting, not a constant in a component: it is the DOM successor to the Swift app's
   hidden `argo.keptSessions` default, it is read from wherever `apps/desktop` keeps unexposed
   settings, and it stays out of a preference screen. The cap was written against 4,800 nodes; at
   459 rows a kept deck is small. A kept deck hides with `content-visibility: hidden` and **never
   `display: none`**, which destroys the boxes and forces a full relayout on return. Three cases
   follow: a first open runs one pass behind the indicator; switching back to a kept deck runs
   nothing; re-opening a Session evicted from the 6 remounts over cached heights with no pass. A
   kept deck preserves both kinds of place, and they are different: pinned-to-tail is a preserved
   *state*, a fixed row is a preserved *position*.

5. **Live growth and late Results are Argo's scroll arithmetic, not the platform's.** An appended
   row is measured before insertion. A late Result is measured, replaced in place, and the row
   above the viewport's top edge is held by Argo computing the offset delta and writing
   `scrollTop`. `overflow-anchor` is not relied on for this, and rows where it would interfere are
   excluded with `overflow-anchor: none`. These are the only two ways a settled document changes.

6. **Resize freezes, then remeasures once.** The Feed stays at its old width, clipped, for the
   length of the drag; one pass runs at drag end. **Width, font and zoom factor are the only three
   things that invalidate a cached height.**

7. **The Minimap is a structural map over settled heights, and it does not read the DOM.** One
   mark per row by kind at its true position, from Argo's own prefix sum over the heights it
   measured. The viewport rectangle comes from the viewport `div`'s `scrollTop` and `scrollHeight`
   through the forwarded `ref` and `onScroll`. A mark's weight cap applies to its *drawn* size,
   never to the vertical span the row is allotted, or the map and the scroll ratio disagree again.
   #1748 requires production acceptance to prove this rule; nothing else asserts it.

8. **Selection stays a layer, never a row property.** Page-wide selection across rows is deferred,
   and is cheaper in a DOM than it was in Swift.

## No containment on Feed rows

`content-visibility: auto` and `contain-intrinsic-size` are **not used on Feed rows**. At 459 rows
there is nothing to save, and the cost is real: you cannot measure through a skipped row, Blink
discards a scroll anchor that lands on one, and the unskip costs a double layout.
`content-visibility: hidden` is used for exactly two other jobs — the measurement container of
rule 3, and a kept deck under rule 4.

For the record, if containment is ever revisited: an exact `contain-intrinsic-size` is per spec
enough to remove the sibling displacement and the scrollbar shift, and `auto <length>` self-heals
via the last remembered size where a plain length does not. Two traps come with it. The value is
an **inner** size, so feeding back `getBoundingClientRect().height` is wrong by padding plus
border; and it is not exact for a non-block container such as a grid.

## The activity indicator

The deck stands in the one provisional state — `Argo has not read this Session yet` — with an
activity indicator until the pass of rule 3 completes. A compositor animation does keep ticking
through a blocked main thread — that is the documented purpose of the split, and **nothing in
Chromium drops or resets a running compositor animation because the main thread was blocked**:
every cancel path is main-thread code, there is no timer or deadline in `cc/animation`, and tile
eviction is not animation-aware. So the indicator animates through the pass, under three
conditions verified against Chromium 152:

- **Warm it before the block.** The animation reaches the compositor only through a full commit
  and then tile activation, so start the indicator and let it run two or three frames before the
  pass begins. A layer whose tiles are not yet rastered aborts on checkerboarding, and the
  recovery path asks for a main frame that a blocked main thread cannot serve.
- **A `div`, not inline SVG, animating `transform` and `opacity` only.** Blink excludes hidden
  containers, inlines, text and filter primitives from compositing, and rejects `rotate`, `scale`
  and `translate` on an SVG target outright. `border-radius` and `box-shadow` cost nothing here:
  they are painted into the tiles once. `will-change` is not needed, because an active animation
  is itself a direct compositing reason — and `will-change: contents` anywhere in the ancestor
  chain removes every compositing reason.
- **Never touch the animation near the block.** Changing its playback rate, start time or effect
  cancels the compositor animation and starts a new one, which needs the main thread. Nothing may
  read the indicator's computed style either.

## The first-draw budget is not set here

ADR-0030 rule 3 gated the pass at **≤ 3 s**. That number is not carried over, and this ADR states
no number in its place.

It was measured for Core Text. For Blink there is **no macOS layout figure at all**:
`blink_perf.layout` carries its series only on the Linux and Windows bots. The Windows bot lays
out 2,117 dirtied prose blocks — *Pride and Prejudice* as `<p>` elements, 938 KB, font-size bumped
each run so no line box is cached — in about **132 ms**, and applying that to 459 rows of mixed
shapes is inference, not citation. Rule 3 does not settle it either way: it leaves a chunked pass
free, and a wait behind a live indicator is judged differently from a window-wide freeze of the
same length.

[#1794](https://github.com/milad-alizadeh/argo/issues/1794) was closed as premature for exactly
this reason and returned to *Not yet specified*: no `apps/desktop` exists to freeze. **The number
graduates when there is one, measured on the reference Mac that
[#1736](https://github.com/milad-alizadeh/argo/issues/1736) defines, and the first reading is what
sets it.** Where the budget lives and what asserts it — an eighth workflow beside the seven #1736
fixed, or somewhere else — is a repo-convention call for whoever wires it, and #1794 declined to
make it.

## Consequences

- **ADR-0030 and ADR-0029 stay on disk, scoped to `apps/macOS`.** They are the record of the Swift
  app and stay authoritative for the Swift code and doc comments that cite them — `AGENTS.md` and
  `apps/macOS/README.md` among them — so nothing that cites ADR-0030 for the Swift app needs
  re-pointing. What this ADR supersedes is their claim on the app now being built. Their Swift
  spellings — `FeedRowMeasure`, `CTFrame`, `NSHostingController.sizeThatFits`, `FeedShapeHeight`,
  `heightOfRow` — name nothing in `apps/desktop` and must not be cited as though they do.
- The Argo-owned module of #1766 has a job beyond re-exporting `MessageScroller`: **it supplies
  every row height.** A swap to a virtualizer, or a fork of the 56 KB zero-dependency package,
  stays inside that module and the Feed does not notice.
- Rule 3's await makes the pass's length a function of the slowest asynchronous row in the
  reading, and mermaid's render cost is unmeasured. #1793 asked for that measurement; it is now
  the pass's cost, not a separate question about one row shape.
- **The height store is keyed on all three invalidators, not on width alone**: `(Session, width,
  font, zoom)` for the launch. Rule 6 names the set, and a two-part key cannot notice the other
  two, so a cached height that outlives a font or zoom change would be a defect the key itself
  guaranteed. Rule 3's "once per Session per width" describes the common case, where only the
  width moves.
- Feed, deck and Minimap are UI surfaces, not domain entities, so `CONTEXT.md` defines none of
  them and `docs/domain/not-domain-entities.md` does not list them either. This ADR and the design
  docs are where that vocabulary lives, and Session, Result and Agent keep the meanings
  `CONTEXT.md` gives them.
