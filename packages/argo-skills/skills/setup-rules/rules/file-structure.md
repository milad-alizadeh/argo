---
paths:
  - "{{APP_GLOB}}"
  - "packages/**/*.{ts,tsx}"
---

# File Structure Rules

## Folder-split hygiene — extract before you dump

When a file approaches ~150 lines or a folder root accumulates 5+ peer files doing
related things, extract into a subfolder. Do this proactively while authoring a
feature, not as a follow-up cleanup task.

### The split pattern

`thing.ts` → `thing/` folder:

```
thing/
  index.ts       # orchestrator only: wires sub-units together, barrel re-exports
  partA.ts       # one focused unit
  partB.ts       # one focused unit
```

`index.ts` is the **orchestrator** — wiring and re-exports only. No business logic
lives in `index.ts`; that belongs in named leaf files. Callers import from
`'./thing'` and TypeScript resolves to `thing/index.ts` — zero import churn.

### When to extract

- A file exceeds ~150 lines (machines and pure data files are exempt)
- A folder root has 5+ peer files that fall into natural sub-domains
- Two or more files share a prefix (`orderCreate.ts`, `orderCancel.ts`) — that
  prefix is the subfolder name

### Group by domain, not by file type

Folders are named by **what the code is for** (feature/domain), never by what the
files syntactically are. `checkout/`, `user-profile/`, `settings/` beat `utils/`.

**Kind-folders are banned:** never create `schemas/`, `types/`, `utils/`,
`helpers/`, `constants/`, `interfaces/`, `validators/`, `handlers/` as grouping
folders. They become junk drawers: touching one feature means hopping across five
kind-buckets, and deleting a feature leaves orphans in each. A feature's schema,
types, and validation live INSIDE that feature's folder (`checkout/schema.ts`, not
`schemas/checkout.ts`).

The one sanctioned exception is a single small `lib/` (or `shared/`) folder per
module root for genuinely cross-cutting helpers used by 3+ sibling domains. If a
"shared" file has one consumer domain, it belongs in that domain's folder.

**Folder = domain, file = concept.** A file is named after the one concept it owns
(`formatPrice.ts` = amount→display-string mapping). A `types.ts` accreting every type in the
module is the junk-drawer smell at file granularity; a small colocated `types.ts`
scoped to its own folder's domain is fine.

### Keep subfolders shallow

One level of nesting covers almost every case. Never go deeper than two levels below
the module root without a documented reason.

### Public entry per module (barrels)

Every module exposes ONE public entry that is its API — the `index.ts` barrel;
callers never import an internal leaf. The exception: when only one symbol from a
leaf is needed and the barrel would re-export a very large surface, a direct leaf
import is acceptable.

## Module boundaries — ports and adapters

Modules communicate through explicit contracts, never by reaching into each other's
internals (information hiding / dependency inversion).

- **A module's barrel IS its API.** Cross-module imports may only target another
  module's `index.ts`. Anything not re-exported from the barrel is private.
- **Depend on ports, not implementations.** When module A needs behavior module B
  provides, A consumes an interface/registry (the port) and B registers into it
  (the adapter). A never imports B directly if B is a lower-trust or more specific layer.
- **Layering is one-directional.** Generic/core layers must not import from specific
  layers (adapters, domain packs, app features). Specific layers may import the
  generic layer's public API; two specific layers never import each other's internals.
  In this project: `{{MAIN_DIR}}` never imports from `{{RENDERER_DIR}}`, and within a
  layer, feature folders never import each other's leaves.
- **Side-effect imports for registration happen in exactly ONE composition root**
  (the entry point that wires the app together), never scattered across consumers.
- **No god nodes.** A module with extreme fan-in or fan-out is a Single-Responsibility
  violation at graph scale — split it by responsibility.

### Enforce mechanically where you can

If the repo has a boundary linter (e.g. `dependency-cruiser`), encode the layer
rules there so a new leak fails the build instead of relying on review. Justified
violations (vendored code, a migration in flight) go in a small explicit ignorelist
next to the lint config — each entry scoped to one rule + one path glob, with a
one-line reason. Never loosen the rule globally, never scatter inline disable comments.

### Apply this rule uniformly

This applies to every module in the codebase. When you add files to any folder,
check whether the folder now needs splitting.
