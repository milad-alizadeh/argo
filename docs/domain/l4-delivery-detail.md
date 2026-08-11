## L4 · Delivery detail

Lifecycle strip nodes: **commits · pr · ci · review · merge** (+ reserved **deploy · release**,
unwired). All sub-entities are DERIVED from local git ∪ code host — and code-host-sourced facts
**keep the host's vocabulary verbatim** (Check names, PR states, review verdicts are never
renamed or normalized).

- **Diff** — the change-set of a Delivery (branch vs base), **git-addressed by commit SHA**
  (ADR-0008: refs are SHAs, never fabricated; no commit → no stable ref).

- **Review** — a submitted review round against a Delivery: `verdict`
  (`approve | request-changes | comment`, host's terms), author, reviewed SHA. Source-tiered: a
  teammate's review via the code host (DERIVED) or Argo's code-review skill (CONVENTION). The
  skill is a *source* of a Review — **never call the entity "code review."**

- **Finding** — an individual resolvable issue within a Review: `severity: blocking | advisory`,
  `state: open → addressing → fixed`. "N unresolved" is a derived count.

- **Check** — one observed CI check on a Delivery: **name verbatim from the code host** +
  status, DERIVED, rolling into the `ci` node. **One level only — no Job/Step tree.** **Local
  lint/test is deliberately *not* modeled**: the cockpit observes git state (dirty/unpushed,
  DIRECT) but never runs or parses tooling — CI is the authoritative pass/fail. Before a
  push/PR there are simply no Checks ("no CI yet"), never a reimplemented local runner.

- **Outcome** — the durable, provenance-tiered record of **what a Session produced**;
  Session-keyed and **persisted** (ADR-0008), which is why it survives distinct from the
  live-derived, branch-keyed Delivery. The `produces` edge made concrete, pointing at a **typed
  target**, each addressed in *its own* space: **code** (a Diff/Delivery, git-addressed by SHA),
  **ticket** (a created Work Item, provider-id-addressed), or **artifact** (a plan/research
  file, path-addressed, possibly uncommitted). v1: **external sessions have no Outcome** — an
  honest gap, not a fabricated record.
