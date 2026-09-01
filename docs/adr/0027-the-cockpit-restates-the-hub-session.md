# 0027 · The cockpit's Session restates HubSession, and the projection is total

Status: accepted · 2026-08-12 · init shape and gate strength amended (#755) · 2026-08-26 ·
reader carve-out amended (#858) · 2026-09-01

Closes #639. Binding on `CockpitPresentation.Session` and on `CockpitPresentation+Hub.swift`. It
narrows ADR-0022's "everything else takes a value" from a phrasing that could be read two ways to
one that cannot.

## Context

`CockpitPresentation.Session` restates 24 facts that `HubSession` already holds, and 19 of them
cross `init(observed:annotations:)` unchanged. Only five carry logic: `access`, `workspace`,
`isArchived`, `explicitName`, and `issue`, which is hardcoded `nil` until a Work Item provider is
connected. Nine of the field types are engine types ArgoUI names directly rather than restating —
`WorkspaceProjection`, `AgentCLI`, `SessionStatus`, `PermissionRequest`, `StandingAllow`,
`PermissionExpiry`, `SessionModeReading`, `SessionMode`, `TranscriptEvent`. Two of #632's explorers
read that as duplication and proposed the obvious shrink — hold the `HubSession` and compute the
derived facts on top:

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
`session.<name>` — in code, not in prose — or on a `not-projected: <name> — <why>` line beside it.
`swift-boundaries.sh` edge 5 enforces all three directions: a fact in neither place fails the
build, so does a `not-projected:` entry naming a fact that no longer exists, and so does a fact
claimed by both.

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
- **Edge 5 matches declarations by text, not by type.** It reads `HubSession*.swift` for `var`/`let`
  at struct indentation, requiring the `public` keyword in the struct body and accepting it either
  way inside a `public extension HubSession`. A fact declared outside that glob — a third file, a
  protocol conformance, a `public extension` on some other type — is invisible to it. Widen the
  glob rather than working around this.
- **Text matching fails silently, so the gate needs its own tests.**
  `scripts/swift-boundaries.test.mjs` runs edge 5 against a synthetic tree and asserts it goes red
  on each way the projection can fall behind, including the two that check nothing at all: a moved
  `HubSession.swift`, and a declaration shape the pattern no longer matches. A gate matching
  nothing passes everything, and nothing else in the repo would notice.
- **A fact can land and still reach no pixel.** The gate proves the projection was told; it cannot
  prove a view draws it. That remains a test's job.
- **The `let`/`var` argument disappears if `HubSession` ever becomes fully immutable.** If the Hub
  moves to rebuilding sessions rather than mutating them, the second reason here is gone and only
  the narrowing and the fixtures remain. Both still hold, but the case would be worth re-reading.
- **Do not re-propose the shrink on the "19 verbatim fields" observation alone.** It is true, it was
  weighed, and the ten dropped facts are the answer to it.

## Amendment · the init's shape, and what the gate proves (#755) · 2026-08-26

The restatement above was and stays the decision: the cockpit keeps its own flat `Session`, and the
"19 verbatim fields" argument is still not a reason to re-propose the shrink. What this amends is
the **shape of `Session.init`**, and the **strength of edge 5** — a second re-read trigger beside
the `HubSession`-becomes-immutable one in *Consequences*.

**The interface had grown to 27 interchangeable slots.** Every one an `Int?`, a `String?` or a
`Bool`, six of them without a default, and 21 of them a verbatim pass-through carrying no
information a caller did not already have from the field docstring above it. The deletion test
passes on the projection as a module and fails on that list.

**Both gates were blind to the one error the shape invites.** SwiftLint's `function_parameter_count`
visits *function* declarations, so the widest parameter list in the module sat under a cap of 4
without ever being counted. And edge 5 proved a fact was **mentioned**, never that it landed on the
right field — swapping `spentTokens:` and `cachedTokens:` in the mapping kept it green, and no type
could catch it either.

**The init now groups by the reading each fact comes from**, four required parameters and six
defaulted values: `Session(id:title:access:status:chain:work:spend:autonomy:annotations:transcript:)`.
The values group the *list* and are not what a Session stores — every fact still lands on its own
`let`, so no surface reads through one and the 39 construction sites gained a defaulted value each
rather than losing their ergonomics. Each field keeps the engine's own name for its fact, which is
what makes the check below a name comparison rather than a table.

**Edge 5 now proves the slot, and edge 6 counts an `init`'s parameters.** A fact handed straight
through must land on the slot of its own name, or the projection carries a
`renamed: <slot> <- <fact> — <why>` line. A derived argument is left alone: the name on an
expression is the projection's to choose. Grouping gave a fact **two** hands to cross — named into
the init, then unpacked out of a value in its body — so the edge reads both files, and there is one
marker in each: `location <- cwd` in the mapping, `workspaceLocation <- location` in the unpacking.
Edge 6 reads its ratchet off `.swiftlint.yml` beside the rule it extends, so one cap is stated in
one place; the number is 18 until `CockpitActions`' every-callback init is grouped the same way.

Both edges read Swift as text through one reader that drops comments **and string contents**. A
`//` inside a string ends no comment, and stripping one anyway unbalances the parens for the rest
of the file — a gate that passes everything and reports success, which is the failure mode
`docs/agents/quality-gates.md` exists for. `://` appears in roughly 19 Swift files here.

- **Totality and correctness are two checks, and only the second catches a swap.** Both facts stay
  accounted for when two slots trade places, which is exactly why the first one passes.
- **Six values are a parameter object, not a projection of `HubSession`.** They exist to shape one
  call. Making them stored would be the shrink this ADR declined, at 170 read sites.

## Amendment · A reader may cross the seam where a value would cost the frame (#858)

Edge 1 forbids ArgoUI from naming the Hub, and edge 5 makes the projection total. Both are about
what the cockpit HOLDS. `FeedAgentReader` holds neither a Hub nor a fact: it holds a `@MainActor`
closure the app target built over `Hub.subagentReading(of:)`, and the views call it while they draw.
It rides IN the projection — `CockpitPresentation.subagents`, off `Readings` — because a Subagent's
reading is a Hub fact, and the only thing that changed about it is when the cockpit asks. Edge 1's
grep is satisfied because ArgoUI never says `Hub`. That is a carve-out, and it is allowed under
exactly these conditions, so the next one is made deliberately rather than by finding the same
hole:

1. **The fact moves faster than the surfaces that do not draw it can afford.** A Subagent's file
   grows continuously and only one lane renders it; carried as a VALUE in the projection, every
   batch invalidated the scene root, and after #1005 it also moved `TranscriptStamp` and
   `SessionsRoomReadingCache.Stamp` — so the room's whole reading was retaken for rows that may not
   be on screen. A fact that changes when the roster changes has no case here: it goes in the
   projection as a value with the rest.
2. **The reader is a value with an identity, not a store.** It is `Equatable` on the source it
   asks, so a view holding one still compares; it exposes reads and never a mutation; and a
   fixture-backed one renders the same surfaces from a dictionary, so every specimen and preview
   stays reachable without an engine.
3. **The engine still owns the answer, and the app target still composes it.** ArgoUI names no
   engine type it did not already name, and the one call it reaches is `public` on `Hub` and
   readonly. It is built in `CockpitCoordinator+Presentation.swift`, beside the projection it rides
   in, and building it reads nothing — which is what keeps the scene body out of the dependency.
4. **What a memo keyed on the room's stamp derives from it must key on the reading too.** The
   stamp deliberately stops at the Session's own stream, so a scoped memo keyed on it alone would
   freeze a feed while the Agent it is scoped onto went on writing —
   `SessionsRoomReadingCache.Scoping` carries the Agent's own length for exactly that reason.
5. **It is named in this list.** One reader exists today. A second one that cannot point at a
   measured frame cost belongs in the projection as a value instead.

Edge 1 cannot check any of that — a closure has no imports to grep — so this paragraph is the
check, and a reviewer is the mechanism. That is weaker than the other five edges by design: the
alternative was a value that made the whole cockpit rebuild on a Subagent's bytes, and the honest
record of the trade is worth more than a gate that would have to understand SwiftUI to be right.
