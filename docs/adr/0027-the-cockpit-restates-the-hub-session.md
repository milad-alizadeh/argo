# 0027 · The cockpit's Session restates HubSession, and the projection is total

Status: accepted · 2026-08-12

Closes #639. Binding on `CockpitPresentation.Session` and on `CockpitPresentation+Hub.swift`. It
narrows ADR-0022's "everything else takes a value" from a phrasing that could be read two ways to
one that cannot.

## Context

`CockpitPresentation.Session` restates 24 facts that `HubSession` already holds, and 19 of them
cross `init(observed:annotations:)` unchanged. Only five carry logic: `access`, `workspace`,
`isArchived`, `explicitName`, and `issue`, which is hardcoded `nil` until a Work Item provider is
connected. Ten of the copied types are engine types ArgoUI imports directly. Two of #632's
explorers read that as duplication and proposed the obvious shrink — hold the `HubSession` and
compute the derived facts on top:

```swift
struct Session { let observed: HubSession; let annotations: …; let issue: Issue? }
```

The cost being paid instead is real and visible in history. A new engine fact takes four
coordinated edits — `HubSession`, the property list, the 24-parameter init, and the mapping — and
until now no gate caught a missed one. `standingAllows` (#572) and `expiredPermissions` (#573) each
touched six files.

The layering rule is not what settles it. `swift-boundaries.sh` bans live `Hub` state in ArgoUI,
and `HubSession` is an immutable `Sendable` value rather than the Hub. Embedding one would leave
`CockpitPresentation+Hub.swift` the only file touching a live Hub, exactly as ADR-0022 requires.
The rule permits the shrink. Something else has to decide it.

## Decision

**The cockpit keeps its own flat `Session` and restates the engine's facts.** It does not hold a
`HubSession`.

**And the projection is total.** Every public fact on `HubSession` either appears in the mapping as
`session.<name>` or is named on a `not-projected:` line beside it. `swift-boundaries.sh` edge 5
enforces both directions: a fact in neither place fails the build, and so does a `not-projected:`
entry naming a fact that no longer exists.

At the time of writing that is 32 public facts — 22 landed, 10 deliberately dropped.

## Why

**The projection is narrowing, not copying.** Ten of the 32 facts have no landing site *on purpose*:
`sourceURL`, `liveness`, `convention`, `modeSet`, `headLeafUUID`, `lastActivityAtMs`,
`hasAgentActivity`, `isQueued`, `signals`, `statusReading`. Several are the raw inputs to a
derivation the cockpit is supposed to take the *result* of. `statusReading` carries the honesty tier
beside the status; `signals` is the tuple `SessionStatus.read` folds; `liveness` and `convention` are
two of that fold's inputs. Embedding the value hands every view all ten and invites a surface to
re-derive a status the engine already read, or to render a tier that was never meant to leave the
Hub. The 19 verbatim fields are what the projection *keeps*, not what it *is*.

**`let` against `internal(set) var` is the value/live-state line.** `HubSession`'s fields are fed by
`apply(_:)` as the transcript streams. The cockpit's are `let`. Restating them is what makes a UI
value that cannot accidentally depend on engine mutability, and it is cheap to state and free to
check.

**39 sites construct the flat value directly** — 19 under `Specimen/`, 20 under `Tests/`. The
defaulted 24-parameter init is genuine fixture ergonomics, and `HubSession` cannot offer it: its
fields are `internal(set)` and its only initialisers take a `TranscriptObservation` or an
`AgentSpawn`. Shrinking would mean 39 migrations to buy back what the copy already gives.

**The gate buys the safety the shrink was reaching for.** The argument *for* embedding was never
elegance; it was that a missed copy is silent. Edge 5 makes it loud, for a fraction of the change.

## Consequences

- **A new engine fact still costs four edits, and now the build says so.** The gate does not remove
  the work. It removes the silence.
- **`not-projected:` is a list of decisions, maintained by hand.** That is the point: adding a fact
  to it is a sentence someone had to write about why the cockpit does not render it.
- **Edge 5 matches declarations by text, not by type.** It reads `HubSession.swift` and the
  `HubSession+*.swift` extensions for public `var`/`let` at struct indentation. A fact declared
  somewhere else — a third file, a protocol conformance — is invisible to it. Add the file to the
  glob rather than working around this.
- **A fact can land and still reach no pixel.** The gate proves the projection was told; it cannot
  prove a view draws it. That remains a test's job.
- **The `let`/`var` argument disappears if `HubSession` ever becomes fully immutable.** If the Hub
  moves to rebuilding sessions rather than mutating them, the second reason here is gone and only
  the narrowing and the fixtures remain. Both still hold, but the case would be worth re-reading.
- **Do not re-propose the shrink on the "19 verbatim fields" observation alone.** It is true, it was
  weighed, and the ten dropped facts are the answer to it.
