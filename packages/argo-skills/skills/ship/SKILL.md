---
name: ship
description: "Close out an implemented ticket: commit the work, rebase its branch onto the base, push, and open one PR that closes the ticket. Run after the diff has been reviewed."
disable-model-invocation: true
---

# Ship

A ship run ends in a PR URL, or in one of the three stops below. It never ends in a question:
anything you could not tick is written into the PR body, not handed back to the caller.

Merging stays with the human.

## The only three stops

- **You are on the default branch** (`git rev-parse --abbrev-ref HEAD`). The work should have
  been built on a branch. Say so and stop.
- **A PR is already open for this branch**
  (`gh pr list --head "$(git rev-parse --abbrev-ref HEAD)"`). Run everything below anyway — the
  push is what brings that PR onto a fresh base — then report its URL and open no second one.
- **The rebase conflicts** (below).

## Bring the branch onto its base

A branch that is hours behind opens a stale PR: CI runs against an old merge base, and the diff
carries other people's merged work.

1. **Commit everything outstanding** — a rebase refuses a dirty tree. Anything the steps below
   change is committed the same way, before the push.
2. **Resolve the base**, never assume it. An open PR states its own
   (`gh pr view --json baseRefName -q .baseRefName`). Otherwise it is the branch this one was cut
   from: the repo default (`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`),
   unless you stacked this branch on another ticket branch, which is then the base.
3. `git fetch origin` — the whole remote, so that step 2 of **Then ship** has a current
   remote-tracking ref to lease against — then `git rebase origin/<base>`.
4. **If it conflicts**, leave the rebase where it stopped, report
   `git diff --name-only --diff-filter=U`, and hand the caller to `resolving-merge-conflicts`.
   Resolving it is their step, not yours.

## Before the push

Nothing here is a reason to stop.

- **Gates.** Run them on the rebased tree, whatever they did before it. For UI work, look at the
  affected states; unit tests do not show you a screen.
- **Screenshots.** If the diff changes how a screen looks, the PR body carries one screenshot
  per changed state. Publish and embed them per `docs/agents/issue-tracker.md`, Screenshots.
- **Leftovers.** `git grep` the changed files for `.only`, debug prints, commented-out code and
  a TODO with no ticket number. The changed files carry none of them by the time you push.
- **Review findings.** Fix each in the diff, or carry it.

## Carry, never block

Each of these belongs in the PR body, and the ship continues past it.

- **No review ran.** Do not run one here — a review needs a fresh context, and running it is
  the caller's step. Say in the body that the diff is unreviewed.
- **A finding you did not fix**, each with the reason.
- **No ticket to close.** Derive `<N>` from the branch name or the ticket you built. If there
  genuinely is none, open the PR with no `Closes` line and say so in the body.

## Then ship

1. Commit what the steps above changed, with a message that states what changed and why.
2. Push with `git push -u --force-with-lease origin HEAD`. The rebase rewrote the commits, so
   the push is not a fast-forward; the lease is what makes overwriting the remote branch safe,
   where a bare `--force` would drop a teammate's push. A `stale info` rejection means the
   remote branch moved since the fetch in step 3 above: fetch again, rebase again, and push.
3. Open exactly one PR with `gh pr create --base <base>`, ready for review, its body carrying
   `Closes #<N>` and everything the section above told you to carry. Skip this step for a branch
   that already had a PR open — the push updated it.
4. Report the PR URL.
