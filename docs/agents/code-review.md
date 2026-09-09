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
the review is work over bytes nobody will ship.

The measurements that set this rule came from the #1703 lane, on the push-time Swift gate that
#1758 deleted. They are kept because the shape is what matters, not the seconds: six minutes of
package suites run before the review, four two-axis rounds spanning 51 minutes from the first
verified commit to the last, and three full gates on one branch — each one paid because a review
fix had moved the tree out from under the previous one.

The gate is cheap now (biome, jscpd and the hook suites, all on the reviewed tree), but the order
stands and `implement` is where it is written: focused checks while building, **one** review,
every finding fixed in **one** batch, the final commit, then the full gate once on that committed
tree. `ship` runs the same two commands again before it opens the PR, because the tree may have
moved.

## The read-only brief

Every axis sub-agent prompt carries this, verbatim:

> You are read-only. Do not run a build, a full test suite, `bun run quality` or
> `bun run test`. Do not commit, push, or edit a file.
> Read the diff and the files around it — that is what a review is.
> You may run exactly ONE focused test, and only when you first state the uncertainty it will
> resolve and the command names the one file or package it runs. If you cannot name what the
> test would settle,
> do not run it: report the doubt as a finding instead.

Two things about the exception are load-bearing. It is **one** test, because a reviewer that runs
two has started verifying rather than reviewing. And it must **name what it runs** — a single
`scripts/<name>.test.mjs`, not `bun run test:hooks` — because an unfiltered run is the whole suite
by another name, and a filter that matched nothing can still exit 0 (#1358).

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
and the gate `implement` runs on its final tree is what makes the PR green before CI ever sees
it.
