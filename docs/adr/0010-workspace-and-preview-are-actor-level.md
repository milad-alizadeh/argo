# 0010 · Workspace identity belongs to the Actor, not the Session

Status: accepted; terminology superseded (#182) · 2026-07-20

> **Terminology superseded by the #182 rebuild** (see `CONTEXT.md` → L3). The *substance*
> stands — workspace identity + Preview attach at the recursive tree node, not the Session,
> because a worktree-isolated child gets its own branch/dir. But the node is now **`Agent`**
> (recursive; root-vs-child by `parentId`), **not `Actor`** (dropped: zero prior art), and the
> rejected `SessionView.kind = session | agent` union is replaced by `parentId` — a Session is
> the **root Agent**, a child is a **Subagent**. Read every "Actor" below as "Agent (tree
> node)".



## Context

ADR-0009 and the retired `cockpit-inventory.md` (git history) make workspace identity a fact
about a **Session** — the `WorkspaceIdentity` chip is "the ONE full home of where
is this session working", and the rail's top tier is Sessions.

That assumption no longer holds. Claude Code's `isolation: "worktree"` gives a
subagent its own branch and directory, and the harness records the path per agent
(`worktreePath` in each agent's metadata file — DIRECT tier, no inference). A
single fanout observed while designing this produced three Agents inside one
Session, each with its own worktree, branch, commits and pull request.

Under the Session-scoped model that run renders as one row on `main`, and the
three worktrees are invisible to the cockpit — so the case the cockpit most needs
to show is the one it cannot represent.

## Decision

**Workspace, Preview and the ship ribbon attach to any Actor.** `CONTEXT.md`
already defines Actor as the recursive node of the observability tree; this lets
the UI agree with the model rather than contradict it.

- One screen component takes an **`ActorView`**: a shared core plus a `kind`
  discriminated union (`session` | `agent`), so Session-only facts (CLI,
  resume-chain) keep their type guarantees while everything universal lives in
  the core.
- Sections render on **data presence**, never on an `isSubAgent` flag. An Actor
  with no Outcomes renders none — the same rule a Session with no Outcomes
  already follows. Read-only re-uses the existing managed/external distinction:
  a workflow Agent is unsteerable for the same reason an external Session is.
- Routes are `/sessions/{sessionId}` and `/sessions/{sessionId}/actors/{actorId}`
  — flat, not nested per level, because `spawnDepth` can exceed 1 and a path that
  encodes the chain grows unbounded.
- An Actor without a Workspace of its own inherits its parent's; it does not
  render a second branch chip.

Rejected: keeping identity Session-scoped and treating agent worktrees as
internal. It is simpler, and it permanently excludes watching a fanout — the
motivating scenario.

## Consequences

- `SessionView` in `apps/desktop/src/shared/projection.ts` becomes `ActorView`.
  It is still a four-field skeleton, so this is the cheapest moment to make the
  change; after Seam B enriches it, it would be a re-cut.
- The inventory's `WorkspaceIdentity` row changes owner from Session to Actor,
  and the rail gains an expanded tier for an Actor's children.
- The rail's two-tier taxonomy needs an answer for an Agent with no Workspace —
  it renders nothing and inherits, rather than showing an empty chip.
