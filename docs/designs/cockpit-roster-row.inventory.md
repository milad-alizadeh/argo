# The Sessions roster row — build inventory (#1346)

What assembling the trailing edge of line 3 forced out of
[`cockpit-roster-row.md`](cockpit-roster-row.md). The name was frozen at approval; renaming it is
a migration.

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

## What stayed inline

- **The branch-to-Delivery join** — `CockpitPresentation.Readings.delivery(ofBranch:)`, one
  lookup over the array `DeliveryLedger.deliveries(of:)` already reads. A component wrapping a
  single array lookup would be a second place for the "no Project read yet" rule to drift from
  the ledger's own.
- **The ink switch** (`ink(for:)` on `DeliveryAddresses`) — four `if`s over
  `isMerged` / `isDraft` / `state`, in the one view that draws them. Splitting it out would be a
  second file for a rule the contract (`DeliveryRoles`) already states in one place.

## Contract changes these needed

None. `delivery.open`, `delivery.merged`, `state.failure` and `state.idle` were promoted ahead of
this build by #1341; `machineCaption` and `text.tertiary` are pre-existing roles.

## What #1346 left for later tickets

- **Nothing populates `Readings.deliveries` in production yet.** `DeliveryLedger` and
  `DeliveryDerivation` exist and are tested, but no caller in the app target polls a code host and
  records into the ledger — that is #389's "Build the Code room and Delivery in Swift". Until it
  lands, every row draws its Ticket mark (where one is linked) and no pull request, which is the
  honest reading of an unread Project (`cockpit-roster-row.md`: "a row whose branch has no
  Delivery … draws no pull request — never a placeholder").
- **Rule 7** ("a ready claim with an open pull request never draws") has no `Ready` state to
  conflict with yet — that arrives with #1335/#1348.
