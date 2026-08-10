---
paths:
  - "docs/designs/**"
  - "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/**/*.swift"
---

# Design Studies

Design work — the exploration you do while settling a screen's layout, palette, or interaction
model, and the artifact that records what you settled — is a **committed repo artifact**, not
scratch files.

This repo has one UI target: the native SwiftUI app in `apps/macOS`. There is no browser, so
there is no HTML study; the equivalent of "render one state and look at it" is a **specimen**.
The HTML-study spelling of this rule retired with the Electron cockpit
(`docs/designs/README.md` → *What left, and where it went*), and the shipped
`packages/argo-skills/skills/setup-rules/rules/designs.md` still carries it for consumer
projects that do have a browser.

## Rule — the settled design lives in `docs/designs/`, committed

- When a design pass settles something — a brief, an approved reference render, a decision log
  — write the keeper to `docs/designs/`, not to a temp/scratchpad directory. Scratchpad output
  gets swept, and then nobody else can see the design you settled on.
- `docs/designs/` holds only the **agreed-latest** set. When an artifact supersedes an earlier
  one, delete the stale file in the same change — don't accumulate v1…v7. A reader opening the
  directory should see the current direction, not the archaeology.
- Keep the `docs/designs/README.md` index current: one row per file (screen · what it is).
- `docs/` is excluded from the code knowledge graph (`.graphifyignore`), so nothing committed
  here pollutes the graph.

## Foundations before screens

The ramps themselves — colour roles, the type scale, spacing, radii, elevation, motion — are
designed once via the `setup-design-foundations` skill and live in
`ArgoUI/Sources/ArgoUI/VisualContract/`. `Specimen/ContractSpecimen.swift` renders them and
is the one **non-disposable** design artifact: it draws the real tokens rather than a copy, so
it cannot drift from the contract it documents, and a `Mirror` assertion fails the build if a
role is missing from it. (`Specimen/FoundationSpecimen.swift` is the companion view — the same
roles dressed onto a real shell, for judging the contract in situ rather than enumerated.)

Screen work follows the foundations; it proposes, it never redefines. A screen that needs a
value the contract lacks marks it a **proposal**, and promoting one is a contract change that
comes back through `setup-design-foundations`' bless step — never a raw constant left in a view.
`scripts/check-design-tokens-swift.sh` is the gate; `VisualContract/` and `Specimen/` are
exempt from it because they are, respectively, the contract and the thing that shows it.

## A state is settled by rendering it

`ArgoUI/Specimen/SpecimenCatalog.swift` holds one `Specimen` case per renderable state.
**Adding a case is all it takes to add a state** — `scripts/specimens.sh` reads the names out
of the catalog rather than repeating them:

```sh
cd apps/macOS
sh scripts/specimens.sh <dir> [name …]              # render the set, or named cases
ARGO_SPECIMEN=<case> sh scripts/screenshot.sh out.png
ARGO_WINDOW_SIZE=<w>x<h> ARGO_SPECIMEN=<case> sh scripts/screenshot.sh out.png
```

A width is part of the state for anything laid out in columns, so a narrow case is rendered at
a chosen size rather than by dragging a window — that way it is a render somebody else can
repeat.

**Render before claiming a visual change is done.** The app launched against an ordinary
checkout shows no Sessions, so without a specimen the surface being built is never actually
looked at. And a render is not a click: a view that renders correctly in a specimen can still
come apart inside a popover, which only `ArgoE2ETests` catches
(`sh scripts/e2e-test.sh`, local gate).

## The brief is a spec, never a source

An approved reference render (`cockpit-sessions-liquid-glass.png`) and its decision log are
**specs**. Building a screen means deriving it from the token contract and the existing views —
never eyedropping a colour out of the PNG or transcribing a measurement the contract should
own. The one exception is a measurement the decision log genuinely does not carry, which is why
`ArgoLayout.swift` cites the PNG by name for the Instrument Deck's zone heights: a value taken
from pixels says so, at its definition, so the next reader knows what would have to be re-shot
to change it.

## Drift

A big screen ships region by region over many tickets, so a brief is authoritative for what is
not built yet and stale for what is:

- **not built** — the brief is truth. A design change means editing the brief.
- **built** — the code and its specimen case are truth. A decision made while implementing
  lands in the code with its reason at the value, and the brief's corresponding passage is
  allowed to go stale.

Pay to update a settled brief in exactly one case: when a built region's drift would mislead an
unbuilt neighbour — a changed shell, split ratio, or row height that unbuilt regions are laid
out against. Cosmetic divergence inside a built region costs nothing.

## Why not scratchpad

The harness default sends temp files to a session scratchpad that is later cleaned up. Design
decisions are durable team artifacts — they belong in version control where every agent and
teammate on the repo can open them, diff them, and build the real UI from them.
