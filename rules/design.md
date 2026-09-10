---
paths:
  - "apps/desktop/**"
---

# Design rules for `apps/desktop`

- Every visual constant is a token reached by name in `apps/desktop/src/renderer/tokens.css`; no raw constants are written at call sites.
- Missing values are added to the token contract first, before any component promotion.
- Tokens are named by role, not by value, with one small role set per family.
- Every string the user reads uses the shared typography roles.
- Each unit is placed in a tier (`atom`, `molecule`, `organism`) before it is written, and existing primitives are reused instead of adding duplicate inline implementations.
- A screen is a thin container that resolves state into a pure render surface.
- An approved spec in `docs/designs/` is the source of truth for implementation, not a design reference for future edits.
