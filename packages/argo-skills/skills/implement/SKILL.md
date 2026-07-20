---
name: implement
description: "Implement a ticket or spec the Argo way: worktree-isolated, TDD at agreed seams, code-review before the PR opens; UI regression is gated deterministically in CI. Argo's owned fork of mattpocock/skills' implement."
disable-model-invocation: true
---

# Implement

One ticket (or spec) per fresh context. This is Argo's owned fork of the upstream
`mattpocock/skills` implement — the same core flow, plus the stages Argo layers on top
(worktree isolation, CI-gated visual regression). The upstream skill is deliberately excluded
from `bundle.json` so this one owns the name.

## 0. Enter a worktree — non-negotiable

Implementation never runs in the shared main checkout. If your cwd is the repo root rather
than a path under `.claude/worktrees/`, enter a worktree first, unprompted (Claude Code: the
`EnterWorktree` tool; other harnesses: `git worktree add .claude/worktrees/<name>`), and work
on a ticket branch there (`argo/#<N>-<slug>`, or the repo's convention).

**Resuming interrupted work.** The worktree is the resume state — re-enter the *existing*
worktree (Claude Code: `EnterWorktree` with `path:`; never start a second worktree for the
same ticket) and re-derive progress from durable state: the ticket, `git log`/`status`/`diff`,
and a test run — not from the previous conversation. To make interruption safe, commit WIP
and push the ticket branch before stopping; an unpushed worktree is the only copy of the
work. If the worktree is gone, recreate it from the pushed branch:
`git worktree add .claude/worktrees/<name> <ticket-branch>`.

## 1. Implement

Read the ticket or spec. Use `/tdd` where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the
end. The full suite (typecheck, lint, tests, build) must be green before moving on.

## 2. Code-review — in a context that did not write the code

Run `/code-review` on the diff and address the findings. If a finding can't be resolved, carry
it into the PR body **with the reason** rather than skipping it silently.

**This only works if the review runs in a fresh context.** `/code-review` does its job by
spawning two parallel axis sub-agents; the value is that they have not seen your reasoning and
cannot inherit your blind spots. An author reviewing their own diff knows what the code *meant*
to do — which is precisely the knowledge that hides the defect.

So before running it, confirm you can actually spawn sub-agents (do you have the `Agent` tool?).
**If you cannot, stop and report that** — do not run the two axes yourself and call it reviewed.
A self-administered review that the PR body presents as a review is worse than no review: it
spends the human's trust without earning it. Notable case: agents spawned inside a `Workflow`
have no `Agent` tool, so `/implement` run that way can't spawn its own review — run `/implement`
directly (not nested inside a Workflow) so the review stage can fan out its sub-agents.

## 3. Visual regression — gated in CI

UI drift is caught by the CI screenshot gate (vitest `toMatchScreenshot` over every story; see
AGENTS.md "Visual verification"). Don't screenshot inline. Run `/visual-verify` by hand only for
visually *subjective* changes — a new layout, a state with no story — where judging pixels
against the spec adds something the pixel gate can't.

The same precondition binds: the judge must be a separate agent that takes **its own**
screenshots. A judge handed the author's screenshots inherits the author's framing — it can only
confirm that the captured states look as captured, not that the right states were captured.

## 4. Commit, push, PR

Commit to the ticket branch and push it. Open one PR — body says `Closes #<N>` and lists any
unresolved findings from steps 2–3. Open it ready-for-review (the diff was already reviewed);
use draft only if unresolved findings remain. Do not merge — merging stays with the human.
