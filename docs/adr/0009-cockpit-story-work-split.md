# 0009 · Cockpit session screen: Story|Work split with a ship-ribbon lifecycle

Status: accepted · 2026-07-19

## Context

A five-lens UX audit of the v7 cockpit design found the screen's clutter was
structural, not cosmetic: no fact had an enforced owner (the review verdict
rendered on six surfaces, the branch on three), the GitHub lifecycle went dark
after "Create PR" (no PR number, Actions CI, human review, or merged/closed
state), workspace identity (branch, worktree-vs-shared-tree) had no pixels, and
the Actor/Run roster required by CONTEXT.md was never rendered at all.

## Decision

The session screen is split by **data nature**, not by widget:

- **Story pane** (time-keyed, prose only): now-line → Background Tasks roster
  (AgentRow / RunRow; a pipeline's members group under PhaseGroup headers with
  per-phase progress) → Outcomes → Timeline (steps timestamped). No tabs.
- **Work pane** (sha-keyed + its remote fate): a stateful **ship ribbon**
  (Commits → PR → CI → Review → Merge, artifact nodes whose done-state can go
  stale per sha) is the pane header and sole owner of ship-flow state; content
  tabs `Changes | Review · argo | Artifacts` below it. One primary control per
  screen, rendered in the ribbon head's drawer.
- **Console** (raw I/O): channel-based terminal strip — `session · live` plus
  captured tool/agent feeds; time-keyed raw output never nests in the story tree.

Every fact has exactly one home; other appearances are pointers. Workspace
identity is one header chip (branch names the worktree; shared-tree sessions
warn). The full contract — facts model, rules R1–R16, state table S0–S11, pane
anatomy — lives in `docs/designs/cockpit-matrix.md` and is written to become the
component unit tests.

## Consequences

- `/componentize-design` builds from `docs/designs/cockpit-inventory.md`;
  matrix rows become the test suite.
- `--status-landed` (Merged ≠ CI-green) is a proposed token to promote into
  `argo-tokens.css` at settle time.
- Open: whether the Checks summary rows stay in the story pane or fold entirely
  into the ribbon's Commits drawer.
