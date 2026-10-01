# Tools for intents 10 to 15, by ecosystem

Intents 1 to 9 are ordinary lint rules and resolve through §3. These six need a tool of their
own, and which tool is a lookup: find your ecosystem's row, then go back to §4 for what the tool
has to be made to do.

**n/a is a real verdict here.** Where a compiler already enforces an intent, there is no gate to
install and the report says so.

| intent | JS/TS | Python | Go | JVM | Swift | Rust |
|---|---|---|---|---|---|---|
| 10 duplication | `jscpd` | `jscpd` | `dupl` | PMD-CPD | `jscpd` | `jscpd` |
| 11 file length | `max-lines` (ESLint) | `templates/file-length-check.mjs` | same | same | `file_length` (SwiftLint) | same |
| 12 dead public surface | `knip` | `vulture` | `deadcode` | detekt `UnusedPrivateMember` + unused warnings as errors | Periphery | **n/a**, the compiler reports it |
| 13/14 import graph | `dependency-cruiser` | `import-linter` | `go-arch-lint`, `depguard` | ArchUnit | grep over `import` lines | grep over `use` lines |
| 15 test hygiene | `eslint-plugin-vitest`, `eslint-plugin-jest` | the test plugin's equivalent | — | — | grep for a focused trait or a commented-out test | — |

**14 (circular dependencies) is n/a on Go**: the compiler rejects cycles.

**15 is n/a wherever the ecosystem has no focus mechanism.** Swift Testing and XCTest have no
rule for it, which is why the tool there is a grep.

## The traps each tool carries

- **`jscpd`** reads every language listed here, Swift and Rust included.
- **`knip`**'s per-file ignore leaves that file unguarded for every future dead export. Its
  configuration hints will suggest deleting deliberate prospective ignores, and its `project`
  globs are an enumerated scope. Label each of those where it lives.
- **`dependency-cruiser` on TypeScript** needs `tsPreCompilationDeps: true`. Compilation erases
  `import type`, so a deep type-only import otherwise exits 0. Prove it with a planted one.
- **`golangci-lint help linters`** lists linters, not the rules inside them, so a sub-rule name
  there cannot be verified by name. §3's behavioural probe is the only proof.
- **Privacy by the cheapest mechanism the ecosystem has**: a manifest `exports` field for a
  published package, an `internal/` folder (Go's compiler enforces it; elsewhere one rule
  forbidding an import of `internal/` from outside its parent), a barrel only where one already
  exists, since a barrel costs cold start, HMR and tree-shaking.
