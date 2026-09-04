# The Sessions roster row — build inventory (#1344, #1346)

What each ticket's build actually extracted from
[`cockpit-roster-row.md`](cockpit-roster-row.md). Names are frozen at approval; renaming one is
a migration. Later tickets against the same design append their rows here rather than starting
a second inventory.

## Extracted — #1344

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `SubagentDots` | molecule | `ArgoUI/Shell/Sidebar/` — one caller (`SessionMarker`) | `reading: SessionRosterProjection.SubagentReading` (`.none` · `.running(Int)` · `.landed` · `.unresolved`) | `Circle` dots at `ArgoIconSize.subagentDot`, a `Capsule` dash, a `Circle` outline pip, and the `+n` overflow label in `machineCaption` | frozen table, `SubagentDots`; [`roster-row/running.png`](roster-row/running.png), [`roster-row/ceiling.png`](roster-row/ceiling.png) |
| `SessionRosterProjection.SubagentReading` | value | `ArgoUI/Shell/Sidebar/SessionRosterProjection+Subagents.swift` | four cases, one per fact the column can draw | reads `FeedAgents.all(in:of:)` / `FeedAgents.running(of:)` off `FeedProjection.rows(from:)` — the same reading the Agents rail takes, so the two counts cannot disagree (#1269) | `SessionRosterProjection+Subagents.swift`, `SessionRosterProjectionSubagentsTests.swift` |

Extraction evidence: `SubagentDots` draws four distinct readings plus a ceiling the happy path
(one running Session) never exercises, and it is the design's own frozen name. The reading itself
stayed a value on the projection rather than living inside the view — `SessionMarker` already
reads `row.state` the same way, and a component computing its own delegation state would be a
second place the honesty rule (`SessionState.role` returning `nil`) could go wrong.

### What stayed inline

- **The ceiling arithmetic** (`SubagentDots.drawnDots(for:)`, `.overflow(for:)`) — two `static`
  functions on the view itself, not a value type: the number 5 has no other caller and no other
  reading to disagree with.
- **The fold's own reading** (`SessionRosterProjection.foldedSubagents(of:)`) — a fold pools the
  RUNNING count across every Session it hides and draws none of the other three readings (rule
  9), so it is a different function, not a mode of the same one.
- **The overflow label's overflow** — `Text("+\(overflow)")` needed `.fixedSize()` ahead of the
  6pt `.frame(width:)`: the frame is a LAYOUT proposal, and without `fixedSize` first, `Text` took
  it as a wrap width and truncated `+7` to `+`. Caught by the specimen render, not by a projection
  test, which is exactly the split `pixel-review` exists for.

### Contract changes these needed

Two, both promoted at their first and only caller:

- `ArgoIconSize.subagentDot = 4` — half of `statusDot`, beside it in `ArgoIconSize.swift`.
- `ArgoSpacing.subagentGap = 3` — off the rhythm ladder, in `ArgoSpacing.swift`, for the reason
  the design gives: the stack has to read as one column, not as a list of separately-spaced dots.

The dash and the outline pip snap to existing tokens (`ArgoStroke.border`, `ArgoStroke.hairline`)
rather than promoting new ones.

### A known gap against rule 1

`SubagentReading` reads `FeedAgents.all(in:of:)` off the Session's own record — three of the
rail's four facts, matching `FeedAgentReader.agents(in:)` before its `told(_:)` step. It never
calls `told`, because that step answers off a Subagent's own file growing
(`Hub.subagentGrewAtMs`), and that reading exists only for whichever Session the deck currently
has open, never for every row on the roster at once. A row that is not open can therefore lag
the rail by exactly the gap #1269 closed: an open delegation past `DelegationCeiling` whose
child is still visibly writing reads `.unresolved` on the roster and `.running` on the rail,
until the row is opened and the fourth fact reaches it too. Flagged rather than fixed here:
wiring live per-child file-growth into every roster row is a larger change than this ticket's
scope, and the issue's own acceptance criteria are written against `FeedAgents.running(of:)`
alone.

## Extracted — #1346

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `DeliveryAddresses` | molecule | `ArgoUI/Shell/Sidebar/` — one caller (`SessionRow`) | `ticketNumber: Int?`, `pullRequest: DeliveryPullRequest?` | `ArgoGlyph(.ticketsRoom)` + `Text`, two custom `Shape`s (`OpenPullRequestMark`, `MergedPullRequestMark`) + `Text` | frozen table, `DeliveryAddresses`; `roster-row/{running,merged,spent,unknown}.png` |

Extraction evidence: `DeliveryAddresses` is the design's frozen name, and it is a known
cross-screen unit already exercised by the two states the happy path (`running`) never renders —
merged and closed/draft.

The pull request's own mark has no SF Symbol: `checklist` is already spent on the Ticket, and
nothing on `ArgoSymbol`'s ladder is a fork-and-merge shape. Two private `Shape`s draw it, the way
`PlanRing` draws the plan's arc rather than reaching for a symbol that does not exist.

### What stayed inline

- **The branch-to-Delivery join** — `CockpitPresentation.Readings.pullRequest(forBranch:)`, one
  lookup over the array `DeliveryLedger.deliveries(of:)` already reads. A component wrapping a
  single array lookup would be a second place for the "no Project read yet" rule to drift from
  the ledger's own.
- **The ink switch** (`DeliveryPullRequest.ink(in:)`) — four `if`s over
  `isMerged` / `isDraft` / `state`, beside the type it reads rather than inside the view that
  draws it (`ArgoOperationalState.tint(in:)` is the same split for a Session's own state).
  Splitting it into a second file would be a second place for a rule the contract
  (`DeliveryRoles`) already states in one.

### Contract changes these needed

None. `delivery.open`, `delivery.merged`, `state.failure` and `state.idle` were promoted ahead of
this build by #1341; `machineCaption` and `text.tertiary` are pre-existing roles.

### What #1346 left for later tickets

- **Nothing populates `Readings.deliveries` in production yet.** `DeliveryLedger` and
  `DeliveryDerivation` exist and are tested, but no caller in the app target polls a code host and
  records into the ledger — that is #389's "Build the Code room and Delivery in Swift". Until it
  lands, every row draws its Ticket mark (where one is linked) and no pull request, which is the
  honest reading of an unread Project (`cockpit-roster-row.md`: "a row whose branch has no
  Delivery … draws no pull request — never a placeholder").
- **Rule 7** ("a ready claim with an open pull request never draws") has no `Ready` state to
  conflict with yet — that arrives with #1335/#1348.
