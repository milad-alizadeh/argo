---
paths:
  - "apps/**/*.{ts,tsx}"
  - "packages/**/*.{ts,tsx,mjs}"
  - "scripts/**/*.mjs"
  - "scripts/**/*.mjs"
---

# File Structure Rules

Where code lives, and which parts of a module the rest of the codebase may see. These
rules are about structure rather than syntax, so they bind **every language in this
repo**. One thing differs per language — what a module's public entry *is* — and this
repo's is `index.ts`.

## Folder-split hygiene — extract before you dump

When a file nears the line ceiling (`code-style.md` owns that number) or a folder root
accumulates 5+ peer files doing related things, extract into a subfolder. Do this proactively while authoring a
feature, not as a follow-up cleanup task.

**At a MODULE root this is arithmetic, not advice.** Each module declares what may sit loose
at its root in the map's `placement.rootFiles` block, and `root-files-check.mjs` fails the
build on anything else — including a module with no entry at all (ADR-0021). The reasoning
lives in that gate's failure message, where it is read at the moment it applies.

### The split pattern

One file becomes a folder of focused units behind one entry:

```
thing/
  index.ts   # orchestrator only: wires sub-units together, re-exports the API
  partA              # one focused unit
  partB              # one focused unit
```

The entry file is the **orchestrator** — wiring and re-exports only. No business logic
lives there; that belongs in named leaf files. Callers keep importing `thing`, and the
language resolves the entry for them — zero import churn.

### When to extract

- A file passes the line ceiling `code-style.md` sets
- A folder root has 5+ peer files that fall into natural sub-domains
- Two or more files share a prefix (`orderCreate`, `orderCancel`) — that prefix is the
  subfolder name

### Group by domain, not by file type

Folders are named by **what the code is for** (feature/domain), never by what the
files syntactically are. `checkout/`, `user-profile/`, `settings/` beat `utils/`.

**Kind-folders are banned:** never create `schemas/`, `types/`, `utils/`,
`helpers/`, `constants/`, `interfaces/`, `validators/`, `handlers/` as grouping
folders. They become junk drawers: touching one feature means hopping across five
kind-buckets, and deleting a feature leaves orphans in each. A feature's schema,
types, and validation live INSIDE that feature's folder (`checkout/schema`, not
`schemas/checkout`).

The one sanctioned exception is the shared tier described next.

A kind-folder is the one structural mistake that looks tidy while it spreads, so where the
repo can count it, it does: `kind-folder-check.mjs` fails the build on a banned folder name.
`components/` is not banned — a slice's own `components/` holds one feature's components,
which is the opposite of a junk drawer.

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

- **the shared tier (domain-aware)** — it names a domain term (`formatInvoiceTotal`).
  Reachable by any domain; may import from the generic tier.
- **the generic tier (product-agnostic)** — it would stand alone as its own published
  package: no domain nouns, no app imports, no config. Imports nothing from the app.

This repo names those tiers `lib/` and `lib/generic/`. Neither exists until
a third caller creates it — that's the point, not an omission.

The two tiers are **earned differently**, which matters because only one of them can be
counted. The domain-aware tier is earned by callers, so `earned-shared-check.mjs` counts them
per symbol and fails a symbol only one module wanted. The generic tier is earned by
**category** — "would stand alone as its own published package" — so a vendored primitive or an
icon belongs there from its first caller, and those paths are excluded from the count rather
than exempted one by one. Counting per symbol is not an optimisation: everything leaves a tier
through a barrel, so a file-level import graph shows every module depending on every leaf
behind it and can prove nothing about who wanted what.

**Imports flow upward only.** A domain may import both tiers; `lib/` may import
`lib/generic/`; `lib/generic/` imports neither. Two consequences worth naming, because
both are signals rather than judgment calls: a sibling-domain import (`checkout/`
reaching into `orders/`) means the shared thing wants hoisting, and a domain type
appearing inside `lib/generic/` means that file wants demoting.

Waiting for the third caller is the point. Abstractions designed from one example
encode that example's accidents; by the third you can see which parts are the shape
and which were the accident.

**Folder = domain, file = concept.** A file is named after the one concept it owns
(`formatPrice` = amount→display-string mapping). A catch-all `types` file accreting every
type in the module is the junk-drawer smell at file granularity; a small colocated one
scoped to its own folder's domain is fine.

### Keep subfolders shallow

One level of nesting covers almost every case. Never go deeper than two levels below
the module root without a documented reason.

### No module root is a folder for leftovers

Wiring is the file with no obvious home — the hook that reads the store, the `ipcMain.handle`
that fronts a domain — and "for now" at the root is how a module flattens. It still needs a
**named home**: a domain-named folder behind its own entry. Where wiring lives is a judgement
call worth making per module, and one answer does not transfer:

- The renderer's slices are pure Views, so a store read genuinely cannot live inside one — its
  wiring is hoisted into `cockpit/`, which the container alone calls and no slice imports back.
- Main has no such constraint, so the opposite holds: each domain owns its own bridge
  (`git/bridge.ts`, `hub/bridge.ts`), and its root is the entry alone.

Copying the renderer's shape into main without its reason is exactly how main flattened
(ADR-0021). `root-files-check.mjs` counts the result either way.

### Public entry per module

Every module exposes ONE public entry that is its API — in this repo,
`index.ts`. Callers never import an internal leaf. The exception: when only one
symbol from a leaf is needed and the entry would re-export a very large surface, a direct
leaf import is acceptable.

Every ecosystem has this mechanism under a different name — a barrel file, a package
`__init__`, a module declaration, an exported namespace. Whatever this repo's is, the rule
is the same: one front door per module, and everything behind it is private.

## Module boundaries — ports and adapters

Modules communicate through explicit contracts, never by reaching into each other's
internals (information hiding / dependency inversion).

- **A module's public entry IS its API.** Cross-module imports may only target another
  module's `index.ts`. Anything it doesn't re-export is private.
- **Depend on ports, not implementations.** When module A needs behavior module B
  provides, A consumes an interface/registry (the port) and B registers into it
  (the adapter). A never imports B directly if B is a lower-trust or more specific layer.
- **Layering is one-directional.** Generic/core layers must not import from specific
  layers (adapters, domain packs, app features). Specific layers may import the
  generic layer's public API; two specific layers never import each other's internals.
  In this project: `main/` never imports from `renderer/`, and within a
  layer, feature folders never import each other's leaves.
- **Side-effect imports for registration happen in exactly ONE composition root**
  (the entry point that wires the app together), never scattered across consumers.
- **No god nodes.** A module with extreme fan-in or fan-out is a Single-Responsibility
  violation at graph scale — split it by responsibility.

### Enforce mechanically where you can

If the repo has a boundary linter — `dependency-cruiser` for JS/TS, `import-linter` for
Python, the compiler's own visibility rules elsewhere — encode the layer rules there so a new leak fails the build instead of relying on review.

Know what that linter cannot see: it judges **edges**, never **placement**. Every rule above
about where a file lives is invisible to it, and the failure mode is not a loud one — the
misplaced file's imports are all legal, so the gate goes green and the structure drifts anyway.
Placement is a glob predicate, so it can have gates of its own; this repo runs three
(`root-files-check.mjs`, `kind-folder-check.mjs`, `earned-shared-check.mjs`), all
compiled from the same module map the boundary linter reads, on pre-commit as well as in CI —
a misplaced file caught in CI is a follow-up ticket, caught pre-commit it is fixed by whoever
still has the context that produced it. Justified
violations (vendored code, a migration in flight) go in a small explicit ignorelist
next to the lint config — each entry scoped to one rule + one path glob, with a
one-line reason. Never loosen the rule globally, never scatter inline disable comments.

### Apply this rule uniformly

This applies to every module in the codebase. When you add files to any folder,
check whether the folder now needs splitting.

That sentence was already here, and `main/` still reached 16 files at its root while the one
path a gate covered stayed clean. Uniformity is a property of the ENFORCEMENT, not of the
prose: a new module is guarded from its first file because an undeclared module fails
(ADR-0021), not because this paragraph says every module counts.
