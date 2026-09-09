# Landing — the gate it was written around is gone

> **2026-09-09 (#1758).** This file was written when a rebase meant paying the push-time Swift gate
> again. That gate, `scripts/build-lock.sh`, `scripts/gate-cache.sh` and `bun run gate:report` are
> all deleted, so the arithmetic below is history and the tooling column of its tables names files
> that no longer exist.
>
> **Two things in it are still live and still matter.** `scripts/kept-the-tests.sh` and
> `scripts/undoes-the-base.sh` read a merged tree against the base and refuse one that drops a test
> the base has, deletes a file it has, or holds content the base has moved past. Run them by hand
> before merging: `sh scripts/kept-the-tests.sh . origin/main HEAD`. And two lanes never own the
> same file, whatever the vocabulary split says.
>
> **The rule that a lane does not rebase to open a PR is REVERSED as of 2026-09-09.** It was the
> last thing standing on this arithmetic, and the arithmetic is gone: with no push-time gate, a
> rebase costs a fetch and a replay. A lane now rebases onto the current base before it opens a PR
> and gates it there, because an out-of-date PR is reviewed against a tree nobody has and saves its
> conflicts for the human trying to merge it. See AGENTS.md → *Landing* and the `ship` skill.

# Landing, and the arithmetic a rebase used to cost

Companion to `AGENTS.md` → *Quality gates* and *Session isolation*. It carries the arithmetic
behind `scripts/land.sh` and the two habits that arithmetic changes.

## The measurement (#1377)

Eight lanes in parallel spent most of their wall-clock in the push gate rather than in the work.
Two costs stacked, and both were measured on 2026-09-04 rather than guessed at.

**The machine was saturated.** Load average 178 on 12 cores. 87 `claude` processes and 25
concurrent `swift-frontend` and `xcodebuild` processes. Swap at 17.2 GB of 18.4 GB. Free disk at
9.1 GB of 926 GB, of which 104 GB was regenerable build output under `.claude/worktrees`:
80 GB of SPM `.build` and 24 GB of Xcode `build`. The module-boundaries gate, since removed,
took 43 s of wall-clock for 29 s of CPU — a third of its life waiting for a core.

**The gate cost was lanes multiplied by merges.** The gate is keyed to the push, and `ship`
rebased onto `origin/main` before every push. `main` took 91 commits that day, 45 two days
before, 25 the day before that. Every merge therefore invalidated the base of every other lane,
and each rebase ran the whole gate again: `quality:swift`, a full `xcodebuild`, and four separate
from-scratch `swift test` package builds. A rebase also rewrites the mtime of every file it
replays, and llbuild invalidates on mtime, so the rerun was a COLD one even when no content had
changed.

## What changed

| the cost | what it is now |
| --- | --- |
| every lane builds at once | `scripts/build-lock.sh`: a machine-wide count of build slots, two by default, taken by every command that starts a Swift compiler and not only by the gate |
| every rebase re-gates | `scripts/gate-cache.sh`: a pass is keyed to tree content, scope and toolchain |
| every gate tests everything | `scripts/swift-scope.sh`: the suites run for the packages the diff can reach |
| every worktree its own caches | a shared SPM cache and module cache; the scratch path stays per tree |
| every lane rebases | `scripts/land.sh`: one serialized lane rebases, gates and merges |
| an agent runs the suites, then the push runs them again | per-step verdicts in `gate-cache.sh`, read by `swift-test.sh` and `build.sh` |
| 104 GB of build output | `sh scripts/worktree-gc.sh --artifacts` |

Lanes plus merges, rather than lanes times merges.

## The two habits

**A lane does not rebase to open a PR.** ~~`/ship` gates once, on the base the branch was cut
from, then pushes and opens the PR there.~~ **Reversed on 2026-09-09**, for the reason in the note
at the top of this file: `/ship` rebases onto the current base, gates the branch there, and opens
the PR on that. The lane itself still does neither the push nor the PR — `/ship` is a separate
invocation the human makes (AGENTS.md, **Pushing and pull requests**). The full rule is in the
`ship` skill.

**Two lanes never own the same file.** Lanes are split by domain vocabulary, which is right for
deciding what each lane is *for*, and useless for deciding what each lane may *touch*: the
vocabulary nearly all lives in `ArgoUI/Sources/ArgoUI/Shell/`, so two lanes split by term still
collide in `CockpitView.swift`. Split the ownership by file as well as by term. This is the only
one of these changes that removes conflicts rather than making them cheaper.

## Running the landing lane

```sh
sh scripts/land.sh 1361 1364      # these PRs, in this order
sh scripts/land.sh --all          # every open, non-draft, mergeable PR, oldest first
sh scripts/land.sh --all --dry-run
```

It takes a machine-wide lock of exactly one slot, works in `.claude/worktrees/landing` rather
than in any lane's tree or the shared checkout, and for each PR rebases onto the current default
branch, runs the gate, force-pushes with a lease, and squash-merges. Anything that does not go
cleanly is reported and left: a branch that conflicts, one that fails the gate on the new base,
one that moved while it was being landed. Nothing is merged that was not just gated green.

## What a green suite cannot tell you

A branch cut before a fix landed carries the pre-fix file. When its rebase resolves the conflict
by taking its own side whole, the fix goes and the test that guarded it goes with it — and every
suite is green afterwards, because the case that would have failed is no longer in one. #1543's
connection fix reached `main` and left it again this way inside four hours (#1558).

There is no content rule that separates that from an honest deletion: the rebase rewrites the
branch's commits, so afterwards the removal is authored by the branch either way. So the removal
declares itself. Between the rebase and the gate, `land.sh` asks two scripts what the merged
tree takes AWAY from the base, and anything they report leaves the branch for its lane unless one
of its own commits names it in a trailer.

| script | what it reads | trailer |
| --- | --- | --- |
| `kept-the-tests.sh` | a test name on the base that the merged tree does not have | `Removes-test: <name>` |
| `undoes-the-base.sh` | a file on the base the merged tree deletes | `Removes-file: <path>` |
| `undoes-the-base.sh` | a file whose content is a state the base has moved past | `Reverts-file: <path>` |

```
Removes-test: a tail running inside the connect window reads as connected
Reverts-file: *
```

One line, in the commit that does it. `*` in place of a path declares the whole change, which is
what a repair of a bad merge is; it stays in the log for ever.

Both run before the gate rather than after it, so a refusal costs a `git diff` instead of
fourteen minutes of Swift.

### What they do not read

Run them by hand with `sh scripts/kept-the-tests.sh . origin/main HEAD`, **from a tree already
rebased onto `origin/main`** — the comparison is tree against tree, so an un-rebased branch
reports everything `main` has gained since the cut.

- A test whose name survives while its assertions are weakened, and a name the tree holds twice.
- Any change that reaches `main` other than through `land.sh`.
- **The revert rule cannot fire on a clean rebase.** If the branch's diff for a file is empty
  the rebase leaves the base's own content; if it is not empty and touches what the base touched,
  the rebase conflicts and `land.sh` already refuses it. The shape it reads arrives by
  squash-merge from a stale base, or from a lane's own force-pushed conflict resolution. Against
  #1550 the deletion rule is what fires; the modified files it carried would need the check to
  run on the merge result, which is work this does not do.

They close the removal nobody noticed, not the one somebody meant.

## Knowing whether it worked

Every gate run and every step appends a row to `~/Library/Caches/argo-gate/metrics.tsv`, and
`bun run gate:report` reads them. The four questions it answers, and what a good answer is:

| question | the number | before #1377 | good |
| --- | --- | --- | --- |
| how often does a run learn nothing? | hit rate | 0%, every run was full | above 40% |
| how many full gates does one branch pay for? | full runs per branch | lanes × merges | 1 or 2 |
| is the machine being fought over? | load average while gating, seconds queued for a slot | 178 on 12 cores | under 24, and a queue in seconds |
| is there room to work? | free disk | 9 GB | above 50 GB |

The report prints those against the baseline column, so nobody has to remember what the numbers
were. A claim about throughput that cannot be re-measured stops being true quietly.

**What it does not do yet: batching.** It gates once per PR, which is the floor for a queue that
merges one at a time. A real merge queue rebases several branches together, gates the tip once
and merges the batch — fewer gate runs, at the cost of a `main` whose intermediate states nothing
tested. That is the next step, and it is deliberately not taken here.
