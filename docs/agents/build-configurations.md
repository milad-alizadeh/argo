# Build configurations — what each one names, and what release costs

Companion to `AGENTS.md` → *Quality gates* and to
[ADR-0028](../adr/0028-cost-is-a-gate.md). It answers one question that had no answer for the
first year of this app's life: **what is Argo built with?**

## The two configurations

| | `SWIFT_OPTIMIZATION_LEVEL` | `SWIFT_COMPILATION_MODE` | who asks for it |
|---|---|---|---|
| Debug | `-Onone` | incremental (default) | `bun run build`, `screenshot.sh`, `specimens.sh`, `e2e-test.sh` |
| Release | `-O` | `wholemodule` | `ARGO_BUILD_CONFIGURATION=release bun run build` |

Both are named **once**, in the project-level block of `apps/macOS/Argo.xcodeproj/project.pbxproj`.
The two target-level blocks name neither and inherit both, which is why adding a target cannot
silently give it a different optimisation level.

Release's `-O` is the line this document exists for. Until #998 **no configuration in the project
named an optimisation level except Debug's `-Onone`**, and `build.sh` built Debug — so nothing in
the tree asked for `-O` and nothing anyone ran was optimised. An unnamed level is not a decision;
it is Xcode's template default surviving unread, and it read as an oversight for exactly as long
as nobody looked.

`GCC_OPTIMIZATION_LEVEL` is deliberately left unnamed in Release, where Debug names `0`. The app
target compiles no C, C++ or Objective-C of its own, so the setting has no subject — and a setting
with no subject is one more line for the next reader to check against reality.

## Building release

```sh
ARGO_BUILD_CONFIGURATION=release sh apps/macOS/scripts/build.sh   # or: bun run build
```

`turbo.json` lists the variable under the `build` task's **`env`** rather than under
`globalPassThroughEnv`, so it is part of the task's cache key as well as reaching the script: a
variable that only passes through would let a cached Debug build answer a Release ask, which is the
same silent lie as building the wrong configuration in the first place.

Anything other than `debug` (the default) or `release` is **refused rather than guessed**: a typo
that silently built Debug would hand back a figure presented as optimised and never measured. The
shape and the reason are `ARGO_TEST_CONFIGURATION`'s on `swift-test.sh` (#991), which does the same
for the swift-testing suites — and covers the **test bundles only**, never the app.

Products land side by side under one derived-data path, `apps/macOS/build/Build/Products/{Debug,
Release}/`. Nothing downstream reads the Release one yet: `screenshot.sh`, `specimens.sh` and the
e2e harness all name `Products/Debug` explicitly, and that is unchanged here. **A screenshot or a
specimen render is therefore still a debug render**, which is fine — it is pixels, not cost.

## What release costs to build

Recorded on this machine, cold in both configurations (`rm -rf apps/macOS/build` first),
`/usr/bin/time -p`:

| configuration | wall | app binary |
|---|---|---|
| Debug | 104.2 s | 57.6 KB + the two package dylibs |
| Release | 162.7 s | 34.9 MB, one statically-linked image |

**Machine:** Apple M4 Pro, 12 cores, 48 GB, macOS 26.5.1 (25F80), Swift 6.3.3.
**The machine was heavily loaded** — several other agents were building throughout, load average
38 rising to 233 across the two runs. Both numbers are pessimistic and their ratio is indicative
only; a wall clock on a shared box measures the box (#918), which is why every figure that gates
anything in this repo is a count or a ratio instead.

Read the 1.6x as "release costs noticeably more to build and is not the default for that reason",
and not as a measured multiplier.

## What release is WORTH — the figures for the paths #963 measured

Every performance figure this repo holds — the whole #963 epic, its baselines and its
after-numbers — was taken on `-Onone`. This is the first measurement of the same paths optimised,
and it exists so the epic's numbers have a shipped counterpart.

The seven paths are the ones `MinimapCostTests` documents in its own header, measured through the
same fixtures: the feed's measure pass over the 301-row reading, a warm whole-session walk, a band
painted cold and repainted warm, sixty scrolled frames, thirty frames of a seam drag, and a band of
nothing but long markdown.

**Method.** `ARGO_TEST_CONFIGURATION`'s flags (`-c release -Xswiftc -DDEBUG`, #991) against the
same tree, one temporary suite printing the CPU each path spent — thread CPU, never wall clock
(`CostMeasure`). The two configurations were run **interleaved**, debug then release, five rounds,
and each column below is the LEAST of the five: a machine stepping its clock or picking up a
neighbour drifts over a run, and one arm after the other lands that drift on whichever arm was in
flight. Interleaved, it is in both minima. A first attempt that ran the three debug passes and then
the three release passes read the measure pass as SLOWER optimised, purely because the load average
had gone from 131 to 215 in between — recorded here because that mistake is easy and its answer
does not look wrong.

| path | debug | release | debug ÷ release |
|---|---|---|---|
| feed measure pass, 301 rows | 148.7 ms | 127.2 ms | **1.17** |
| whole-session walk, warm | 1.29 ms | 0.44 ms | **2.93** |
| one band painted, cold | 4.16 ms | 3.13 ms | 1.33 |
| the same band repainted | 1.55 ms | 1.14 ms | 1.36 |
| sixty scrolled frames | 104.0 ms | 75.4 ms | 1.38 |
| thirty seam-drag frames | 74.9 ms | 63.4 ms | 1.18 |
| markdown band, cold | 4.58 ms | 4.08 ms | 1.12 |

**Machine:** Apple M4 Pro, 12 cores, 48 GB, macOS 26.5.1, Swift 6.3.3, **loaded** — several other
agents building throughout, load average 175–219 on 12 cores. A loaded box inflates both arms, so
read the ratios and not the milliseconds; the absolutes are upper bounds on this machine and the
quiet-machine figures will be lower.

### What the ratios say

**Between 1.1x and 1.4x on six of the seven, and 2.9x on the seventh.** So `-Onone` was *not*
flattering the epic's numbers by an order of magnitude, and the fixes it justified are not an
artefact of the build — which is the question #998 was opened to answer.

The reason the multiplier is small is worth keeping: **these paths are mostly not Argo's code.** A
ruler measure is SwiftUI hosting plus Core Text, a band paint is Core Text, and framework code is
already optimised in both configurations — `-Onone` inflates only Argo's own share of the pass. The
one path where release wins big, the warm whole-session walk, is the one that is almost entirely
Argo's own Swift: a walk of every row over warm caches, exactly where retain/release traffic and
bounds checks are the whole cost.

Which is also the shape of the warning. **A 1.2x average is not a licence to size a new budget in
debug.** The next hot path that is pure Swift will read 3x, and ADR-0028 Rule 3's ratios and Rule
7's counts are what survive either way. The recorded figures for the suite itself, in both
configurations, live in the suite's own `PerfBudgets` (#953).
