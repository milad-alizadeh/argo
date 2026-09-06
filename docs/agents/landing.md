# Landing, and why a lane does not rebase

Companion to `AGENTS.md` → *Quality gates* and *Session isolation*. It carries the arithmetic
behind `scripts/land.sh` and the two habits that arithmetic changes.

## The measurement (#1377)

Eight lanes in parallel spent most of their wall-clock in the push gate rather than in the work.
Two costs stacked, and both were measured on 2026-09-04 rather than guessed at.

**The machine was saturated.** Load average 178 on 12 cores. 87 `claude` processes and 25
concurrent `swift-frontend` and `xcodebuild` processes. Swap at 17.2 GB of 18.4 GB. Free disk at
9.1 GB of 926 GB, of which 104 GB was regenerable build output under `.claude/worktrees`:
80 GB of SPM `.build` and 24 GB of Xcode `build`. `sh scripts/swift-boundaries.sh` took 43 s of
wall-clock for 29 s of CPU — a third of its life waiting for a core.

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

**A lane does not rebase to open a PR.** It gates once, on the base it was cut from, pushes, and
opens the PR there. Being behind the base is the normal state of a branch, not a defect in it.
The exception is a PR GitHub reports as `CONFLICTING`, which is a decision only that branch's
session has the context to make. The full rule is in the `ship` skill.

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
