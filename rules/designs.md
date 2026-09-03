---
paths:
  - "docs/designs/**"
  - "apps/macOS/Packages/ArgoUI/Sources/ArgoUI/**/*.swift"
---

# Design Studies

What a design pass settles (a brief, an approved render, a decision log) is a **committed
artifact in `docs/designs/`**, never a scratchpad file. The directory holds the agreed-latest
set only: a superseding artifact deletes the one it replaces, and `docs/designs/README.md`
carries one row per file.

## Foundations before screens

The ramps are designed once and live in `ArgoDesign`; `ContractSpecimen` renders them and is
the one non-disposable design artifact. A screen proposes and never redefines: a value the
contract lacks is a **proposal**, promoted through the contract or snapped, never left as a
raw constant in a view (`design-system.md`).

## A state is settled by rendering it

`ArgoUI/Specimen/SpecimenRegistry+*.swift` holds one `SpecimenEntry` per renderable state.
Adding an entry is all it takes to add a state. Render before claiming a visual change is done,
because the app against an ordinary checkout shows no Sessions and nothing else looks at the
surface. A render is not a click: what comes apart inside a popover only `ArgoE2ETests`
catches. Commands and the judging method: `docs/agents/visual-verification.md`.

## The brief is a spec, never a source

Build a screen by deriving it from the contract and the existing views, never by eyedropping
a colour out of the PNG. A measurement the decision log does not carry is cited at its
definition by the file it was taken from.

## Drift

A brief is authoritative for what is not built and stale for what is. A decision made while
implementing lands in the code with its reason at the value. Update a settled brief only when
a built region's drift would mislead an unbuilt neighbour (a changed shell, split or row
height that unbuilt regions are laid out against).
