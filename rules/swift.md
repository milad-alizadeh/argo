---
paths:
  - "apps/macOS/**/*.swift"
---

# Swift and the Cockpit

How Swift spells `house.md`, plus the rules the cockpit's contract adds. The escape hatches
(`!`, `try!`, `as!`, implicitly unwrapped optionals, `@unchecked Sendable`,
`swiftlint:disable`) and the caps are SwiftLint errors; the package layering, the token gate
and the row-height rule are `scripts/swift-boundaries.sh` (AGENTS.md, Module boundaries).

## Swift

- **A `switch` over an internal enum has no `default:`**; group unrelated cases with
  `case .a, .b:`. `@unknown default:` only over a non-frozen system enum.
- **`try?` standing alone as a statement discards the error**; bound into `guard let` it is
  handled. No linter separates the two.
- **`public` only on what another target calls.** Tests reach `internal` through
  `@testable import`; `fileprivate` shared between two types is usually two files.
- **Decode with `Codable`, never a cast**, and never an all-optional model to make the decode
  pass. Decode failures are values. The untrusted boundary is `ArgoEngine/Transcript`.
- **Strict concurrency is a design question.** `@MainActor` on view state, never sprinkled on
  the engine; what crosses to the UI is a value type or an `actor`; no `await` inside a lock,
  no semaphore bridge.
- Files are `PascalCase` after the type they declare; extension-only files are
  `Type+Capability.swift`.

## Views

- **Three tiers, decided before the `body`**: atoms take presentational parameters and read
  no shared state; molecules compose atoms into one labelled unit; organisms are the only
  tier with domain shape. Never inline a lower tier's shape; extract on the second copy.
- **A `body` is a composition.** Extract to a separate `View` struct taking its data as
  parameters, never a `@ViewBuilder` function.
- **Views take data, never a store.** A thin container resolves state; the View's initialiser
  parameters are its whole input. One file in `ArgoUI` reads live Hub state, by gate.
- **Reach for the platform control** (`Menu`, `Popover`, `Table`, `Divider`) before a bespoke
  one, and restyle it through the contract.
- **Every control is a real control** (`Button`, `Menu`, `Picker`, `TextField`), never a shape
  with `onTapGesture`. Full Keyboard Access is the contract and the app builds no ring of its
  own (#718); `.focusable()` is for a key the control would not otherwise get, named at the
  call; a focusable that can show focus draws `argoFocusRing`; a command with a platform
  convention is bound to its key and lives in a `Commands` menu unless it is anchored to a
  control on screen.

## The contract

- **Tokens only.** Every colour, size, duration and spacing is a name from `ArgoDesign`, or a
  measure on the sheet beside the one surface it describes. Need a value? Add it to the
  contract first, with the question it answers. Colour comes from `@Environment(\.argo)`,
  and a relationship between roles ("at least `secondary`") survives a light palette where
  an arithmetic on values does not.
- **Every string the user reads is set by a role** through `argoText(_:)` / `argoMono(_:)`;
  the type scale is Apple's and `size` is read, never set.
- **Hue is rationed.** Ion Blue is brand, selection and focus; the text ramp is neutral; a
  kind of thing gets a ground, a weight or a face, never a hue. Three sealed exemptions:
  `SyntaxTheme` inside the evidence panel, a provider's own label colour through `LabelInk`,
  and the composer field's command mark (`ComposerTextView.ink`, #1256) — the one substring
  of a draft the CLI will run, told apart from every other word in it, which is a fact about
  execution and not a decoration. Where the accent is spent: `docs/designs/selection-accent.md`.
- **Roles, not values**: `ArgoSpacing.comfortable`, not `space12`. A raw value found in a
  view is snapped or promoted, never patched locally or allowlisted outside tracked debt.
- **Runtime-derived numbers and a measure with no home yet** are the only raw numbers allowed
  in a view, with a comment, the second in the same change that gives it a home.

## Rendering

A state with no render is a state nobody has looked at. Every view previews the states it can
be in, one render per axis (a gallery per union, the non-default side per layout boolean,
one each for loading/empty/error/populated), and a parent covers only what composition adds.
A state worth a screenshot is a `SpecimenEntry`; render it before calling visual work done
(`docs/agents/visual-verification.md`). What a design pass settles is committed in
`docs/designs/`, agreed-latest only, and a brief is a spec never eyedropped as a source.
