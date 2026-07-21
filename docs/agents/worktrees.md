# Worktree mechanics

Implementation work runs in a git worktree under `.claude/worktrees/`, never the shared main
checkout (see AGENTS.md "Session isolation" for *why* and the mechanical guardrail that enforces
it). This file is the *how* — branch naming, resuming an interrupted worktree, recovering a
deleted one. It applies to all implementation work, not just `/implement` runs.

## Entering

Enter a worktree first, unprompted — Claude Code: the `EnterWorktree` tool; other harnesses:
`git worktree add .claude/worktrees/<name>`. Work on a ticket branch there, named
`argo/#<N>-<slug>` (or the repo's own convention).

## Resuming interrupted work

The worktree *is* the resume state. Re-enter the **existing** worktree — Claude Code:
`EnterWorktree` with `path:`; other harnesses: `cd` into the existing `.claude/worktrees/<name>`
— never start a second worktree for the same ticket. Re-derive progress from durable state (the
ticket, `git log` / `status` / `diff`, and a test run), not from the previous conversation.

To make an interruption safe, commit WIP and push the ticket branch before stopping: an unpushed
worktree is the only copy of the work.

## Recovering a deleted worktree

If the worktree is gone but the branch was pushed, recreate it from the branch:

```bash
git worktree add .claude/worktrees/<name> <ticket-branch>
```

If the branch was never pushed and the worktree is gone, the work is lost — which is why the
push-before-stopping step above is not optional.
