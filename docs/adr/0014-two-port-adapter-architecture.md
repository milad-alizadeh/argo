# 0014 · Two-port adapter architecture; native-first join

Status: accepted · 2026-07-22

## Context

Tickets and code come from different systems: Linear tickets + GitHub PRs is the
common real-world pairing, and a file-vault ticket source is planned. Hard-coding
GitHub for both would make every future source a rewrite. How a Delivery links to
its Work Item(s) also needed one deterministic rule. Details:
`docs/designs/cockpit-domain-model.md` § Two ports.

## Decision

Two separate ports, each adapter-based:

| Port | Owns | v1 adapter | Later |
|---|---|---|---|
| **Work Item provider** | tickets, hierarchy, `blockedBy`, status | GitHub Issues | Linear, Jira, file vault |
| **Code host** | branches, PRs, CI, closing-refs | GitHub | GitLab, local-git-only |

Join precedence: **native reference → id-in-branch/PR-name → unlinked (honest
gap, never guessed)**. Argo *emits* the canonical signal itself on `/implement`
(id in the branch name, `closes #n` in the PR body), then reads it back natively.
Each work-item adapter declares its id format + branch pattern; each code-host
adapter exposes native closing-refs if it has them; a small linker joins.

## Why

- The id-in-branch convention is the established industry mechanism (Linear
  `ARG-42`, Jira `PROJ-42`, GitHub `closes #n`) — adopting it, not inventing one.
- Because Argo authors the signal the standard way, the v1 GitHub↔GitHub path is
  pure native reads (DIRECT), with the convention layer dormant until the ports
  diverge.
- Adding GitLab = one code-host adapter; adding Linear = one work-item adapter.
  Nothing else changes.

## Consequences

- A provider without dependency data degrades the "what's next" judgement to
  priority+state, and says so.
- No code host → the Delivery lifecycle honestly ends at Commit.
- The file-vault adapter (deferred) relies on branch-name join + a `delivery:`
  line written back to the ticket file.
