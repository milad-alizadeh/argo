# Code review — what a review agent may run, and when an axis runs twice

Companion to `AGENTS.md` → *Code review*. That section says where the review runs and why it
needs a fresh context; this one says what the reviewer may **execute**, and when a complete axis
is worth running a second time.

`code-review` itself is vendored from `mattpocock/skills` (`skills-lock.json`), so its two axis
prompts are not this repository's to edit. What is this repository's is the brief every caller
pastes into them, and it is below — `implement` step 2 carries the same words, and
`scripts/review-contract.test.mjs` holds the two copies against each other.

## One tree owns the expensive verification

A gate is priced per tree. A review changes the tree, so a suite, a build or a gate run **before**
the review is work over bytes nobody will ship — and the gate that matters, the one `ship` calls,
misses its cache and pays in full.

The #1703 lane is the measurement. Every figure below is that one branch:

| What | Cost |
|---|---|
| Full package suites run before the review | ~6 minutes of measured step time |
| Four two-axis review rounds, first verified commit to last | 51 minutes |
| `ship`'s gate, missing the cache because review fixes moved the tree | 3m11s |
| A conflict rebase's gate — a new tree, so honestly a new gate | 4m49s, on one unrelated timing failure |
| Two retries of that gate | 80s on the same timing test, then 1m41s on a different one |

Three full gates on one branch. The seven-day report read a 3-minute median, a 15-minute worst
case and a 37% cache hit rate.

So the order is fixed, and `implement` is where it is written: focused checks while building,
**one** review, every finding fixed in **one** batch, the final commit, then the full gate once on
that committed tree. `ship` calls the same gate and must find a whole-gate cache hit.

## The read-only brief

Every axis sub-agent prompt carries this, verbatim:

> You are read-only. Do not run a build, a full test suite, `bun run quality`,
> `bun run test`, or `sh scripts/swift-gate.sh`. Do not commit, push, or edit a file.
> Read the diff and the files around it — that is what a review is.
> You may run exactly ONE focused test, and only when you first state the uncertainty it will
> resolve and the command names its package, as
> `sh apps/macOS/scripts/swift-test.sh <Package> --filter <TypeName>`. If you cannot name what
> the test would settle, do not run it: report the doubt as a finding instead.

Two things about the exception are load-bearing. It is **one** test, because a reviewer that runs
two has started verifying rather than reviewing. And it must **name its package**, because
`swift-test.sh` refuses a filter without one — an unfiltered run is the whole suite by another
name, and `swift test --filter` exits 0 on a pattern that matched nothing (#1358).

A reviewer's doubt is a finding. It does not need a green test to be worth reporting, and the
author is the one holding the context to settle it cheaply.

## When a complete axis runs again

Once, by default. A second full round is for one case only:

- **A P0 or P1 fix that changes behaviour the axis covers.** Then that axis — not both — runs
  again over the fixed hunks.

Everything else gets **one focused review of the hunks that changed**: a rename, a comment, a
formatting fix, a test moved or renamed, a message reworded. None of those can falsify a finding
the axis already made, and four rounds of both axes is what turned #1703's review into 51
minutes.

A fix that is neither — a P2 the author took anyway, a suggestion applied — is reviewed by
nothing further. It goes in the batch and it goes in the commit.

## What the caller still owns

`ship` runs no review and refuses no unreviewed diff: it writes "unreviewed" in the PR body and
ships (`AGENTS.md`, **Code review**). So the review is `implement`'s step or it does not happen,
and the gate `implement` runs on its final tree is what makes `ship`'s gate a cache lookup rather
than a fourth full run.
