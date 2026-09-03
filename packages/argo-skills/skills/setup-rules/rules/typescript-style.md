---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript Style Rules

How TypeScript spells `code-style.md`. That file is the shape; this one is the syntax, plus
what only exists here. `any`, `as`, the non-null `!` and `@ts-ignore` are lint errors in
{{LINT_CONFIG}}, so they are not restated; the two sanctioned spellings are below.

| `code-style.md` intent | TypeScript |
|---|---|
| Exhaustive branch construct | `switch` on a string-literal union or `.type` field, with a `never`-typed default so a new variant fails the build |
| Line ceiling exemptions | state machines and pure-data modules |
| Nominal domain type (`domain-types.md`) | see **Branded types** below |

## The two sanctioned assertions

`as const`, and `as unknown as T` at a genuine external boundary with a comment naming the
boundary. Partial test fixtures use `@total-typescript/shoehorn`, never `as`.
`@ts-expect-error` is allowed only in a test asserting a type error, or with a comment naming
the upstream bug and the version that fixes it.

## Prove the type, don't assert it

At an untrusted edge (network response, `JSON.parse`, `process.env`, IPC, file read) parse
into the type with a schema validator or a hand-written `x is T` predicate that actually
inspects the fields it claims. `(await response.json()) as User` is a wish.

## Branded types

TypeScript is structural, so `type UserId = string` is an alias, not a boundary:

```ts
type UserId = string & { readonly __brand: 'UserId' }
const UserId = (raw: string): UserId => raw as UserId // the one place the invariant is checked
```

The `as` inside the constructor is the boundary cast, one per type, nowhere else. A schema
validator's `.brand<'UserId'>()` is the same spelling with the parse built in.

## File and folder naming

| Thing | Case | Example |
|---|---|---|
| Folders | `kebab-case` | `checkout/`, `user-profile/` |
| Component files | `PascalCase` | `OrderRow.tsx` |
| Non-component files | `camelCase` | `formatPrice.ts` |

Files a generator or vendor owns keep their upstream names. A platform-variant suffix
(`AnimatedIcon.web.tsx`) is a resolution contract and is never renamed for casing.

## Barrels and imports

The public entry is an `index.ts` barrel: wiring and re-exports only. Import from `'./thing'`,
never `'./thing/leaf'`. An import with three or more `../` segments is an alias instead,
configured in both `tsconfig.json` `paths` and the bundler resolver; for an npm-published
package use Node subpath imports (`#`-prefixed `"imports"` in `package.json`), because `tsc`
does not rewrite alias specifiers in emitted `.js`.
