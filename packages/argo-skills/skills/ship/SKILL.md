---
name: ship
description: "Close out an implemented ticket: commit the work, push its branch, and open one PR that closes the ticket. Run after the diff has been reviewed."
disable-model-invocation: true
---

# Ship

A ship run ends in a PR URL, or in one of the two blockers below. It never ends in a question:
anything you could not tick is written into the PR body, not handed back to the caller.

Merging stays with the human.

## The only two stops

- **You are on the default branch** (`git rev-parse --abbrev-ref HEAD`). The work should have
  been built on a branch. Say so and stop.
- **A PR is already open for this branch**
  (`gh pr list --head "$(git rev-parse --abbrev-ref HEAD)"`). Report its URL instead; pushing
  the branch updates it.

## Do these first

Nothing here is a reason to stop.

- **Gates.** If they have not run since your last edit, run them now. For UI work, look at the
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

1. Commit anything outstanding, with a message that states what changed and why.
2. Push the branch (`git push -u origin HEAD`).
3. Open exactly one PR with `gh pr create`, ready for review, its body carrying `Closes #<N>`
   and everything the section above told you to carry.
4. Report the PR URL.
