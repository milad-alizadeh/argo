# Quality gates — exemptions and the fail-open traps

Companion to `AGENTS.md` → *Quality gates*. That section carries the rule; this one carries where
an exemption goes, the forensics behind the two configs that **fail silently open**, and how to
prove a change to them.

## What runs where

`bun run quality` is biome, duplication and Swift. `quality:swift` (SwiftFormat in check mode,
SwiftLint, package boundaries) needs a macOS runner, so it sits on the `macos` CI job alongside
the build and the swift-testing suites. Linux CI runs biome, duplication and `test:hooks` — the
only executable suite there. Pre-commit runs lint-staged: biome, then SwiftFormat, SwiftLint,
boundaries and the design-token gate over staged Swift.

Nothing here is optimised by default: `bun run build` is Debug unless asked otherwise, and
`swift-test.sh` takes no configuration at all, so every suite runs `-Onone`. What each
configuration names, how to build the optimised app, and what that is worth:
`docs/agents/build-configurations.md`.

Running the suites optimised is how a seconds-side cost budget gets re-recorded against code the
optimiser has seen (ADR-0028). It is deliberately not on the `macos` job: the counts are the half a
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

Exemptions live in **three** files, each entry labelled **KIND** (permanent — the rule doesn't
apply to that category) or **RATCHET** (debt; the list may only shrink):

| File | Covers |
|---|---|
| `biome.jsonc` `overrides` | every lint cap, the line ceiling included |
| `.jscpd.json` `ignore` | duplication — reasons in `scripts/jscpd-ignore-reasons.txt`, one per glob |
| the module map's `placement` block | the folder rules — `allow`/`ratchet`/`exclude`, each value its own reason |
| `.swiftlint.yml` | the Swift caps, ratchets inline — including the initializer cap that `swift-boundaries.sh` edge 6 reads from there and SwiftLint itself cannot check. That one's ratchet is a named list, not a number: `# INIT: <file> <count> — <why>`, one line per grandfathered init, and edge 6 fails a stale line as well as an unnamed init (#992) |

The placement gates fail on a **stale** exemption too: an entry naming no file is deleted, not
left to re-authorise a future breach.

Two caps have no rule to enforce them and live in `rules/` prose only: `as` assertions, and
exhaustive `switch` over a union.

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

## Why placement is a pre-commit gate, not just CI

A misplaced file caught in CI becomes a follow-up ticket written after the session that produced
it has ended. Caught pre-commit, it is fixed by whoever still has the context.

The `PreToolUse(Write)` hook (`scripts/placement-guard.mjs`) pushes that one step earlier still —
it denies the file's creation before anything imports it. It shares its root-pattern derivation
with the gate, so the two cannot drift.

## Why ADR-0021 made every module declare an entry

The predecessor gate guarded **one hardcoded path**, so every module added after it was silently
exempt — and flattened. Requiring every module to declare what may sit loose at its root, and
FAILING a module with no entry, is what closes that.
