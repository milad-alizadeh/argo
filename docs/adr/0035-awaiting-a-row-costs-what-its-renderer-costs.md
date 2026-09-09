# 0035 · Awaiting a row costs what its renderer costs

Status: accepted (#1793) · 2026-09-09 · amends
[ADR-0033](./0033-dom-geometry-is-settled-before-it-is-shown.md) rule 3

Binding on `apps/desktop`, which does not exist yet. ADR-0033 settled rule 3's async answer by
fiat — the pass awaits every asynchronous row to its natural size — with mermaid's render cost
stated in that file as unmeasured. The measurement asked for by
[Decide how an async-rendered Feed row gets a final height](https://github.com/milad-alizadeh/argo/issues/1793)
now exists, and this file is what it changes. Three of rule 3's four async cases are settled here.
The fourth, mermaid, is **not settled here**: the numbers close the door ADR-0033 walked through,
and which door replaces it is the product call the ticket reserves.

Nothing here relaxes ADR-0033's decision. No row and no Minimap mark is drawn until every row of
the reading has a final height at the current width.

## Context

Prototype branch `argo/#1793-async-feed-row-height`, head `d435b792`, write-up at
`docs/research/2026-09-09-async-feed-row-height.md` on that branch. It is throwaway and will never
get a pull request; it exists so these numbers can be re-run and disputed. Run 2026-09-09T15:48:56Z,
Chrome 152 on macOS at DPR 2, 7 interleaved repeats per diagram, **one 600 px column**, corpus mined
from real Claude Code transcripts on one machine. **The ratios and the shapes are the finding; the
absolute milliseconds are one machine on one evening.**

Twelve mermaid diagrams were mined. Five render as found; ten render after unescaping (see
[The failure path is a main path](#the-failure-path-is-a-main-path)); two do not render by any
route. The timings below are over the ten.

- Summing each diagram's **least** time gives **2 990 ms**; summing each one's **median** gives
  **3 878 ms**. Neither is a measured total — no run drew the set end to end — but they bracket it.
- The worst single diagram, a 145-line class diagram, costs **744 ms at its best and 879 ms
  typically**: **between a quarter and a third** of the 3 s gate
  [ADR-0030](./0030-geometry-is-settled-before-it-is-shown.md) once set for a whole reading, spent
  on one row. ADR-0033 states no number in its place, so nothing is breached — but nothing bounds
  it either.
- **Measuring the produced SVG costs 3 to 13 ms**, per the write-up's own per-diagram table. (The
  issue comment quotes 4 to 15 ms over a wider set of rows; the two artefacts disagree by a
  millisecond or two and neither reading changes anything.) Producing the thing to measure is the
  entire cost.
- Cost is **linear in node count at roughly 5 to 9 ms per node**, and the `chain` and `fan`
  synthetics agree, so it is not dagre's crossing-reduction pass and there is no size below which
  mermaid becomes cheap.
- **Diagram cost and row height are unrelated.** A 320-node chain costs 2 924 ms and draws
  33 252 px tall; a 320-node fan costs 2 741 ms and draws 21 px. Nothing about a row's appearance
  predicts what it costs to produce.

The write-up's verdict on those numbers is not neutral. The ticket made rule 3's await conditional
— *"if the whole set renders in tens of milliseconds, the pass simply awaits them and rule 3 stands
untouched"* — and the answer was seconds. The write-up therefore scores "host mermaid.js and await
it in the pass" as the door the numbers **close**, and names two others: a design-stated fixed frame
with the render after first paint, or a TypeScript port of `ArgoMermaid`. ADR-0033 mandates the
first of the three.

## Decision

**Three of rule 3's four async cases are cost that the pass need not pay, and this ADR removes
them.** Highlighting moves no height, an image with a reserved box is final at insert, and the
measurement container itself measures nothing. A mermaid fence that will not render is drawn as its
own source in a code block, so its height is arithmetic like any other row's.

**Mermaid's await is reopened, not kept.** ADR-0033 rule 3 mandates it; the measurement prices it at
2 990 to 3 878 ms for ten diagrams and closes the branch the ticket offered for leaving it alone.
This ADR does not choose the replacement, because the choice is what a reader sees: see
[What this does not settle](#what-this-does-not-settle). Until it is chosen, ADR-0033 rule 3 stands
as written and is known to cost the above.

## Rules

1. **A height is never predicted from diagram source.** A cheap source-only predictor — layer the
   graph, multiply by mermaid's configured node height and rank separation — erred **−59 % to
   +211 %** against drawn height on the corpus. The errors are structural, not noise: mermaid's node
   heights depend on label text wrapping at `wrappingWidth`, which is a real text measure. Against
   the standing rule that 3 pt of drift is a bug rather than noise, 211 % is the wrong row.
   Arithmetic over a graph is exact only for a layout engine you own, and `ArgoMermaid` is Argo's,
   in Swift, not in this app.

2. **A code block is not an async height case.** Highlighting was measured at a **0.0 px height
   delta in all five language samples** — TypeScript, Swift, JSON, bash, TSX — at the same font and
   width, because it recolours a fixed number of lines. ADR-0033 rule 3's *"a code block is
   highlighted first"* is amended: the pass reads a code block's height from its arithmetic and
   **highlighting may complete after the first paint**, provided the highlighter changes neither
   the line count nor the font metrics. Its 24 to 483 ms is a paint cost, and most of the 483 ms is
   the highlighter's first-call initialisation, not the block: a 107 604 px JSON block later in the
   same run cost 349 ms and a 954 px bash block cost 24 ms.

3. **An image reserves its box, and then there is nothing to await.** With no reserved box the
   element measured 21 px at insert and settled at 125.5 px. With `width` and `height` set, the
   height at insert already equalled the settled height. The pass therefore does not await image
   bytes. **This rule rests on a dependency nothing has yet verified**: that a Feed image's
   dimensions are knowable at insert. Where they are not — a remote image in a transcript that
   carries none — the row shape must state a box, and stating it is a design call, not a licence
   for the pass to wait.

4. **The served prose face is metric-matched to its fallback, or the pass is undone by a font.** A
   late face moved a 600 px paragraph from 64 px to 77.5 px, a fifth of its height, after the pass
   had declared the document settled. One incidental probe in the same rig — Georgia arriving over
   the same fallback — moved it 0 px, which is why Georgia was rejected as the test face; it is a
   single uncontrolled sample, not a measurement of a matched pair, but it is the only direct
   evidence either way. ADR-0033 rule 3 awaits `document.fonts.ready`, which covers a face arriving
   *during* the pass; this rule covers the one that arrives after it. The write-up leaves the face
   choice open — *"a stylesheet decision nobody has made yet"* — and **this ADR closes it as a
   constraint rather than a preference**: whoever picks the Feed's faces picks a metric-matched
   pair, because rule 3's contract has no other way to survive a late one.

5. **A diagram that will not render is drawn as its own source, in a code block.** `mermaid.render`
   throws, returns no SVG, and leaves a stray `div` in `document.body`. So the row has no natural
   height at all, and this is the one place a height is invented. It is invented as arithmetic:
   **line count times line height**, settled by the measure pass like any other code block. This
   supersedes ADR-0033 rule 3's *"falls to its stated `unreadable` formula"* for a mermaid fence
   specifically — the shape is the code block, not `unreadable` — and keeps that rule's substance,
   which is that a failure has a height like anything else.

   - The parse error shows **truncated to its first line plus the caret line**, the part that points
     at the offending token. The rest — the `Expecting` list, three wrapped lines at 600 px — is
     behind the fold.
   - Expanding overlays the full error `position: absolute` inside the code block, whose wrapper is
     `position: relative` and carries **no paint containment**.
   - The overlay is capped at `max-height: 100%` and scrolls internally, so it never bleeds onto the
     next row.
   - **Nothing in the expanded state contributes to row height**: no re-settle, no shift below, no
     Minimap update.
   - The caller **catches per diagram**, never once around the pass — the prototype's first version
     lost a whole document to one bad fence — and **removes the stray `div`** mermaid leaves behind
     when it throws.

6. **The measure container measures zero, so nothing reads it.** ADR-0033 rule 3's
   `content-visibility: hidden` container is size containment (css-contain-2 §4.2), so the
   container's own box has no size: `getBoundingClientRect().height` read **0 px for all 24 rendered
   rows** in the prototype. Only the inner element measures. A pass that reads the container gets a
   clean, confident, useless answer, and no test that reads the container can fail.

## The failure path is a main path

Seven of the twelve mined diagrams do not render **as stored**. Five carry `&gt;` where they mean
`>` — the transcripts hold them HTML-escaped — and unescaping repairs exactly those five; two more
fail for unrelated syntax and are unreadable by any route. So a Feed that unescapes takes rule 5's
path for **two of twelve**, and one that does not takes it for seven.

The issue comment pairs the corpus into six twins: the same line count, the same drawn height where
both render, and a byte delta divisible by three, which is what `>` becoming `&gt;` costs. The sixth
pair is the one where neither copy renders, so it has no drawn height to match and no repair; the
pairing is evidence about the escaping, not about the failure rate.

**What does the escaping is undetermined.** It needs the raw JSONL, not the mined corpus: the check
is whether the escaped copies sit in assistant messages, user turns or tool results. Until that is
known, rule 5 is not an edge case being sketched for completeness, and the difference between a
two-in-twelve failure rate and a seven-in-twelve one is a bug nobody has found yet.

## What this does not settle

- **Which door replaces rule 3's mermaid await.** The write-up names three and this ADR picks none.
  *Host mermaid.js and await it in the pass* is what ADR-0033 mandates today, at the cost above.
  *Give the row a design-stated frame and render after first paint* removes the row height's
  dependency on the render but not the render itself. *Port `ArgoMermaid`* — 122 Swift files, 9 328
  lines, eleven diagram kinds, a synchronous headless height with no renderer and no DOM — to
  TypeScript, and **the port is unpriced**: nobody has looked at how much of those lines is layout
  and how much is Swift ceremony.
- **Whether a rendering diagram gets a fixed frame.** ADR-0033 rule 3 already states the mechanism —
  a row gets a fixed frame it draws inside only where a design in `docs/designs/` states that
  frame's height for that row shape, and the pass never invents one to shrink itself. What is open
  is whether a design should state a frame for the mermaid row shape. That is what a reader sees, so
  it is not the implementor's, and the ticket reserves it explicitly.
- **One route was not measured**: driving mermaid's own bundled `dagre-d3-es` over the parsed graph
  without ever producing SVG. It would inherit the constants and the text measure rule 1's predictor
  has to guess at, so rule 1's error range is not its error range. The scaling numbers suggest the
  layout *is* the cost, so it is unlikely to be cheap. It is the first thing to measure if neither
  outer answer is acceptable.
- **Whether width moves a diagram's cost.** Every timing above was taken at one 600 px column. Rule
  1 cites mermaid's dependence on label wrapping at `wrappingWidth`, which is width-sensitive, so
  the height store's key is not proved by this run to be sufficient for a diagram row.
- **No Electron number and no whole-pass number.** These are Chrome 152 on macOS at DPR 2, and they
  measure diagrams, not a Feed. ADR-0033's first-draw budget stays unset until `apps/desktop` exists
  and the first reading sets it.

## Consequences

- ADR-0033 rule 3's await is now priced, and its own escape — *"whether it is one long task or many
  short ones is free"* — is what makes the price survivable while the door question is open:
  `scheduler.yield()` lets the two-to-four-second bracket for ten diagrams be paid behind the live
  indicator rather than as a window-wide freeze, and the indicator's compositor animation survives
  it under the three conditions ADR-0033 states. That bracket is ten diagrams alone, not a pass
  duration; no whole-pass figure exists.
- Rules 2 and 3 are where this ADR makes the pass cheaper: highlighting leaves the critical path,
  and a reserved image box removes that wait entirely.
- Rule 5 gives the Minimap a mark for a failed diagram at a true position, because the row it fails
  into is a code block with an ordinary arithmetic height. No mark is ever placed over an invented
  span.
- The prototype branch is pushed and gated by nothing: it was pushed with no pull request open, so
  the Swift gate never fired on it. It is prototype code that is not meant to merge, and it was
  pushed only because #1748's prototype was lost with its worktree and #1752 had to rebuild from a
  written contract instead of from a tree.
