---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.

When `mcp__argo__report_ready` is available, call it after the review and commit. Give it a short
reason that states the number of changed files and commits. The report completes the implement run
and tells the Argo roster to draw `Ready`.
