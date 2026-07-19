---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript Style Rules

## switch over if/else

When branching on a discriminant (string literal union, `.type` field, enum) always
use `switch`. Reserve `if/else` for non-enumerable conditions (range checks,
truthiness, arbitrary booleans). `switch` enables exhaustiveness checking and is
easier to extend.

## No nested ternaries

Single-depth `a ? b : c` is fine. Chaining ternaries (`a ? b : c ? d : e`) is
forbidden — use `switch` or early-return `if` blocks instead. Applies everywhere:
action bodies, JSX, helper functions.

## No comments on obvious code

Default to writing no comments. Add one only when the WHY is non-obvious: a hidden
constraint, a subtle invariant, a workaround for a specific bug. Never write
multi-paragraph docstrings or multi-line comment blocks. (Full rule: `comments.md`.)

## One unit per file

A file exports exactly one of: a state machine, an actor, a React component, a hook,
a class, or a top-level function. Soft ceiling of ~150 lines (machines and pure data
files exempt).

## File naming — cased by what the file exports

| Thing | Case | Example |
|---|---|---|
| **Folders** (domain groupings) | `kebab-case` | `checkout/`, `user-profile/`, `settings/` |
| **Component files** | `PascalCase` | `OrderRow.tsx`, `SettingsPanel.tsx` |
| **Non-component files** (hooks, utils, types, machines) | `camelCase` | `formatPrice.ts`, `parseConfig.ts` |

The rule in one sentence: **folders are always lowercase kebab, files are cased by
what they export.** Vendored primitives under `components/ui/` keep their upstream
lowercase filenames (e.g. `button.tsx`) — do not rename them.

## Barrels are index.ts

The "public entry per module" rule (`file-structure.md`) maps to an `index.ts`
barrel: wiring and re-exports only, no business logic. Callers import from
`'./thing'`, never `'./thing/leaf'`:

```ts
import { OrderRow } from './orders'          // good
import { OrderRow } from './orders/OrderRow'  // avoid — leaks internal structure
```

## Path aliases over deep relative imports

A `../../../../` chain hard-codes the importer's depth, breaks on any move, and is
unreadable. Define a path alias instead. Any import with three or more `../`
segments should be an alias.

- Configure the alias in **two places that must agree**: `tsconfig.json`
  `compilerOptions.paths` (type-checker) AND the runtime/bundler resolver
  (Vite/Vitest `resolve.alias`). An alias in only one place type-checks but fails
  at runtime, or vice-versa.
- Convention: `@/*` → the package's own `src/*` for intra-package imports.

**Published-library gotcha:** `tsc` does NOT rewrite alias specifiers in emitted
`.js`, so a tsconfig-`paths` alias in the *emitted* source of an npm-published
package breaks at the consumer. There, use **Node subpath imports** — a
`#`-prefixed pattern in `package.json` `"imports"`, which Node resolves natively at
runtime and tsc resolves under `moduleResolution: NodeNext`. Bundled apps can use
plain tsconfig+Vite aliases.

## No dead code

Remove unused exports, events, context fields, and config the moment they stop
being wired up.
