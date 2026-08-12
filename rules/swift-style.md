---
paths:
  - "apps/macOS/**/*.swift"
---

# Swift Style Rules

How Swift spells the rules in `code-style.md`. That file is the shape; this one is the
syntax, plus what only exists here. Nothing below restates a rule from there — if a
section here seems to be missing its rationale, the rationale is there.

| `code-style.md` intent | Swift |
|---|---|
| Exhaustive branch construct | `switch` over an `enum` with **no `default:`** — the compiler fails the build when a case is added |
| Nested conditional expressions | chained `a ? b : c ? d : e` |
| Checker-silencing pragmas | see **No escape hatches** below |
| Line ceiling exemptions | pure-data catalogs (token tables, fixtures) and `Codable` models |
| Public entry per module | the SwiftPM target itself — see **`public` is the module boundary** |

## The exhaustive `switch` has no `default`

A `default:` clause converts the one construct Swift checks exhaustively back into an
`if`-chain: adding an enum case compiles, falls into the default, and ships. Enumerate
every case. Group unrelated ones with `case .a, .b:` rather than reaching for `default`.

`@unknown default:` is the single exception, and only over a non-frozen system enum
(`NSApplication.*`, `URLError.Code`, …) where a future OS really can add a case.

## No escape hatches

Each of these is forbidden in `Sources/` and `Argo/`:

- **`!` force unwrap** and **`try!` / `as!`** — a crash the compiler was offering to
  prevent. Use `guard let`, `if let`, `as?`, or `try` with a real error path.
- **Implicitly unwrapped optionals** (`var window: NSWindow!`) — the same crash, moved to
  the declaration where nothing at the use site warns you.
- **`@unchecked Sendable`** — a promise to the concurrency checker that nothing verifies.
  Make the type actually `Sendable` (value types, `let` fields) or put it behind an actor.
- **`// swiftlint:disable`** — the caps are the rules. Fix the code, or ratchet the
  exemption in `apps/macOS/.swiftlint.yml` where it is visible and dated.
- **`fatalError()` as control flow** — it is legitimate only for a genuinely unreachable
  branch (`required init?(coder:)` in a code-only view), never for "this shouldn't happen".

`try?` deserves its own line, because half of its uses are fine and half are a bug. Bound
into a `guard let` / `if let`, the failure IS handled and the branch says so. Standing
alone as a statement — `try? handle.write(data)` — it discards both the value and the
error, and nothing downstream can tell the write happened. No linter separates the two
cases, so this one is on you at review time.

## `public` is the module boundary

Swift has no barrel file because it does not need one: the target is the module, and
`internal` (the default) already means "not the public entry". So the rule from
`file-structure.md` is spelled by access control, not by an `index` file.

- Declare `public` only on what another target genuinely calls. `ArgoUI`'s public surface
  is the views the app composes; `ArgoEngine`'s is the domain model and its readers.
- Never widen a declaration to `public` to make a test compile — test targets reach
  `internal` symbols through `@testable import`.
- `private` for a type's own helpers, `fileprivate` only when two types in one file
  genuinely share state (and that is usually a sign they are two files).
- **`///` is not a licence.** `public` here means "another target in this repo calls it",
  never "someone outside this repo reads it" — nothing ships these symbols anywhere, and
  `swift-boundaries.sh` exists because the boundary is internal. Xcode's Quick Help does
  render a `///`, but to a reader who already has the file open, so it buys no room the
  file itself does not. A `///` above any declaration here is therefore an ordinary
  comment on `comments.md`'s one-line budget. Only a docs build lifts that, and there
  isn't one.

## Parse at the boundary with `Codable`, never a cast

Swift's spelling of "validate at the boundary". A transcript line, a `gh` response, a
plist, a pasteboard payload — decode it into a type.

- **Forbidden:** `json["role"] as! String`, `unsafeBitCast`, and a `Decodable` model whose
  fields are all optional to make the decode pass. An all-optional model is a cast with
  extra steps: it moves the failure from the edge to the first use site.
- Decode failures are values: return a typed error or a "could not read this line" case
  in the domain enum. The untrusted-input boundary lives in `ArgoEngine/Transcript` and
  nothing inward re-checks what it produced.

## Concurrency is checked, so state where things run

Swift 6 strict concurrency is on. Treat an isolation error as a design question, not an
annotation to add.

- `@MainActor` belongs on view state, not sprinkled on the engine to quiet a warning.
- Anything the engine hands to the UI crosses an isolation boundary, so it is a value
  type: `struct`, `enum`, `let`. If a class must cross, it is an `actor`.
- Never `await` inside a lock, and never bridge with a semaphore — that is a deadlock the
  checker was pointing at.

## File naming — one type per file, named for the type

| Thing | Case | Example |
|---|---|---|
| **Folders** (domain groupings inside a target) | `PascalCase` | `Session/`, `Transcript/` |
| **Files** | `PascalCase`, matching the type it declares | `TranscriptTail.swift`, `CockpitView.swift` |
| **Extension-only files** | `Type+Capability.swift` | `Event+Evidence.swift` |

Folders are PascalCase here and kebab-case in TypeScript because each follows its own
ecosystem's convention, and a Swift folder is a step on a real module path. Names
themselves follow `code-style.md`.

## SwiftUI

This section extends `ui-components.md` — atomic design, reuse before you build, and the
container/View split all hold. What follows is how SwiftUI says them.

**A `body` is a composition, not a screen.** When a `body` runs past a screenful, the
nested layers are subviews. Extract to a **separate `View` struct** taking its data as
parameters — not to a `@ViewBuilder` function, which hides the extraction from the type
system and from previews.

**Views take data, never a store.** A view's initializer parameters are its whole input.
Reading a shared observable from inside a leaf view makes it unpreviewable and untestable,
and re-renders it on state it does not draw. The screen's container resolves state and
passes a view-model value down.

**Every visual constant is a token.** No raw `Color(red:green:blue:)`, no `.padding(13)`,
no `.font(.system(size: 13))` in a view. Colors, spacing, radii, type and motion come from
`ArgoUI`'s token source — see `design-system.md` for what "fix the contract, not the
symptom" means when a value is missing. Semantic system colors (`.primary`,
`.secondary`) are not an escape route: they are Apple's palette, not Argo's.

**All rendered text goes through the type ramp.** A bare `Text("…")` with no style
modifier is the Swift form of the untokenized string `ui-components.md` bans. Use the
`ArgoUI` text styles so the ramp is the only place a size or weight is decided.

**`#Preview` is where a state is looked at, and a `SpecimenEntry` is where it is proved.**
Every view ships previews covering the states it can be in — empty, loaded, error, long
content — per `ui-components.md`'s coverage rule, and for its reason: a state with no render
is a state nobody has looked at. A preview that needs a running engine is a view that violated
"views take data". A state worth a screenshot also earns an entry in `SpecimenRegistry`, which is
what a reviewer and CI can actually see (`designs.md`).

## Self-check before you finish

1. Does any `switch` over an internal enum carry a `default:`?
2. Is there a `!`, `try!`, `as!`, or an implicitly unwrapped optional outside the
   sanctioned cases?
3. Is anything `public` that no other target calls?
4. Does external data enter through a cast, or through an all-optional `Decodable`?
5. Does a view read shared state instead of taking it, or hard-code a colour, size or
   spacing?
6. Does any view lack a preview for a state it can render?

Any "yes" to 1, 2, 3, 4, 5, or "yes" to 6 → fix it before reporting done.
