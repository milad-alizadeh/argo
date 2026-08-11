---
name: ship
description: "Close out an implemented ticket: commit the work, push its branch, and open one PR that closes the ticket. Run after the diff has been reviewed."
disable-model-invocation: true
---

# Ship

Never merge — that stays with the human.

## Before you start

Report any line you cannot tick rather than shipping past it.

- You are on the ticket branch, not the default branch (`git rev-parse --abbrev-ref HEAD`). If
  the work is on the default branch, stop and say so — it should have been built on a branch.
- No PR is open for this branch already
  (`gh pr list --head "$(git rev-parse --abbrev-ref HEAD)"`).
- The changed files carry no `.only`, no debug prints, no commented-out code, and no TODO
  without a ticket number. `git grep` them.
- **If a review ran**, every finding is either fixed in the diff or goes in the PR body at
  step 3. If none ran, say so and stop — do not run one here.
- **If the gates have not run since your last edit**, run them now. For UI work, look at the
  affected states; unit tests do not show you a screen.

1. Commit anything outstanding, with a message that states what changed and why.
2. Push the branch (`git push -u origin HEAD`).
3. Open exactly one PR with `gh pr create`, ready-for-review — never `--draft`. The body must
   contain `Closes #<N>` for the ticket the branch implements (derive `<N>` from the branch name
   or the ticket you built), and must list any review finding you could not resolve, each
   **with the reason** — never drop one silently.
4. Report the PR URL. Do not merge.
