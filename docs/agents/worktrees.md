# Worktree mechanics

Implementation work runs in a git worktree under `.claude/worktrees/`, never the shared main
checkout — multiple agent sessions run concurrently, and isolating each unit of work on its own
tree and branch keeps them from clobbering each other's files. A `PreToolUse` hook
(`scripts/worktree-guard.mjs`) enforces it, blocking agent `Edit`/`Write` to `apps/**` or
`packages/**` from outside a worktree; this file is the *how* it cites — naming, resuming an
interrupted worktree, recovering a deleted one. It applies to all implementation work, not just
`/implement` runs, and is self-contained so it stands alone when the hooks copy it into a
consumer project.

## Naming — one deterministic format

Both names for a unit of work are derived from the ticket number `<N>` and a kebab-case
`<slug>`. They are never improvised, so any session (or `/ship`, or the resume check below) can
reconstruct them from `<N>` alone:

| thing | format | example (ticket #30, "session screen") |
| --- | --- | --- |
| worktree directory | `ticket-<N>-<slug>` | `.claude/worktrees/ticket-30-session-screen` |
| branch | `argo/#<N>-<slug>` | `argo/#30-session-screen` |

The two share the same `<N>-<slug>` stem and differ only in prefix, because `EnterWorktree`'s
`name` param forbids `#` and `/`: the branch namespaces the stem as `argo/#<N>-<slug>`, the
directory uses a plain `ticket-<N>-<slug>`. Pick the `<slug>` once from the ticket title; keep it
identical across both. The `#<N>` in the branch is load-bearing: whatever opens the PR parses it
to write `Closes #<N>`, so a branch without it breaks the PR→ticket link.

For work with no ticket, keep the shape but drop the number: worktree `ticket-<slug>`, branch
`argo/<slug>`.

## Entering

Enter a worktree first, unprompted, on the ticket branch:

- **Claude Code:** `EnterWorktree` with `name: "ticket-<N>-<slug>"`. It creates the worktree on a
  new branch of the same name; rename that branch to `argo/#<N>-<slug>` so `/ship` can parse it
  (`git branch -m argo/#<N>-<slug>`).
- **Other harnesses:** `git worktree add -b argo/#<N>-<slug> .claude/worktrees/ticket-<N>-<slug>`.

## Resuming interrupted work — `/implement #<N>` is idempotent

Because the names are a pure function of `<N>`, re-running `/implement #<N>` must land in the
**same** worktree, not a second one. **Before creating anything**, check for existing work
anchored on the number:

```bash
git worktree list | grep "ticket-<N>-"                  # existing worktree (branch renamed or not)
git branch --list "argo/#<N>-*" "ticket-<N>-*"          # worktree gone, branch survives
```

Match on `<N>`, not the full slug — a slug typed slightly differently must not fork a second
tree. The branch check globs **both** prefixes on purpose: a worktree interrupted before the
`git branch -m` rename (see **Entering**) still sits on `ticket-<N>-<slug>`, so matching only
`argo/#<N>-*` would miss it. If a match exists, re-enter it (Claude Code: `EnterWorktree` with
`path:` to the existing directory; other harnesses: `cd` into it) and re-derive progress from
durable state — the ticket, `git log` / `status` / `diff`, and a test run — not from the previous
conversation. Only when no `#<N>` worktree or branch exists do you create a fresh one per
**Entering** above.

To make an interruption safe, commit WIP and push the ticket branch before stopping: an unpushed
worktree is the only copy of the work.

## Recovering a deleted worktree

If the worktree is gone but the branch was pushed, recreate it from the branch:

```bash
git worktree add .claude/worktrees/ticket-<N>-<slug> argo/#<N>-<slug>
```

If the branch was never pushed and the worktree is gone, the work is lost — which is why the
push-before-stopping step above is not optional.

## Sub-agents stay in the parent's worktree

A dispatched sub-agent **inherits its parent's worktree and stays there by default** — it must
not spin up its own (Claude Code: don't pass `isolation: "worktree"` to the `Agent` tool).
Nesting worktrees per sub-agent just proliferates them and splits state across trees — separate
checkouts, separate branches, and confusion over which one a dev server is serving. The parent's
worktree already provides the isolation from the shared main checkout. The **one** exception is
an explicit instruction from the parent to give a sub-agent its own worktree — a parent decision,
never something a sub-agent takes on its own.
