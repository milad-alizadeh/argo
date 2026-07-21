---
name: ship
description: "Close out an implemented ticket: commit the reviewed work, push its branch, and open one PR that closes the ticket — carrying any unresolved review findings into the body. Run after the diff has been reviewed in a fresh context."
disable-model-invocation: true
---

# Ship

The end of an implement run: the diff is written and already reviewed in a fresh context.
This turns it into a PR. Do not run it before the review — and never merge; merging stays
with the human.

1. Confirm you are on the ticket branch, not the default branch
   (`git rev-parse --abbrev-ref HEAD` ≠ `git remote show origin` / the repo's default). If the
   work is on the default branch, stop and report it — it should have been built on a branch.
2. Commit the outstanding work to the branch with a message that states what changed and why.
3. Push the branch (`git push -u origin HEAD`).
4. Open exactly one PR with `gh pr create`. The body must contain `Closes #<N>` for the ticket
   the branch implements (derive `<N>` from the branch name or the ticket you built), and must
   list any review findings you could not resolve, each **with the reason** — never drop one
   silently. Open it ready-for-review when nothing is unresolved; use `--draft` only if
   unresolved findings remain.
5. Report the PR URL. Do not merge.
