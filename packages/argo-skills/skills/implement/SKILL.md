---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

**One tree owns the expensive verification, and it is the reviewed one.** A gate is priced per
tree, and a review changes the tree — so a full suite, a full build or the project's gate run
before the review is work over bytes nobody will ship. The measurements that set this rule came
from a Swift gate that is now deleted (#1758), and the rule outlived it: run the gate once, on
the tree the review left behind. See `docs/agents/code-review.md`.

The order is the whole of this skill, and nothing runs out of it.

1. **Focused checks while you build.** Typecheck often, and run the single test files for the
   code you changed. Not the full suite, not a full build, not the project's gate.
2. **One review, once the implementation is complete.** `/code-review`, both axes in parallel,
   in a fresh context that never saw your reasoning. Paste this into every axis prompt,
   verbatim:

   > You are read-only. Do not run a build, a full test suite, `bun run quality` or
   > `bun run test`. Do not commit, push, or edit a file.
   > Read the diff and the files around it — that is what a review is.
   > You may run exactly ONE focused test, and only when you first state the uncertainty it will
   > resolve and the command names the one file or package it runs. If you cannot name what the
   > test would settle,
   > do not run it: report the doubt as a finding instead.

3. **Fix every finding in one batch.** One pass over all of them, not one pass each.
4. **Run a complete axis again only for a P0 or P1 fix that changes behaviour that axis covers**
   — that axis, not both. Anything else gets one focused review of the hunks you changed: a
   rename, a comment, formatting, a test moved. Four two-axis rounds is what put 51 minutes
   between #1703's first verified commit and its last.
5. **Commit your work to the current branch.** The final reviewed tree.
6. **Then the project's full gate, once, on that committed tree.** Every suite it has, every
   linter, every build — here and nowhere earlier. **All of them**: a gate that runs one
   language's suites leaves the rest of the diff proved by nothing, and this step is the only
   place the whole thing runs. In this repository that is two commands:

   ```
   bun run quality          # biome, typecheck, duplication
   bun run test:hooks       # every scripts/*.test.mjs
   ```

   Both are what CI runs, so a green pair here is a green pull request. Nothing else gates: there
   is no push-time hook and `apps/macOS` is verified by nothing (#1758).

The run ends at the reviewed diff, committed on its branch. It does not push and it does not open
a pull request — `/ship` does both, and `/ship` is a separate invocation the caller makes.

When `mcp__argo__report_ready` is available, call it after the review and commit. Give it a short
reason that states the number of changed files and commits. The report completes the implement run
and tells the Argo roster to draw `Ready`.
