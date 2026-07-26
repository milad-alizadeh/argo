---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript Style Rules

How TypeScript spells the rules in `code-style.md`. That file is the shape; this one is
the syntax, plus what only exists here. Nothing below restates a rule from there — if a
section here seems to be missing its rationale, the rationale is there.

| `code-style.md` intent | TypeScript |
|---|---|
| Exhaustive branch construct | `switch` on a string-literal union, `.type` field, or enum — with a `never`-typed default so a new variant fails the build |
| Nested conditional expressions | chained `a ? b : c ? d : e` |
| Checker-silencing pragmas | see **No escape hatches** below |
| Line ceiling exemptions | state machines and pure-data modules |

## No escape hatches

The type system is not optional. Each of these is forbidden in `src`:

- **`any`** — use `unknown` and narrow. `any` doesn't silence one error, it disables
  checking for everything downstream of that value.
- **`as`** — an assertion is a claim the compiler stops checking. Narrow with a guard or
  fix the source type. Two sanctioned uses: `as const`, and `as unknown as T` at a
  genuine external boundary, with a comment naming the boundary.
- **`!` non-null assertion** — check, or restructure so the value can't be null.
- **`@ts-ignore` / `@ts-expect-error`** — only in a test asserting a type error, or with
  a comment naming the upstream bug and the version that fixes it.

The test-data exception belongs to a tool, not a cast: partial fixtures use
`@total-typescript/shoehorn`, never `as`.

## Prove the type, don't assert it

TypeScript's form of "validate at the boundary". At an untrusted edge — network response,
`JSON.parse`, `process.env`, IPC payload, file read — parse into the type rather than
declaring it. A schema validator (Zod, Valibot, ArkType) or a hand-written `x is T`
predicate returns a value the compiler knows about because something *checked* at runtime.

- **Forbidden:** `const user = (await response.json()) as User`. That's a wish.
- A type predicate must actually inspect the fields it claims — `return true` under an
  `x is T` signature is a lie the compiler will honour everywhere.

## File naming — cased by what the file exports

| Thing | Case | Example |
|---|---|---|
| **Folders** (domain groupings) | `kebab-case` | `checkout/`, `user-profile/`, `settings/` |
| **Component files** | `PascalCase` | `OrderRow.tsx`, `SettingsPanel.tsx` |
| **Non-component files** (hooks, utils, types, machines) | `camelCase` | `formatPrice.ts`, `parseConfig.ts` |

The rule in one sentence: **folders are always lowercase kebab, files are cased by what
they export.** Vendored primitives under `components/ui/` keep their upstream lowercase
filenames (e.g. `button.tsx`) — do not rename them.

Names themselves follow `code-style.md`; only the casing convention is TypeScript's.

## Barrels are index.ts

The "public entry per module" rule (`file-structure.md`) maps to an `index.ts` barrel:
wiring and re-exports only, no business logic. Callers import from `'./thing'`, never
`'./thing/leaf'`:

```ts
import { OrderRow } from './orders'          // good
import { OrderRow } from './orders/OrderRow'  // avoid — leaks internal structure
```

## Path aliases over deep relative imports

A `../../../../` chain hard-codes the importer's depth, breaks on any move, and is
unreadable. Any import with three or more `../` segments should be an alias.

- Configure the alias in **two places that must agree**: `tsconfig.json`
  `compilerOptions.paths` (type-checker) AND the runtime/bundler resolver (Vite/Vitest
  `resolve.alias`). An alias in only one place type-checks but fails at runtime, or
  vice-versa.
- Convention: `@/*` → the package's own `src/*` for intra-package imports.

**Published-library gotcha:** `tsc` does NOT rewrite alias specifiers in emitted `.js`,
so a tsconfig-`paths` alias in the *emitted* source of an npm-published package breaks at
the consumer. There, use **Node subpath imports** — a `#`-prefixed pattern in
`package.json` `"imports"`, which Node resolves natively at runtime and tsc resolves under
`moduleResolution: NodeNext`. Bundled apps can use plain tsconfig+Vite aliases.
