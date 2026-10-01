# A Session owns its worktree

Status: accepted · 2026-10-01 · supersedes ADR-0010

## Context

Argo Desktop kept a Workspace registry: one record for each Project's main checkout and each
linked worktree, with its own id, kind and path. Sessions pointed at a Workspace. The registry
was a second copy of what git already lists, and it needed reconciling, a launch sweep and a
restore path when git and the records disagreed. ADR-0010 put this identity on each tree node.
In practice only a Session creates, keeps or removes a worktree, and a Subagent runs in its
Session's folder.

Claude Code already has a worktree rule that people who use both tools know:
<https://code.claude.com/docs/en/worktrees>, section "Clean up worktrees".

## Decision

There is no Workspace entity. A Session has a Project and `0..1` worktree: `path`, `branch` and
`owned`. A Session with no worktree runs in the Project's main checkout. Git is the only list of
a Project's checkouts.

- A new-Session draft names a new worktree, the main checkout, or an existing linked worktree.
  The Project remembers the last choice, and the default is a new worktree.
- A worktree Argo created for a Session is **owned**. No other draft is offered it.
- A linked worktree made outside Argo is **imported** (`owned = false`). Two Sessions may share
  it. Argo never removes an imported worktree or the main checkout.

Argo follows Claude Code's cleanup rule for an owned worktree when its Session is archived:

1. A clean worktree is removed, with its branch. Clean means no changed files and no commits that
   no other branch or remote holds.
2. A worktree that holds work opens a dialog that says what it holds and offers Keep, Remove and
   Cancel.
3. When Argo cannot read the worktree's state, it opens the same dialog and says what it could not
   check. It never removes without asking.
4. Nothing is removed while the Session has a Turn in progress.
5. When a Session's worktree folder is gone at open or resume, the Session continues in the main
   checkout, the person is told, and the worktree is cleared.

There is no launch sweep, no setting, no snapshot, no restore and no cap. Claude and Codex
Sessions follow the same rule.

A Preview still attaches at the tree node, as ADR-0010 set out.

## Consequences

- The migration drops the Workspace table and keeps each Session's folder: a Session that pointed
  at a linked Workspace keeps that path as its worktree, owned when Argo had created it.
- A worktree that a person keeps after archive stays on disk until they remove it.
- A resumed Session whose worktree is gone runs from the main checkout. A Harness that finds its
  history by folder may start that resume without the earlier context.
