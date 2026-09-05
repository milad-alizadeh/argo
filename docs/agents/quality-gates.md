# Quality gates — exemptions and the fail-open traps

Companion to `AGENTS.md` → *Quality gates*. That section carries the rule; this one carries where
an exemption goes, the forensics behind the two configs that **fail silently open**, and how to
prove a change to them.

## What runs where

`bun run quality` is biome, duplication and Swift. `quality:swift` (SwiftFormat in check mode,
SwiftLint, package boundaries) needs a Mac, so it runs **at push time, not on CI**:
`.husky/pre-push` calls `scripts/swift-gate.sh`, which runs `quality:swift`, the app build and the
swift-testing suites, in that order, under `ARGO_REQUIRE_SWIFT_TOOLS=1`. A failing check refuses
the push. It was a `macos-26` CI job until #1340, where it was measured at about 99% of this
repo's Actions bill for repeating, from a cold cache, what the author's Mac had already built.

Two things follow from where it now runs, and both are load-bearing:

- **It is scoped by `ci.yml`'s old pathspec**, kept character for character inside
  `swift-gate.sh`, so a markdown-only or docs-only push skips the Swift work exactly as the CI
  job did. `scripts/swift-gate.test.mjs` compares the two and fails if they drift.
- **`core.hooksPath` is absolute into the main checkout**, so a push from any worktree runs the
  main checkout's `.husky/pre-push`. The hook only gates anything once it is on `main`; the
  script it calls is resolved from the pushing tree, so the checks are always of the pushed code.
  Husky also exits 0 when the hook file is missing, which makes deleting it a silent pass —
  `swift-gate.test.mjs` is the case that catches that.

Run the gate by hand any time with `sh scripts/swift-gate.sh`, and skip it for a deliberate
work-in-progress push with `ARGO_SKIP_SWIFT_GATE=1 git push`.

## What the gate does before it does anything (#1377)

Three things happen ahead of the first command, and all three exist because eight lanes were
running this gate against each other. The arithmetic and the measurements are in
`docs/agents/landing.md`; what each one is, and how to turn it off:

1. **It asks whether this tree already passed.** `scripts/gate-cache.sh` keys a pass on the
   content of `apps/macOS` and `scripts`, on `package.json` and `turbo.json`, on the toolchain
   version, and on the package scope the run covered. A rebase that reproduces a gated tree
   costs a hash lookup. It refuses to answer at all over a DIRTY tree, because HEAD's hash then
   describes bytes that are not the ones on disk. `ARGO_GATE_CACHE=off` runs it regardless.
2. **It takes one of two machine-wide build slots.** `scripts/build-lock.sh`. Every command in
   the gate fans out to all cores, so unserialised lanes do not build in parallel, they build
   each other slowly. `ARGO_BUILD_LOCK_SLOTS` raises the count on a bigger machine.

   **The gate is not the only thing that takes one.** Every command that starts a Swift compiler
   queues for a slot now, so a bare `bun run build`, `bun run test`, `bun run warm`,
   `scripts/specimens.sh`, `scripts/screenshot.sh`, `scripts/record-figures.sh` or
   `scripts/e2e-test.sh` can sit and wait with nothing on its output — that is the cap working,
   not a hang, and it says so on stderr once a minute. Wiring only the push path left the
   commands a lane spends its day on uncapped: six lanes on a twelve-core Mac reached load
   average 137 with 65 concurrent `swift-frontend`, and not one lock directory on the disk.

   A slot is held for a process TREE. The holder exports `ARGO_BUILD_LOCK_HELD_BY`, naming the
   lock root and its pid, and a descendant queueing on that same root runs inside the slot
   already paid for. Naming the root is what keeps `land.sh` honest: it holds a slot in a
   landing pool of its own, and the gate it then runs still queues for a build slot like any
   lane.
3. **It works out which packages the change reaches.** `scripts/swift-scope.sh` reads the
   `.package(path:)` edges and answers ALL for anything it cannot place. Only the SUITES are
   scoped by it; the formatter, the linter, the boundary gate and the app build stay whole.

### The steps remember too

The gate is not the only thing that runs these commands. An agent finishing a ticket runs the
suites itself, and then `git push` fires the gate, which ran the same suites over the same bytes
again — and the second run is the one a person waits on. So the memory is per STEP as well as
per gate: whichever runs first records the verdict, and the other reads it.

- `swift-test.sh` keys each package's suite on the content of `apps/macOS`, the configuration
  and the toolchain. A **filtered** run is never cached in either direction: it proves less than
  a full one, and it is asked for precisely when somebody wants that suite run again.
- `build.sh` keys the app build the same way, and believes a recorded pass **only when the app
  is still on disk** — `worktree-gc --artifacts` deletes products, and a verdict is not a
  product. An `xcodebuild` that exits 0 having written no app is a failure, not a pass.

So the shape of a push after an agent has already run the suites is: the boundary gate and the
linters run, the build and the four suites do not, and the whole thing is under a minute.

### Measuring whether any of it worked

Every run appends a row to `~/Library/Caches/argo-gate/metrics.tsv` (`scripts/metrics.sh`), and
`bun run gate:report` turns the rows into the four numbers that matter: how often a run learned
nothing, what that saved, whether a full run is getting slower, and how long anything queued for
a build slot. It prints them against the baseline #1377 measured, so the claim stays checkable
rather than remembered. `ARGO_METRICS=off` writes nothing; nothing reads the file back, so it can
never change what the gate decides.

None of these can make the gate pass something it would otherwise fail. The cache records
only after every command has passed, the lock changes when work runs and never whether, and the
scope widens to ALL in every case where it cannot see the whole picture. Each of those claims
has a case in `scripts/gate-cache.test.mjs`, `scripts/build-lock.test.mjs` (with
`build-lock-entrypoints.test.mjs` for which callers take a slot and
`build-lock-inheritance.test.mjs` for how one passes down a process tree),
`scripts/step-cache.test.mjs` and `scripts/swift-scope.test.mjs`, and each of those suites is
written the same way round: what it proves is that a MISS still happens when one must.

Linux CI runs biome, duplication and `test:hooks` — the only executable suite there, and the
suite that gates the push-time gate. Pre-commit runs lint-staged: biome, then SwiftFormat,
SwiftLint and boundaries over staged Swift. The design-token gate is inside boundaries as edge 7
(#1088), so it runs in the push gate rather than on pre-commit alone — `check:design-tokens` is
the same scan by hand.

`test:hooks` is `scripts/run-suites.mjs`, and its suites are **the directory, not a list**: every
`scripts/*.test.mjs` runs, so a new suite is added by writing the file and nothing else. It runs
them in a pool rather than in sequence, which took it from 101s to 21s on a 12-core machine
(least-of-2, interleaved — almost none of the chain's time was work, it was suites waiting on
subprocesses one at a time). It is fail-closed three ways
— a non-zero exit, an empty directory, and a suite that exits 0 without printing the
`all N checks passed` line that `check-harness.mjs` ends on.

Nothing here is optimised by default: `bun run build` is Debug unless asked otherwise, and
`swift-test.sh` takes no configuration at all, so every suite runs `-Onone`. What each
configuration names, how to build the optimised app, and what that is worth:
`docs/agents/build-configurations.md`.

Running the suites optimised is how a seconds-side cost budget gets re-recorded against code the
optimiser has seen (ADR-0028). It is deliberately not in the push gate: the counts are the half a
debug build cannot get wrong, and they gate every push.

One optimised run has a workflow of its own — `figures.yml`, on `macos-26`, on manual dispatch,
running `apps/macOS/scripts/record-figures.sh` and uploading what it read. It re-records the seven
seconds-side FIGURES in `ArgoUITests/PerfBudgets` and nothing else; the eight CPU quotients
ADR-0028 names are gates, and they run in debug here on every push like every other count. **It is
not a gate itself**, for the reason `PerfBudgets.figureMachine` gives, and the only thing it checks
is the fold between its two arms — armed the day a quiet runner's figures land (#1024).

Biome's escape-hatch bans (`any`, `@ts-ignore`, `!`, nested ternaries) are TypeScript-only and
so have no subject since ADR-0023. Dormant, like the boundary gates — the per-file caps still
apply to every tracked `.mjs`.

## Why there is no `analyzer_rules:` in `.swiftlint.yml`

SwiftLint has a second command. `analyze` runs the rules that read the compiler's view of a file
rather than its text, and `lint` accepts the `analyzer_rules:` key and then ignores it — so
`unused_import` sat in that config from #393 to #1043 having never run on one file in one build.
Coverage in the config, nothing in the build, and green because nothing looked (#925, #1043).

`swift-lint.sh` now refuses the key while nothing in `package.json`, `scripts/` or
`.github/workflows/` runs `swiftlint analyze`, ahead of its tool guard so a machine without
SwiftLint still fails on it. The condition is what RUNS the rules, not the key, so wiring `analyze`
into a gate lifts the refusal with no second place to edit — and only an invocation lifts it, never
a mention in a comment, which is otherwise the likeliest line in the tree to hold the command.

Producing the compiler log it needs took three builds into fresh scratch paths, because this tree
has three producers: `swift build --build-tests -v` in each package, and `xcodebuild` for the app
target's own nine files. The run reported **495 violations**: 348 over the 1,122 source files of
the app target and both packages, 77 in `ArgoEngine`'s tests, 70 in `ArgoUI`'s. It is still not
wired, and these are the three reasons, each measured on that run:

1. **It needs a from-scratch build.** `analyze` reads a log of the swiftc invocations, and only a
   file the build actually COMPILED appears in one. Over restored build products `swift build -v`
   prints no invocations at all, and SwiftLint answers a log missing a file by not analysing it:
   `Found 0 violations, 0 serious in 0 files`, exit **0**. That is the `.jscpd.json` fail-open in
   another tool — the analysed file count is the only signal, and never the exit code. So the CI
   build cache is of no use to it and every run pays a cold build of both packages, their test
   targets and the app, before the analysis starts.
2. **`unused_import` is wrong often, and only a compiler says which time.** Acting on it in the
   two test targets and rebuilding, 3 of the 77 files in `ArgoEngine` and **38 of the 67 in
   `ArgoUI`** would no longer compile without the import it called unused — `Darwin` for
   `clock_gettime`, `CoreGraphics` for `CGFloat`, `Foundation` for `realpath` and `URL`, `Testing`
   for what `#expect` expands to. The rule does not see C interop, a macro's expansion, or a type
   reached through a re-export. A gate that is wrong needs suppressing, nothing here may be
   suppressed inline, and so its price is a standing exemption list for the tool's own bugs — a
   ratchet that cannot descend, because the code is not what is wrong.
3. **It is far slower than `lint`, on a whole extra macOS runner.** `lint` reads the whole tree in
   seconds; `analyze` runs for tens of minutes over one package's share of it. Beside a cold build
   that is the shape of cost `test:e2e` is kept off CI for, and it buys dead import lines.

What the run found in the two test targets is fixed rather than banked: 104 imports across 101
test files are gone, every removal proved by rebuilding both test targets. The 348 in
`Sources` are **not** swept here — at that false-positive rate the sweep is a compile-check per
file across a tree three other branches are editing, and it is a different piece of work from
stopping the config claiming a gate. To measure again — build each package with
`swift build --build-tests -v --scratch-path <fresh>` into a **fresh** scratch path, keep the
output, then `swiftlint analyze --compiler-log-path <log>` from `apps/macOS`. Believe the file
count it prints, not its exit code, and never pipe the run through `tail` — the report is one line
per violation and a truncated tail reads as a smaller count, which cost this ticket a whole second
pass. Compile-check every removal: an import can be load-bearing in a configuration the
package build never touched.

## Where an exemption goes

Exemptions live in **four** files, each entry labelled **KIND** (permanent — the rule doesn't
apply to that category) or **RATCHET** (debt; the list may only shrink):

| File | Covers |
|---|---|
| `biome.jsonc` `overrides` | every lint cap, the line ceiling included |
| `.jscpd.json` `ignore` | duplication — reasons in `scripts/jscpd-ignore-reasons.txt`, one per glob |
| `scripts/design-tokens-swift-allow.txt` | design constants outside `ArgoDesign` — one `grep -E` pattern per line with a comment line above it saying why. Both halves are gates: an entry with no reason is refused, and so is one that matches nothing any more |
| `.swiftlint.yml` | the Swift caps, ratchets inline — including the initializer cap that `swift-boundaries.sh` edge 6 reads from there and SwiftLint itself cannot check. That one's ratchet is a named list, not a number: `# INIT: <file> <count> — <why>`, one line per grandfathered init, and edge 6 fails a stale line as well as an unnamed init (#992) |

Two rules have no linter and live in `rules/house.md` prose only: a cast standing in for a
check, and the exhaustive construct over a closed set.

## Why the exemption reasons live in sidecars

**Biome silently checks zero files if `biome.json` holds a comment.** Hence `biome.jsonc` — the
overrides are annotated inline, and the `.jsonc` extension is what makes that legal.

**jscpd's auto-discovery silently skips the entire `.jscpd.json` if that file holds a comment**
(you get no threshold and a larger file count, with no error), and JSON is its only config
format. Hence the sidecar `scripts/jscpd-ignore-reasons.txt`, one reason per ignore glob.

## Why `--config .jscpd.json` is load-bearing

`quality:duplication` passes **`--config .jscpd.json` explicitly**. An explicitly-named config is
*parsed* rather than *discovered*, so a malformed one prints

```
config file .jscpd.json line 1: expected value
```

and exits non-zero, instead of quietly running unconfigured. **Dropping that flag restores the
fail-open.**

## Never prove either config by exit code

`jscpd … -t 0` exits **1 in both states** on this repo:

| State | Result |
|---|---|
| healthy | 1 clone in 211 files |
| silently unconfigured | 16 clones in 312 files |

The exit code cannot tell them apart — **the analysed file count is the only signal.**

Prove a config change by effect, one of:

1. Check the **analysed file count** still excludes the ignored paths.
2. Plant a throwaway clone pair inside an ignored path and another outside; confirm only the
   outside pair is reported.

