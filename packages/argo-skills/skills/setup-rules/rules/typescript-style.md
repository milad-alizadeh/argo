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
| Nominal domain type (`domain-types.md`) | see **Branded types** below |

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

## Branded types

TypeScript is structural, so `type UserId = string` is an alias, not a boundary — every
string is a `UserId`. The nominal type `domain-types.md` asks for is spelled with a brand:

```ts
type UserId = string & { readonly __brand: 'UserId' }
const UserId = (raw: string): UserId => {
  // the one place the invariant is checked
  return raw as UserId
}
```

The brand exists only at compile time — no wrapper object, no runtime cost — and the `as`
inside the constructor is the boundary cast `code-style.md` sanctions: one per type, in the
constructor, nowhere else. Everything outside constructs a `UserId` through that function or
doesn't have one. A schema validator's `.brand<'UserId'>()` (Zod and kin) is the same
spelling with the parse built in — prefer it where the value enters from outside anyway.

| Thing | Case | Example |
|---|---|---|
| **Folders** (domain groupings) | `kebab-case` | `checkout/`, `user-profile/`, `settings/` |
| **Component files** | `PascalCase` | `OrderRow.tsx`, `SettingsPanel.tsx` |
| **Non-component files** | `camelCase` | `formatPrice.ts`, `parseConfig.ts` |

The rule in one sentence: **folders are always lowercase kebab, files are cased by what
they export.**

Two things this table does not say, and both matter:

- It is about **casing only**. Naming a file after a kind (`types.ts`, `schema.ts`) is
  governed by `file-structure.md` — which permits it inside a domain folder and bans it as
  a grouping folder. Nothing here endorses a `utils/` or `types/` directory.
- Files a generator or vendor owns keep their upstream names — a kit's primitives under its
  own directory (e.g. `button.tsx`) are a vendor drop, not your naming. Do not rename them.

If this repo's bundler resolves **platform or environment variants** by filename suffix
(Metro's `.ios`/`.android`/`.web`, a bundler's `.node`/`.browser`), the suffix sits before
the extension and the base name still follows the table: `AnimatedIcon.web.tsx`. The suffix
is a resolution contract, so it is never renamed to satisfy a casing rule.

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
