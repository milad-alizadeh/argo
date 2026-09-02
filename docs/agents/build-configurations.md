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
that silently built Debug would hand back a figure presented as optimised and never measured.

**The suites have no such switch.** `swift-test.sh` names no configuration, so `bun run test` is
`-Onone` and every budget in the cost suite is a debug figure. Running one optimised means going
around the script — `swift test -c release -Xswiftc -DDEBUG` in the package directory, where the
`-DDEBUG` is what lets the `#if DEBUG` counters the budgets read compile at all. #991 is the ticket
that gives the script an `ARGO_TEST_CONFIGURATION` of its own; `turbo.json` already lists that name
under the `test` task's `env` so the recipe reaches the task on the day it exists, because turbo
strips an undeclared variable and would otherwise run debug and say nothing.

Products land side by side under one derived-data path, `apps/macOS/build/Build/Products/{Debug,
Release}/`. Nothing downstream reads the Release one yet: `screenshot.sh`, `specimens.sh` and the
e2e harness all build and read Debug explicitly — the first two by path, `e2e-test.sh` by
`-configuration Debug` — and that is unchanged here. **A screenshot or a
specimen render is therefore still a debug render**, which is fine — it is pixels, not cost.

## What release costs to build

Roughly **1.6x the wall clock of a Debug build** from cold, and one statically-linked 35 MB image
where Debug links a small app beside the two package dylibs. That is the whole reason Debug stays
the default.

The raw seconds are on [#998](https://github.com/milad-alizadeh/argo/issues/998) rather than here,
with the machine and the load average beside them. They are one run on one loaded laptop and
nothing in the tree re-measures them, so a number kept here would go quietly stale while reading
as current — which is the same failure this whole area is about.

## What release is WORTH — the paths #963 measured

Every performance figure this repo holds — the whole #963 epic, its baselines and its
after-numbers — was taken on `-Onone`. The same seven paths were measured optimised once, so that
the epic's numbers have a shipped counterpart: the feed's measure pass over the 301-row reading, a
warm whole-session walk, a band painted cold and repainted warm, sixty scrolled frames, thirty
frames of a seam drag, and a band of nothing but long markdown.

**The answer is 1.1x to 1.4x on six of the seven, and 2.9x on the warm whole-session walk.** The
per-path milliseconds are on [#998](https://github.com/milad-alizadeh/argo/issues/998); the
recorded figures for the suite's own paths, in both configurations, are in `PerfBudgets` (#953,
PR #1018), which is where a figure that must stay true belongs — and which carries the harness
that re-records them. **Nothing in this tree re-measures the seven above**, so treat them as one
dated reading rather than as a property of the app.

So `-Onone` was *not* flattering the epic's numbers by an order of magnitude, and the fixes it
justified are not an artefact of the build — which is the question #998 was opened to answer.

The reason the multiplier is small is worth keeping: **these paths are mostly not Argo's code.** A
ruler measure is SwiftUI hosting plus Core Text, a band paint is Core Text, and framework code is
optimised in both configurations — `-Onone` inflates only Argo's own share of the pass. The one
path where release wins big is almost entirely Argo's own Swift: a walk of every row over warm
caches, exactly where retain/release traffic and bounds checks are the whole cost.

Which is also the shape of the warning. **A 1.2x average is not a licence to size a new budget in
debug.** The next hot path that is pure Swift will read 3x, and ADR-0028 Rule 3's ratios and Rule
7's counts are what survive either way.

### How to measure it again, and the trap in doing so

```sh
sh apps/macOS/scripts/record-figures.sh          # five interleaved rounds, both arms
```

That is the trap below already handled: it builds both configurations before it times either,
alternates the arms, takes the least of N per arm, and refuses a run in which any of the seven
figures it NAMES went missing from any arm — which is what an env-gated suite quietly not running
looks like. Underneath it is `swift test -c release -Xswiftc -DDEBUG` in the package directory,
timing thread CPU and never a wall clock (`CostMeasure`).

**Run it on a quiet machine, which is not this laptop.** `.github/workflows/figures.yml` runs it
on `macos-26` on manual dispatch and uploads what it read; #1024 is what tracks that run. It
records and uploads rather than committing or gating, and the reason — a hosted runner is a shared
box too, so only the FOLD between the two arms binds — is stated once, at
`PerfBudgets.figureMachine`, and amended into ADR-0028's Consequences.

The trap the harness exists to have solved: **interleave the two configurations** — debug,
release, debug, release — and take the LEAST of N rounds per arm. A machine stepping its clock or
picking up a neighbour drifts over a run, and running one arm to completion before the other lands
that drift on whichever arm was in flight.
The first attempt here ran three debug passes and then three release passes and read the measure
pass as *slower* optimised, purely because the load average had gone from 131 to 215 in between.
That is recorded because the mistake is easy and its answer does not look wrong.
