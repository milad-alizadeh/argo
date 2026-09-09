# Landing — what a branch takes away from the base

Companion to `AGENTS.md` → *Landing*. One rule, and the failure that bought it: **a branch that
removes something the base has says so in a commit trailer.**

The scripts that enforced it are gone. `kept-the-tests.sh` and `undoes-the-base.sh` read a merged
tree against the base and refused an untrailered removal; `land.sh` ran them between the rebase
and the gate. Nothing does that now, so **the reviewer is the check**, and a removal reaches
`main` unnoticed unless someone looks for one.

## What a green suite cannot tell you

A branch cut before a fix landed carries the pre-fix file. When its rebase resolves the conflict
by taking its own side whole, the fix goes and the test that guarded it goes with it — and every
suite is green afterwards, because the case that would have failed is no longer in one. #1543's
connection fix reached `main` and left it again this way inside four hours (#1558).

There is no content rule that separates that from an honest deletion. The rebase rewrites the
branch's commits, so afterwards the removal is authored by the branch either way. That is why the
removal has to declare itself rather than be detected.

| what the branch takes away | trailer |
| --- | --- |
| a test name the base has | `Removes-test: <name>` |
| a file the base has | `Removes-file: <path>` |
| content the base has moved past | `Reverts-file: <path>`, or `*` for the whole change |

```
Removes-test: a tail running inside the connect window reads as connected
Reverts-file: *
```

One line, in the commit that does it, and it stays in the log for ever. `*` is what a repair of a
bad merge declares.

## What a trailer cannot cover

Both of these are why the trailer is a floor rather than a guarantee:

- **A test whose name survives while its assertions are weakened.** Nothing reads assertions, and
  a renamed-and-gutted test is indistinguishable from a kept one at the level a name check works.
- **A squash merge from a stale base.** The shape arrives whole rather than as a diff anyone
  reviewed against the current tree, so the removal is inside a commit whose message describes
  something else.

They close the removal nobody noticed, not the one somebody meant.
