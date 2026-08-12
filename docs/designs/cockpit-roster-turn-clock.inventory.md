# The roster Turn clock — build inventory (#678)

What assembling the slot actually forced out of
[`cockpit-roster-turn-clock.md`](cockpit-roster-turn-clock.md). The name was frozen at approval;
renaming it is a migration.

## Extracted — #678

| name | tier | location | props | composed-of | source |
|---|---|---|---|---|---|
| `RosterTurnClock` | molecule | `ArgoUI/Shell/Sidebar/` — the row's own slot, one caller (`SessionRow`) | `clock: SessionRosterProjection.Clock` (`turn(startedAtMs:)` · `output(sinceMs:)` · `seen(String)`) | one `Text` on a 1s `TimelineView`, `ArgoTypography.rowMeta` + monospaced digits, `state.running` tint on the live case | frozen table, `RosterTurnClock`; [`roster-clock/roster.png`](roster-clock/roster.png) |
| `TurnClockPhrase` | value | `ArgoUI/Shell/Sidebar/` — two callers (`RosterTurnClock`, `SessionRosterProjection+Clock`) | `figure(seconds:)`, `spoken(seconds:)` | — | Measurements, formats |

Extraction evidence: `RosterTurnClock` is the design's frozen name and carries two states the
happy path never renders (the observed reading and the seen fallback). `TurnClockPhrase` had its
second caller before the first line was written — the drawn figure ticks in the view while the
spoken one is fixed at projection time, and one duration spelled twice drifts.

## What stayed inline

- **The three-way split** — `SessionRosterProjection.clock(for:nowMs:)`, one function in the
  projection. The view renders whichever reading it is handed and claims nothing; a component
  owning the split would be a second place for the honesty rule to go wrong.
- **The open Turn's start** — `openTurnStartMs(_:)` beside it: the FIRST prompt after the last
  boundary, so a steer cannot restart the clock. It is a scan over events the projection already
  holds, not a thing to draw.
- **The slot's geometry** — `SessionRow.secondaryLine` is untouched apart from swapping the
  `Text` for the component: same leading edge, same layout priority over the worktree label,
  same tertiary ink on the line.

## Contract changes these needed

None. Every value snaps to an existing token (`rowMeta`, `state.running`, `text.tertiary`);
monospaced digits is a `Text` modifier, not a role — exactly as the design recorded at approval.
