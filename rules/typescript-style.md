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

## Guard clauses, not nesting

Handle the exceptional case first and `return` / `throw` / `continue` out of it. The
happy path stays at one indent level, at the bottom, unwrapped.

- **Forbidden:** an `if` whose body is the entire rest of the function. Invert it and
  return early.
- **Forbidden:** an `else` after a branch that already returned — the `else` is noise.
- Three levels of nesting inside one function is the signal: the inner levels are a
  separate function, or the outer ones are guards you haven't inverted yet.

## Three parameters, then an object

A fourth positional parameter is forbidden — pass one object instead. Positional
arguments encode order in every call site, and order is invisible at the call: nobody
reads `render(node, true, false, 2)`. A named object is self-describing and extends
without touching callers.

Two booleans in a row is already the smell, at any arity: either name them in an
object or split the function.

## No escape hatches

The type system is not optional. Each of these is forbidden in `src`:

- **`any`** — use `unknown` and narrow. `any` doesn't silence one error, it disables
  checking for everything downstream of that value.
- **`as`** — an assertion is a claim the compiler stops checking. Narrow with a guard
  or fix the source type. (Two sanctioned uses: `as const`, and the widening-free
  `as unknown as T` at a genuine external boundary, with a comment naming the boundary.)
- **`!` non-null assertion** — check, or restructure so the value can't be null.
- **`@ts-ignore` / `@ts-expect-error`** — only in a test asserting a type error, or
  with a comment naming the upstream bug and the version that fixes it.

The test-data exception belongs to a tool, not a cast: partial fixtures use
`@total-typescript/shoehorn`, never `as`.

## Prove the type, don't assert it

At an untrusted boundary — network response, `JSON.parse`, `process.env`, IPC
payload, file read — parse into the type, don't declare it. A schema validator (Zod,
Valibot, ArkType) or a hand-written `x is T` predicate returns a value the compiler
knows about because something *checked* at runtime.

- **Forbidden:** `const user = (await response.json()) as User`. That's a wish.
- A type predicate must actually inspect the fields it claims — `return true` under a
  `x is T` signature is a lie the compiler will honour everywhere.

## Don't name what you use once

A single-use `const` that only restates what the expression already says adds a hop
for the reader without adding meaning. Inline it.

Keep the name when it earns one: the expression is used twice, or the name encodes a
unit, a domain term, or a why the expression can't state (`const isPastCutoff = …`).
This is the counterweight to over-extraction, not a licence to nest calls four deep —
if inlining makes the line unreadable, the name was earning its place.

## No comments on obvious code

Default to writing no comments. Add one only when the WHY is non-obvious: a hidden
constraint, a subtle invariant, a workaround for a specific bug. Never write
multi-paragraph docstrings or multi-line comment blocks. (Full rule: `comments.md`.)

## One unit per file

A file exports exactly one of: a state machine, an actor, a React component, a hook,
a class, or a top-level function. Soft ceiling of ~150 lines (machines and pure data
files exempt).

## Names are words, not abbreviations

Spell identifiers out: `percentage` not `pct`, `context` not `ctx`, `configuration`
not `cfg`, `repository` not `repo`, `worktree` not `wt`. This covers component names,
props, variables, CSS classes **and user-visible labels** — a gauge labelled `CTX` is
as unreadable as a prop named `pct`.

Two exceptions: an acronym that is the domain's own name (`URL`, `HTML`, `ID`, `PR`,
`API`, `CI`), and a name the platform fixes for you (`ref`, `props`, `args`). Those
still follow the casing rule — `sessionId`, `prUrl`, never `sessionID` / `PRUrl`.

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
- Convention: `@/*` → the package's own `src/renderer/src/*` for intra-package imports.

**Published-library gotcha:** `tsc` does NOT rewrite alias specifiers in emitted
`.js`, so a tsconfig-`paths` alias in the *emitted* source of an npm-published
package breaks at the consumer. There, use **Node subpath imports** — a
`#`-prefixed pattern in `package.json` `"imports"`, which Node resolves natively at
runtime and tsc resolves under `moduleResolution: NodeNext`. Bundled apps can use
plain tsconfig+Vite aliases.

## No dead code

Remove unused exports, events, context fields, and config the moment they stop
being wired up.
