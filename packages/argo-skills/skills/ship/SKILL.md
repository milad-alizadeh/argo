---
name: ship
description: "Close out an implemented ticket: commit the reviewed work, push its branch, and open one PR that closes the ticket — carrying any unresolved review findings into the body. Run after the diff has been reviewed in a fresh context."
disable-model-invocation: true
---

# Ship

The end of an implement run: the diff is written and already reviewed in a fresh context.
This turns it into a PR. Do not run it before the review — and never merge; merging stays
with the human.

## Definition of done

Done is not "the code works" — it's this checklist passing. Run it before step 1, and
report any line you cannot tick rather than shipping past it:

- Every acceptance criterion on the ticket is satisfied, checked against the ticket text
  rather than from memory of it.
- Tests cover the behavior that changed, and the whole suite passes — not just the new file.
- The repo's gates pass locally: types, lint, quality gates, boundaries, whatever the
  manifest defines.
- UI work has been verified visually against the spec, not only unit-tested.
- The diff has been reviewed in a fresh context, and each finding is fixed or carried into
  the PR body with its reason.
- No debug leftovers: stray logging, commented-out code, a `.only` on a test, a TODO with
  no ticket behind it.
- Anything a future reader can't infer from the diff is written down — an ADR for a
  decision, a rule update if the change moves a house standard.

1. Confirm you are on the ticket branch, not the default branch
   (`git rev-parse --abbrev-ref HEAD` ≠ `git remote show origin` / the repo's default). If the
   work is on the default branch, stop and report it — it should have been built on a branch.
2. Commit the outstanding work to the branch with a message that states what changed and why.
3. Push the branch (`git push -u origin HEAD`).
4. Open exactly one PR with `gh pr create`, ready-for-review — never `--draft`. The body must
   contain `Closes #<N>` for the ticket the branch implements (derive `<N>` from the branch name
   or the ticket you built), and must list any review findings you could not resolve, each
   **with the reason** — never drop one silently.
5. Report the PR URL. Do not merge.
