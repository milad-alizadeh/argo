# Module boundaries

The nine edges `scripts/swift-boundaries.sh` enforces and the reasoning behind each. Every edge
is checkable from imports and declarations alone, which is why they are gates rather than review
notes, and each failure message states its own rule. Pulled out of AGENTS.md so a session that
never touches a package boundary does not pay for it.

`apps/macOS`'s layers — `ArgoEngine` ⊥ `ArgoDesign` → `ArgoAtoms` / `ProseText` →
`MermaidLayout` → `MermaidView` → `ArgoUI` ⊥ the app target — are enforced by
`scripts/swift-boundaries.sh` (in `quality:swift`, on the `macos` CI job and in pre-commit).
Every edge is checkable from imports and declarations alone, which is why they are gates rather
than review notes. Four of the nine are ADR-0022's layering; the sharpest of those is **exactly
one file in `ArgoUI` may read live Hub state** — the Hub → cockpit projection. Everything else
takes a value.

Edge 2 of those four has **two** subjects, one implementation: `ArgoEngine` is ADR-0022's own,
and `MermaidLayout` — the renderer's headless half, which scans, ranks and measures without
drawing — is there for the same argument (#1087). `ArgoMermaid`'s other target, `MermaidView`,
draws and is not a subject. Five types are `public` out of the pair — `MermaidDiagram`,
`MermaidView`, `MermaidPlan`, `MermaidMeasure`, `MermaidFigure` — and everything the two targets
share between themselves is `package`, which `ArgoUI` cannot see. That split is a convention and
not an edge: nothing counts the public names, so widening one is a review note rather than a
build failure.

The fifth is ADR-0027, on that projection: the cockpit **restates** `HubSession` rather than
holding one, so every public engine fact must land in the mapping or be named on a
`not-projected:` line beside it, **on the slot of its own name** unless a `renamed:` line says
why not. Adding a public fact to `HubSession` fails the build until you say which it is; swapping
two same-typed facts between slots fails it too.

The sixth extends the parameter cap to initializers, which SwiftLint's own rule cannot see —
**written inits and the memberwise init Swift synthesizes for a struct alike**, since width
moved into a value type is width hidden rather than removed. It reads
`function_parameter_count`'s own `error:` out of `.swiftlint.yml` — one cap, one place, and no
second number to drift above it. The ratchet is the **named list** of grandfathered inits beside
that rule: an init over the cap fails unless a `# INIT: <file> <count> — <why>` line names it,
and a line naming an init that is no longer over the cap fails too, so the list can only shrink.
The script prints the cap in force on every run. The cap is on the **declaration**, not the call
site, and the one shape edge 6 skips is a struct whose memberwise init a `private` stored
property makes private — both stated at the rule.

The seventh is the token contract's own module (#1088). `ArgoDesign` holds the contract and
`ArgoAtoms` the primitives over it, so **a colour, rhythm step, radius, stroke width or type size
may be DECLARED only in `ArgoDesign`** — a view may name any of them and write none of them down.
Checkable only because the contract is a module: while it was a folder inside `ArgoUI`, a literal
in a view and a literal in the palette were the same grep. The patterns live in
`scripts/check-design-tokens-swift.sh`, which the edge calls rather than copies, and its allowlist
is debt on the same ratchet as the init list — a reason per line, and an entry that matches
nothing fails.

The exemption is only worth having while the exempt module stays what it says it is, so the same
edge holds `ArgoDesign` to being a **leaf** that declares **no view**: without both, "the folder a
view could be moved into" is just "the module a view could be moved into", and the escape hatch
survives the extraction one level up.

The eighth is the direction between `ArgoUI` and the two dev-tool targets beside it (#1085):
`ArgoSpecimens` holds the specimen harness, `ArgoFixtures` the sample transcripts and Tickets, and
**no file under `Sources/ArgoUI` may import either** — in any spelling — nor may `ArgoFixtures`
import anything that draws. The app target links `ArgoSpecimens`, which is the one accepted leak:
the harness is reached by launch argument on the real binary, and that is what makes a specimen
render evidence rather than a preview. A `#Preview` that needs sample data belongs in
`ArgoSpecimens` with it.

The ninth is ADR-0030 Rule 1, on where a row's height comes from: **no file under
`Sources/ArgoUI` may name `NSHostingController` or `sizeThatFits(in:)`**. A height is arithmetic
(`FeedShapeHeight`) or Core Text (`FeedRowMeasure`), and the hosting ruler those replaced survives
only as the test oracle in `FeedShapeHeightTests`. Two spellings and no third: `NSHostingView` is
how a cell DRAWS, and the `Layout` protocol's own `sizeThatFits(proposal:subviews:cache:)` is not
AppKit's. What stays is the FACE probes in `ProseText`, held by the same edge to three named files:
they measure a face once per face per process — the box its engine stands a line in, what an empty
run collapses to, how far a line hangs below its baseline — and every formula rests on those. None
is a row and none is per row.

The JS/TS boundary gates are dormant — no subject since ADR-0023 retired the Electron
cockpit. Their scripts stay in `scripts/` for consumers; history and shape: ADR-0021, ADR-0023.

