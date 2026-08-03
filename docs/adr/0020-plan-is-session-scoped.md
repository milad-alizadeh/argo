# 0020 · The Plan is Session-scoped, and a Turn carries only a snapshot

Status: accepted · 2026-08-03

Supersedes the Turn-scoped `Plan` in CONTEXT.md L3 (`each Turn 0..1 Plan`).

## Context

CONTEXT.md defined **Plan** as "the agent-authored live to-do list **within a Turn**", and the
relationships line gave each Turn `0..1` Plan. The session-interior build (#268) rendered exactly
what that model implies: a plan tracker inside every turn card.

Two defects follow directly from it, and both were visible on the first real session:

- One continuing to-do list drew as **N separate trackers**, one per turn that happened to carry a
  plan update.
- The tracker **disappeared whenever its turn folded** — and past turns fold by default, so the
  plan was only readable while its own turn was open.

Checked against what the two CLIs actually emit:

- **ACP** delivers a plan as a session-level `session/update` notification, and the agent re-sends
  the **complete** entry list on every change. There is no per-turn plan object.
- **Claude Code's TodoWrite** writes a session list that survives the next prompt; the agent
  rewrites the whole list rather than appending to a turn's.

A Turn is *when a version of the plan was observed*, not what owns it. The model mistook the
observation point for ownership.

## Decision

**A Session holds `0..1` Plan** — one live list, replaced wholesale by the agent. **A Turn carries
`0..1` snapshot** of it: the version in force while that turn ran, which is all the transcript
record actually gives us.

The Session's current plan is the **newest snapshot observed**, tiered **DERIVED**: it is not
provably the newest that exists, only the newest Argo saw. Two consequences are load-bearing:

- A turn that reported no plan update **does not blank the plan**. Reading the open turn alone did
  exactly that — an agent that opens a turn without touching its plan still has the plan it had.
- One resolver serves every surface. The Activity pane's tracker and the Dock's now-head `N/M`
  read the same function, so the two can never report different progress.

Rendering follows the scope: the tracker sits **above** the Activity pane's two sections and
**outside the navigation** — a plan is not a list of places to jump to — and the turn card keeps
one channel, the calls it made.

## Consequences

- Turn-scoped plan history is **not** modelled. A plan's earlier versions exist in the record as
  snapshots, but nothing renders them; if a "what did the plan look like at turn 4" view is ever
  wanted, it reads the snapshots and needs no model change.
- The DERIVED tier is the honest cost: between a plan update and the next one, Argo shows the last
  version it saw. That is the same trade every transcript-observed fact makes, and it is why the
  plan is never presented as a measurement of the agent's current intent.
- `TimelineTurnModel` carries no `plan`, so a surface cannot accidentally re-introduce the
  per-turn tracker without going back through the derivation.
