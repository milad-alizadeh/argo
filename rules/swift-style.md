---
paths:
  - "apps/macOS/**/*.swift"
---

# Swift Style Rules

How Swift spells `code-style.md`. That file is the shape; this one is the syntax, plus what
only exists here. The caps and the escape-hatch bans (`!`, `try!`, `as!`, implicitly unwrapped
optionals, `@unchecked Sendable`, `fatalError` without a message, `swiftlint:disable`) are
SwiftLint errors in `apps/macOS/.swiftlint.yml`, so they are not restated here.

| `code-style.md` intent | Swift |
|---|---|
| Exhaustive branch construct | `switch` over an `enum` with **no `default:`** |
| Line ceiling exemptions | pure-data catalogs (token tables, fixtures) and `Codable` models |
| Public entry per module | the SwiftPM target itself: `internal` is the default and the boundary |

## The exhaustive `switch` has no `default`

A `default:` turns the one construct Swift checks exhaustively back into an `if`-chain: a new
enum case compiles, falls into the default, and ships. Enumerate every case; group unrelated
ones with `case .a, .b:`. `@unknown default:` is the single exception, and only over a
non-frozen system enum where a future OS really can add a case.

## `try?` is on you at review time

Bound into a `guard let` or `if let`, the failure is handled and the branch says so. Standing
alone as a statement (`try? handle.write(data)`) it discards both the value and the error, and
no linter separates the two cases.

## `public` is the module boundary

- Declare `public` only on what another target genuinely calls. Never widen to `public` to
  make a test compile; tests reach `internal` through `@testable import`.
- `private` for a type's own helpers; `fileprivate` only when two types in one file share
  state, which is usually a sign they are two files.
- `public` means "another target in this repo calls it", never "someone outside reads it", so
  a `///` above it buys no room (`comments.md`).

## Parse at the boundary with `Codable`, never a cast

A transcript line, a `gh` response, a plist, a pasteboard payload: decode it into a type.
**Forbidden:** `json["role"] as! String`, `unsafeBitCast`, and a `Decodable` model whose
fields are all optional to make the decode pass, which moves the failure from the edge to the
first use site. Decode failures are values: a typed error or a "could not read this line" case.
The untrusted-input boundary is `ArgoEngine/Transcript`, and nothing inward re-checks it.

## Concurrency is checked, so state where things run

Swift 6 strict concurrency is on. An isolation error is a design question, not an annotation
to add. `@MainActor` belongs on view state, not sprinkled on the engine. Anything the engine
hands to the UI is a value type; if a class must cross, it is an `actor`. Never `await` inside
a lock, never bridge with a semaphore.

## File naming

Folders `PascalCase` (`Session/`), files `PascalCase` matching the type they declare,
extension-only files `Type+Capability.swift`.

## SwiftUI

`ui-components.md` holds the tiers, the container/View split and the coverage rule. Two things
are Swift's own spelling:

- **A `body` is a composition, not a screen.** Extract to a separate `View` struct taking its
  data as parameters, never to a `@ViewBuilder` function, which hides the extraction from the
  type system and from previews.
- **A `#Preview` covers every state a view can be in**, and a preview that needs a running
  engine is a view that violated "views take data". A state worth a screenshot also earns a
  `SpecimenEntry` (`designs.md`).
