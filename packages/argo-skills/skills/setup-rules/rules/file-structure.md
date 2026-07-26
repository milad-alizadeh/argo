---
paths:
  - "{{SOURCE_GLOBS}}"
---

# File Structure Rules

Where code lives, and which parts of a module the rest of the codebase may see. These
rules are about structure rather than syntax, so they bind **every language in this
repo**. One thing differs per language — what a module's public entry *is* — and this
repo's is `{{PUBLIC_ENTRY}}`.

## Folder-split hygiene — extract before you dump

When a file approaches ~150 lines or a folder root accumulates 5+ peer files doing
related things, extract into a subfolder. Do this proactively while authoring a
feature, not as a follow-up cleanup task.

### The split pattern

One file becomes a folder of focused units behind one entry:

```
thing/
  {{PUBLIC_ENTRY}}   # orchestrator only: wires sub-units together, re-exports the API
  partA              # one focused unit
  partB              # one focused unit
```

The entry file is the **orchestrator** — wiring and re-exports only. No business logic
lives there; that belongs in named leaf files. Callers keep importing `thing`, and the
language resolves the entry for them — zero import churn.

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

The one sanctioned exception is the shared tier described next.

### Shared code is earned, not chosen — hoist on the third caller

A helper is born **next to its only caller**, inside that domain's folder. There is no
"where does this go?" decision to make on the way in. It moves up only when callers
force it:

| Callers | Where it lives |
|---|---|
| 1 | the caller's own folder |
| 2 | either — copy it, or hoist; if the right shape isn't obvious yet, copy |
| 3+ | hoist, no longer optional |

Hoisting has two destinations, and the test is mechanical:

- **`lib/` (domain-aware)** — it names a domain term (`formatInvoiceTotal`). Reachable
  by any domain; may import from the generic tier.
- **`lib/generic/` (product-agnostic)** — it would compile unchanged if you published
  it to npm: no domain nouns, no app imports, no config. Imports nothing from the app.

**Imports flow upward only.** A domain may import both tiers; `lib/` may import
`lib/generic/`; `lib/generic/` imports neither. Two consequences worth naming, because
both are signals rather than judgment calls: a sibling-domain import (`checkout/`
reaching into `orders/`) means the shared thing wants hoisting, and a domain type
appearing inside `lib/generic/` means that file wants demoting.

Waiting for the third caller is the point. Abstractions designed from one example
encode that example's accidents; by the third you can see which parts are the shape
and which were the accident.

**Folder = domain, file = concept.** A file is named after the one concept it owns
(`formatPrice.ts` = amount→display-string mapping). A `types.ts` accreting every type in the
module is the junk-drawer smell at file granularity; a small colocated `types.ts`
scoped to its own folder's domain is fine.

### Keep subfolders shallow

One level of nesting covers almost every case. Never go deeper than two levels below
the module root without a documented reason.

### Public entry per module

Every module exposes ONE public entry that is its API — in this repo,
`{{PUBLIC_ENTRY}}`. Callers never import an internal leaf. The exception: when only one
symbol from a leaf is needed and the entry would re-export a very large surface, a direct
leaf import is acceptable.

Every ecosystem has this mechanism under a different name — a barrel file, a package
`__init__`, a module declaration, an exported namespace. Whatever this repo's is, the rule
is the same: one front door per module, and everything behind it is private.

## Module boundaries — ports and adapters

Modules communicate through explicit contracts, never by reaching into each other's
internals (information hiding / dependency inversion).

- **A module's public entry IS its API.** Cross-module imports may only target another
  module's `{{PUBLIC_ENTRY}}`. Anything it doesn't re-export is private.
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

If the repo has a boundary linter — `dependency-cruiser` for JS/TS, `import-linter` for
Python, the compiler's own visibility rules elsewhere — encode the layer rules there so a new leak fails the build instead of relying on review. Justified
violations (vendored code, a migration in flight) go in a small explicit ignorelist
next to the lint config — each entry scoped to one rule + one path glob, with a
one-line reason. Never loosen the rule globally, never scatter inline disable comments.

### Apply this rule uniformly

This applies to every module in the codebase. When you add files to any folder,
check whether the folder now needs splitting.
