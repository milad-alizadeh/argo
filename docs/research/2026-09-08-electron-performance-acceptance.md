# What "good enough" is measured as, before Electron may retire the Swift app

**Date:** 2026-09-08 · **For:** [Define Electron performance and battery acceptance](https://github.com/milad-alizadeh/argo/issues/1736),
under the migration map [cross-platform Electron desktop migration](https://github.com/milad-alizadeh/argo/issues/1730),
sole open blocker on [Define staged cutover and macOS retirement acceptance](https://github.com/milad-alizadeh/argo/issues/1737) ·
**Status:** decision, with the Electron half of the instrument proved locally and the Swift baseline **not yet re-recorded**

## The answer

One reference Mac, seven named workflows, and **an absolute gate rather than parity with the Swift
app** — because the Swift app's own measured idle band is currently a defect under repair
([#1538](https://github.com/milad-alizadeh/argo/issues/1538)), and parity with a defect is a
licence, not an acceptance criterion.

The three load-bearing decisions:

1. **The gate is the frame budget of the reference display, not the Swift reading.** The Swift
   reading is recorded beside every Electron reading and used for exactly one purpose: to say
   whether a FAIL is something the migration introduced or something `apps/macOS` already had.
2. **Every threshold is spelled in a unit this repo already gates in** — nearest-rank percentiles
   over frame intervals, stall milliseconds per second, counts, and ADR-0028's own slack figures
   (1.3 for a flat ratio, 3× for a duration). Nothing new is invented where an existing figure
   fits.
3. **The instrument is one reducer with two producers.** `scripts/frame-band.py` already reduces
   `FrameProbeSummary` JSON; the Electron probe writes that same JSON shape and is reduced by that
   same script. Two percentile spellings would be two different questions.

The Electron half of the instrument is **proved on this machine, not inferred**: Electron 44.2.0
(Chromium 152.0.7977.76) exposes Long Animation Frames, Event Timing, `contentTracing` with all
nine categories the frame and input questions need, and holds a 120 Hz cadence at a p99 of 9.20 ms
on a trivial scene. The measurements are in **What was proved locally** below.

**The one thing that blocks the whole comparison:** #1523's Swift figures were taken against a
frame budget of **16.67 ms**, i.e. a 60 Hz display, while the reference Mac's built-in display
reads **120.0006 Hz** and its budget is **8.33 ms**. Those two sets of numbers are not comparable
at all. The Swift idle band has to be re-recorded on the reference Mac, at a pinned refresh rate,
before a single Electron figure means anything.

## 1 · The reference Mac

**Mac16,1 — MacBook Pro 14-inch, Apple M4, 10 cores, 24 GB, macOS 26.5.2 (build 25F84), built-in
Liquid Retina XDR at 3024 × 1964 (logical 1512 × 982 at device-pixel-ratio 2), refresh pinned to
120 Hz, battery present.**

Read off the machine this note was written on: `sysctl -n hw.model` → `Mac16,1`,
`hw.ncpu` → `10`, `hw.memsize` → `25769803776`, `sw_vers` → `26.5.2` / `25F84`,
`system_profiler SPDisplaysDataType` → `Built-in Liquid Retina XDR Display`, `3024 x 1964 Retina`,
`pmset -g batt` → `-InternalBattery-0 … present: true`.

Four reasons, in order of how hard they bind:

- **It has a battery.** Half of #1736 is battery use. A Mac mini or Studio cannot answer that half
  at all, so the reference Mac is a laptop by construction.
- **arm64 only.** The repo has already decided to ship arm64-only for Apple silicon
  ([#1745](https://github.com/milad-alizadeh/argo/issues/1745)), so an Intel reference measures a
  product nobody gets. *Unverified in-repo: #1745's decision is not yet recorded in `docs/adr/` or
  `docs/research/` in this tree — it is cited from the map.*
- **It is the floor of the shipping range, not the ceiling.** A base M4 with 10 cores and 24 GB is
  the least Apple silicon Argo will meet. A target met there is met on an M4 Pro or Max; a target
  set on an M4 Pro lets a regression hide behind four extra cores and 24 extra gigabytes.
- **It is the machine the migration is being built on**, so the acceptance run costs a scheduling
  decision rather than a hardware purchase.

**The display refresh rate is part of the machine spec, not a detail of it.** Argo's Swift
`FrameProbe` derives its budget from `NSScreen.maximumFramesPerSecond`
(`FrameProbeSummary+Reduce.swift`: `let budget = 1000 / Double(max(source.displayMaxFPS, 1))`), so
the budget moves with the display. Electron reads the same fact through
`screen.getPrimaryDisplay().displayFrequency`, which measured **120.0006103515625** here. At
120 Hz the budget is **8.33 ms** and `frame-band.py`'s over-budget rule (`gap > budget * 1.5`)
fires at **12.5 ms**.

### The two machine discrepancies, recorded rather than smoothed

`ArgoUITests/PerfBudgets.swift` and
[the idle-frame-band note](./2026-09-06-idle-frame-band-after-1512-1518.md) both record their
figures on **"Apple M4 Pro, 12 cores, 48 GB, macOS 26.5.1"**. That is not this machine, and it is
not the machine named above. Two consequences:

- **Every Swift figure in the repo is off a different box** and cannot be quoted against an
  Electron figure taken here. `PerfBudgets` says as much about itself already: its `figureMachine`
  reads `.loadedLaptop`, and "a second is never bindable on either machine."
- **#1523 ran at a 16.67 ms budget.** Its before arm reads a p50 of exactly 16.67 ms with an
  over-budget share of 0.030; at an 8.33 ms budget every one of those frames is over budget and
  the share would read ≈ 1.0. So that measurement was taken against a 60 Hz display. Whether the
  M4 Pro was driving an external monitor or had ProMotion pinned to 60 Hz is **unverified**.

## 2 · The workflows

Seven, each a script that runs identically against both apps, each with a fixed N and a fixed
duration so two runs compare. Six are the set #1736 names; W7 is inherited from
[ADR-0030](../adr/0030-geometry-is-settled-before-it-is-shown.md), which already gates it.

| # | name | N | duration | what it drives | the Swift fixture it reads |
| --- | --- | --- | --- | --- | --- |
| W1 | `idle-cockpit-100` | 100 Sessions, none running | 30 s after 4 s warm-up | cockpit in front, nothing touched | `--specimen crowdedSpawningRoster` (100 rows, `SpawningRosterSpecimen.swift`) |
| W2 | `stream-one` | 1 managed Session, 64 KB/s of synthetic output | 60 s | one Session streaming into an open Feed | a fixed writer, not a real agent |
| W3 | `scroll-feed-2400` | 2 408 rows | 30 s, top → bottom → top at a fixed rate | the Feed under a scroll | the 2 408-row reading `MinimapCostTests` already carries |
| W4 | `atlas-drag` | production-size Map | 30 s of continuous yaw drag | the Atlas under a hand | `AtlasViewTests/AtlasDragTests` + `atlasCity` specimen |
| W5 | `answer-permission` | 20 repeats, ≥ 400 ms apart | per-interaction | one Permission arrives, one key answers it | the permission specimens |
| W6 | `eight-running` | 8 managed Sessions, each streaming 8 KB/s | 120 s | N agents at once | eight `stream-one` writers |
| W7 | `open-63mb` | the largest Session Argo has been given | single cold pass | first open, geometry settled before a row is shown | `SettledSessionCostTests`' 63 MB / 459-row synthetic |

Four rules that make them comparable rather than merely repeatable:

- **W1's N is 100 because a fixture already exists at 100.** `SpawningRosterSpecimen` says so:
  "A hundred, because #1562's reading is …". Reusing it means the Electron side reads the same
  roster rather than one somebody sized by feel.
- **W2 and W6 use a synthetic writer, never a real agent.** A real `claude` or `codex` run costs a
  different number of tokens every time, and a workflow whose input varies is not a workflow.
- **W6 measures Argo's own process family only.** Both apps spawn one operating-system process per
  managed Session — that is settled in
  [the Session process hosts note](./2026-09-08-session-process-hosts.md) — and the CLI's own
  process costs the same under either host. What differs is Argo's side of it, so that is what the
  gate reads.
- **W5 is not a band.** It is twenty discrete interactions, read one at a time. A percentile over
  30 s of idle frames says nothing about the one frame a person was waiting for.

## 3 · The targets

### Frame time — p99 of the frame interval, nearest-rank, launch discarded

Never a mean. `frame-band.py` and `FrameProbeSummary+Reduce.swift` both already spell percentiles
as nearest-rank over the sorted intervals, and both say why: it "needs no interpolation and never
invents a value no sample had."

Budget on the reference Mac: **8.33 ms**. The measured Electron runtime floor on this machine is a
p99 of **9.20 ms** with **zero** long-animation-frame entries over 720 frames (see below), so the
ceilings below carry real headroom over what the runtime itself costs.

| workflow | p99 frame interval | over-budget share | stall ms/s | tolerance |
| --- | --- | --- | --- | --- |
| W1 `idle-cockpit-100` | **≤ 12.5 ms** (1.5 budgets) | ≤ 0.05 | ≤ 5 | ± 1.0 ms across 5 rounds |
| W2 `stream-one` | ≤ 16.7 ms (2 budgets) | ≤ 0.10 | ≤ 10 | ± 2.0 ms |
| W3 `scroll-feed-2400` | ≤ 25.0 ms (3 budgets) | ≤ 0.20 | ≤ 10 | ± 3.0 ms |
| W4 `atlas-drag` | ≤ 16.7 ms (2 budgets) | ≤ 0.10 | ≤ 10 | ± 2.0 ms |
| W6 `eight-running` | ≤ 25.0 ms (3 budgets) | ≤ 0.25 | ≤ 10 | ± 3.0 ms |

`stall ms/s` is `frame-band.py`'s `stallMSPerSecond`. The 5 and 10 come from Apple's own hitch
bands: WWDC20 session 10077, *Eliminate animation hitches with XCTest*, defines hitch time ratio
as milliseconds of hitch per second and puts **under 5 ms/s** at good, **5–10 ms/s** at noticeable,
**10 ms/s and over** at act-now
([session page](https://developer.apple.com/videos/play/wwdc2020/10077/)). Argo's
`stallMSPerSecond` is not identical to Apple's hitch ratio — it sums `gap − budget` over frames
past `budget × 1.5` — but it is the same unit and the same shape, so the bands transfer as
guidance. **The 5/10 figures were read off that session page through a fetch summary rather than
hand-verified against the transcript; treat them as sourced, not double-checked.**

**What the Swift arm currently reads, for context and not as the bar.** On the M4 Pro, loaded, at a
16.67 ms budget, an idle cockpit of the real per-machine roster
([#1523's note](./2026-09-06-idle-frame-band-after-1512-1518.md)):

| | before #1512+#1518 | after both |
| --- | --- | --- |
| p50 | 16.67 ms | **59.93 ms** |
| p99 | 621.68 ms | 163.34 ms |
| effective fps | 29.89 | **14.60** |
| stall ms/s | 502.73 | **756.53** |
| over-budget share | 0.030 | **0.934–0.945** |

Read against the ceilings above, **the Swift app fails W1 by a factor of thirteen on p99 and by a
factor of 150 on stall.** That is #1538's, not the migration's. It is why the gate is absolute.

### Input latency

The instrument is **Long Animation Frames**, not Event Timing's `duration`. Measured on this
machine: `event.duration` came back as 232, 168 and 88 ms — every value a multiple of eight,
because the Event Timing spec rounds `duration` to 8 ms granularity
([spec](https://w3c.github.io/event-timing/)). A target finer than 8 ms cannot be read off it.
LoAF's fields are not rounded: the same interactions read `duration` 70.39999997615814 and
`blockingDuration` 20.3.

So input latency is **`renderStart − firstUIEventTimestamp`** off the
`long-animation-frame` entry, in milliseconds, sub-millisecond resolution
([spec](https://w3c.github.io/long-animation-frames/)).

| workflow | target | tolerance |
| --- | --- | --- |
| W5 `answer-permission` | p95 ≤ **50 ms**, p99 ≤ **100 ms** | ± 5 ms over 20 interactions |
| W5 `answer-permission` | **zero** LoAF entries with `blockingDuration > 0` | exact — it is a count |
| W3 `scroll-feed-2400` | **zero** LoAF entries with `duration > 100 ms` | exact |

50 ms is not arbitrary: it is the threshold both the Long Animation Frames spec and the
[Long Tasks spec](https://w3c.github.io/longtasks/) use for a frame or task that has gone long, so
a p95 under it means the typical answered Permission never produced a long frame at all. The
`blockingDuration > 0` count is the gate ADR-0028 Rule 8 asks for — a count is exactly
load-independent where a duration is only approximately so.

**INP's 200 ms / 500 ms bands are deliberately not used as the gate.** Google's own page gives them
as the 75th percentile of *page loads recorded in the field*, segmented across mobile and desktop
([web.dev/articles/inp](https://web.dev/articles/inp)). They are web field calibration, not a
desktop-app spec, and 200 ms is four times looser than the number above.

### Scroll smoothness

No separate instrument. It is W3's three rows above — p99, over-budget share and stall ms/s —
plus one count: **the Feed must re-measure fewer rows than the document per scroll frame.**
`MinimapWalkCostTests` already gates the Swift side of exactly this at 1 420 ruler measures over a
1 000-row reading against 29 000 before its fix, and `PerfBudgets.walkBurstDocuments = 3` is the
bound. The Electron equivalent is a count of layout reads per frame, gated at Rule 3's **1.3**
between a 300-row and a 3 000-row reading.

### Resident memory

The number is **`phys_footprint`**, summed over Argo's whole process family. `man footprint` on
this machine is unambiguous about why: *"To estimate how much RAM is used by each process at any
given moment, Apple platforms track 'physical footprint' using a per-process kernel ledger… Most
other diagnostic tools, such as the 'MEM' column in top(1), the 'Memory' column in Activity
Monitor.app, and the Memory Debug Gauge in Xcode.app all report values from the process footprint
ledger."* Resident size is the wrong number by Apple's own account: *"resident size includes clean
and volatile purgeable memory that can be reclaimed by the kernel."*

The Electron floor, measured here: **one Electron 44.2.0 window is four processes.**
`app.getAppMetrics()` for a single 900 × 600 window drawing one animated div returned Browser
159 888 KB + GPU 81 952 KB + Network Service 49 296 KB + Tab 94 064 KB = **385 200 KB (376 MB)** of
`workingSetSize`, before a line of Argo. `apps/macOS` is one process.

| workflow | target |
| --- | --- |
| W1 `idle-cockpit-100` | total `phys_footprint` ≤ **2 ×** the Swift reading re-recorded on the reference Mac in the same session |
| W6 `eight-running` | **marginal** footprint per added Session ≤ **1.3 ×** Swift's marginal figure (ADR-0028 Rule 3's slack) |
| W7 `open-63mb` | peak `phys_footprint` ≤ **2 ×** the Swift peak |

**No absolute megabyte ceiling is stated, and that is deliberate.** The Swift `phys_footprint` for
any of these workflows is **not recorded anywhere in this repo** — `PerfBudgets`' one memory figure
is `MediaMemoryCostTests`' census of retained picture bytes, which is a different question. An
absolute ceiling written before that baseline exists would be a number somebody guessed. The first
act of the acceptance work is recording it; the ratio gates above bind the moment it lands.

The 2× is a judgment and is named as one: Electron's own four-process floor is 376 MB against one
Swift process, so a 1.3× gate would fail on the runtime rather than on Argo's code, and anything
past 2× is a second copy of the app's working set rather than the cost of a browser.

### CPU

Per-process CPU seconds consumed over the fixed window, summed over the family. Electron's
`app.getAppMetrics()` carries `cpu.cumulativeCPUUsage` — measured on this machine as
0.440581 / 1.172205 / 0.066524 / 0.770745 seconds across the four processes over roughly seven
seconds of wall clock — so a window delta is one call at each end.

`percentCPUUsage` is **not** the instrument. Electron's docs define it as "Percentage of CPU used
since the last call to the API that returned this object. First call returns 0"
([CPUUsage](https://www.electronjs.org/docs/latest/api/structures/cpu-usage)) — it read 0 in every
measurement here, because each was a first call. Chromium's own primitive says the scale is
per-core, not per-machine: `base/process/process_metrics.h` documents
`GetPlatformIndependentCPUUsage` as returning "a value in the range 0% to
`SysInfo::NumberOfProcessors() * 100%`". `ps` behaves the same way and `man ps` says so: *"it is
possible for the sum of all %cpu fields to exceed 100%"* — and `%cpu` there is "a decaying average
over up to a minute", which is the wrong shape for a 30-second window.

| workflow | target |
| --- | --- |
| W1 `idle-cockpit-100` | family CPU ≤ **2 ×** Swift, and ≤ **3.0 CPU-seconds** over the 30 s window (10% of one core) — PROVISIONAL, see below |
| W2 `stream-one` | ≤ **2 ×** Swift |
| W3 `scroll-feed-2400` | ≤ **2 ×** Swift |
| W6 `eight-running` | **marginal** CPU per added Session ≤ **1.3 ×** Swift's marginal figure |

The 3.0 CPU-second absolute is marked PROVISIONAL in `PerfBudgets`' own idiom: no Swift idle CPU
figure exists in the repo to derive it from, and it is stated so a run has something to fail
against rather than because it was measured.

### GPU

Two readings, one of them a count.

- **Power.** `powermetrics --samplers gpu_power`, averaged over the window. Gate: **≤ 2 ×** Swift.
  Reported, never blocking — see §5.
- **Draw cost, as counts.** Three.js exposes `renderer.info.render.calls`, `.triangles`, `.points`,
  `.lines` and `.frame`, plus `info.memory.geometries` and `.textures`, reset per render call
  unless `info.autoReset` is set false
  ([WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer)). Gate: draw calls and
  triangles per frame must not grow with the Map — Rule 3's **1.3** between a 300-file and a
  3 000-file Map.
- **Stillness, as a count.** The Atlas must schedule **zero** frames in a 10-second window with a
  still scene. The portable-Atlas decision already requires this ("The renderer stays idle when the
  scene is still"), the Swift side holds it through `AtlasCityCache`, and a count is exact.

**There is no first-party three.js statement about the fill-rate cost of device-pixel-ratio 2.**
The `WebGLRenderer` page documents `setPixelRatio` as "Sets the given pixel ratio and resizes the
canvas if necessary" and says nothing about cost. The reference display runs at DPR 2 (measured:
`window.devicePixelRatio` → 2), so the Atlas draws four times the fragments of a 1× canvas — but
that is general rasterisation arithmetic, not something three.js asserts, and this note does not
attribute it to them.

### Energy

Two readings, and only one of them is a gate.

**The gate: projected battery life under W1 must be ≥ 80% of the Swift app's.** Unplugged, Low
Power Mode off, display brightness pinned, `caffeinate -d -i` (never `-s`, which `man caffeinate`
says is "valid only when system is running on AC power" — the one flag combination that cannot
coexist with a battery measurement). Two 20-minute windows per arm, arms interleaved, charge read
from `ioreg -rn AppleSmartBattery`: `AppleRawCurrentCapacity` in mAh at each end, with
`AccumulatedSystemEnergyConsumed` beside it. `ExternalConnected` and `IsCharging` must both read
`No` for the window to count.

80% is a stated allowance rather than a measurement: the user-visible unit is hours of battery, and
a fifth of the working day is the most a portability gain is worth paying. **The tolerance band is
not yet knowable** — nobody has measured how repeatable a 20-minute battery delta is on this
machine — so it is established by the first three runs of the Swift arm and written into the
figures file before any Electron run is judged.

**The report, not the gate: `powermetrics --show-process-energy`.** Its help text on this machine
describes what it gives: *"show per-process energy impact number. This implicitly enables sampling
of all the above per-process statistics."* `man powermetrics` is blunter: *"This number is a rough
proxy for the total energy the process uses, including CPU, GPU, disk io and networking. The
weighting of each is platform specific."* Apple says the same twice more — Activity Monitor's help
calls Energy Impact *"A relative measure of the current energy consumption of the app (lower is
better)"*
([Apple Support](https://support.apple.com/guide/activity-monitor/view-energy-consumption-actmntr43697/mac)),
and the archived Energy Efficiency Guide for Mac Apps says it *"assigns an energy impact score to
your app… A variety of factors are taken into account"*
([developer.apple.com archive](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/MonitoringEnergyUsage.html)).
A synthetic relative score with a platform-specific weighting cannot be a cutover gate. It is
excellent for finding *which* process moved, which is why it is recorded every run.

`powermetrics` itself warns off the absolute reading in its own help text: *"Average power values
reported by powermetrics are estimated and may be inaccurate — hence they should not be used for
any comparison between devices, but can be used to help optimize apps for energy efficiency."*
Comparing two apps on one device is exactly the use it endorses.

## 4 · The procedure

### The instrument, per metric

| metric | command or API | needs sudo |
| --- | --- | --- |
| frame time, stall, over-budget | Swift: `ARGO_FRAME_PROBE=1` via `sh apps/macOS/scripts/run-release.sh --probe`. Electron: a `requestAnimationFrame` stamp collector writing `FrameProbeSummary`'s JSON shape. Both reduced by `python3 scripts/frame-band.py <probe.json> 4` | no |
| input latency | Electron: `PerformanceObserver` on `long-animation-frame`. Swift: driver click stamps joined against `FrameProbeSummary.timestamps` — the summary's own doc comment names this as "the only join that makes click-to-settled measurable without a second instrument" | no |
| resident memory | `footprint <pid>` per process, `phys_footprint` under "Auxiliary data"; `footprint -j <path>` to script it. Electron's `app.getAppMetrics()` for the per-process split, in kilobytes | **yes** (`man footprint` states a root requirement) |
| CPU | `app.getAppMetrics()[].cpu.cumulativeCPUUsage` delta (Electron); `powermetrics --samplers tasks --show-process-samp-norm --format plist -i 1000 -n <window>` for both arms | powermetrics: **unverified**, see §6 |
| GPU power | `powermetrics --samplers gpu_power -i 1000 -n <window> --format plist` | **unverified** |
| GPU draw cost | `renderer.info.render.calls` / `.triangles` per frame | no |
| energy, gate | `ioreg -rn AppleSmartBattery` at each end of a 20-minute unplugged window | no — verified, it runs unprivileged |
| energy, report | `powermetrics --samplers tasks --show-process-energy --show-process-gpu --format plist` | **unverified** |
| a deep trace when a gate fails | `contentTracing.startRecording` / `stopRecording` from the **main** process only ([docs](https://www.electronjs.org/docs/latest/api/content-tracing)); viewed in `chrome://tracing` or `ui.perfetto.dev` | no |

### Runs, and how the machine is quieted

- **Five rounds per workflow, ten runs, arms interleaved, and the arm that goes first alternates
  every round.** This is #1523's design and it is copied for #1523's reason: "a machine that drifts
  one way across the session cannot be read as a difference between the arms."
- **Least-of-N for a cost, largest-of-N for a rate, median for a count.** Also #1523's, and
  `CostMeasure`'s: "Noise is one-sided: a cache miss, a page fault, a frequency step and a
  preemption only ever ADD."
- **The box is taken exclusively.** `AGENTS.md` records this machine carrying about ninety merges a
  day across some sixty worktrees, and #1523's own runs sat at one-minute load averages of 19 to 65
  — which is why its figures are an upper bound and nothing more. An acceptance session runs
  `bun run worktrees:gc`, stops every other lane, and holds `caffeinate -d -i` for its length.
- **Never a hand-rolled load generator.** Where a loaded arm is wanted deliberately,
  `sh scripts/load-burst.sh <workers> <seconds>`, stopped with the `--reap <token>` it prints.
- **The load average is recorded with every run**, and a run whose one-minute average exceeds
  **4.0** at the start is discarded rather than reported. A budget measured in seconds reads the
  machine as much as the code; this is the only control that is not a ratio.
- **`screen.getPrimaryDisplay().displayFrequency` is read at the start and end of every Electron
  run**, and the Swift arm's `FrameProbeSummary.frameBudgetMS` is read the same way. A run whose
  refresh rate moved is discarded. ProMotion is adaptive by design — Apple's own MacBook Pro tech
  specs say "ProMotion technology for adaptive refresh rates up to 120Hz"
  ([Apple Support](https://support.apple.com/en-us/125405)) — so the rate is read, never assumed.
- **Release builds only, both arms.** `docs/agents/build-configurations.md` is the reason: debug is
  `-Onone` and "a hitch measured on a debug build measures code nobody runs."
- **A run's launch is discarded**: 4 seconds of warm-up, passed to `frame-band.py` as its second
  argument, exactly as #1523 did.

### How the result is recorded

One JSON per run, reduced by `frame-band.py`, and one figures file on the Electron side shaped like
`ArgoUITests/PerfBudgets.swift` — every entry carrying the same four fields, because a figure
without them cannot be re-read a month later:

    Recorded: <what> · <machine> · <configuration> · <sampling>

### Does the Electron side reuse the two-phase timing discipline?

**Yes for the cost suites, and no for these seven workflows.**

The cost suites should reuse the shape exactly: correctness suites in parallel, clock-reading
suites alone, with the set derived from the tree rather than listed — the Electron analogue of
`apps/macOS/scripts/timing-suites.sh`, which greps for calls to `CostMeasure`'s four helpers and
prints the type names. The reason is unchanged: "A budget measured in seconds reads the machine as
much as the code, and the parallel run is the loudest thing on the machine."

**One thing does not port, and it matters.** `CostMeasure` is built on
`clock_gettime(CLOCK_THREAD_CPUTIME_ID)` — per-*thread* CPU, chosen because "everything measured
through this runs on the thread that calls it, and the process is running the rest of the suite in
parallel." Node exposes `process.cpuUsage()`, which is per-*process*, and no per-thread CPU clock.
So an Electron cost suite has no equivalent of `cpuSeconds`, and ADR-0028 Rule 8's first
instruction — "prefer a COUNT to any of these wherever a count exists" — binds harder on the
Electron side than on the Swift side, not less. Every Electron cost gate should be a count.

The seven workflows are **not** unit tests. They drive a packaged app, so they belong beside
`apps/macOS/scripts/e2e-test.sh` as a deliberately **local** gate. CI is Linux only, so nothing
here can run there, and `AGENTS.md`'s warning applies unchanged: a driven run holds the real
keyboard and mouse for its whole length, so say so and wait.

## 5 · FAIL versus reported

`#1737` needs one line. Here it is: **a FAIL is a median-of-five verdict against an absolute
ceiling, on a quiet reference Mac, with the Swift arm passing its own gate in the same session.**

### Blocks cutover

1. Any workflow's **p99 frame interval** over its stated ceiling in **3 of 5** interleaved rounds.
2. Any workflow's **stall** over 10 ms/s, or W1's over 5 ms/s, on the median round.
3. **Any** LoAF entry with `blockingDuration > 0` during W5. It is a count, so one is a failure.
4. W7's cold open over **3 seconds** — ADR-0030 Rule 3's gate, agreed in the #1109 grilling, and
   already binding on `apps/macOS` through `PerfBudgets.settledDocument`.
5. Total `phys_footprint` over **2 ×** the Swift reading on W1, or marginal per-Session footprint
   over **1.3 ×** on W6.
6. Family CPU over **2 ×** Swift on W1, W2 or W3, or marginal per-Session CPU over **1.3 ×** on W6.
7. Projected battery life under W1 below **80%** of Swift's.
8. The Atlas scheduling **any** frame in a still 10-second window, or its draw calls per frame
   growing past **1.3 ×** between a 300-file and a 3 000-file Map.
9. **A workflow the harness cannot run identically on both apps.** An unrunnable workflow is a
   FAIL, not a gap: it means the two apps were never compared on that behaviour, and #1737 cannot
   retire `apps/macOS` on a comparison that was not made.

### Reported, and does not block

- A single round over a ceiling while the median is under it.
- **GPU power over 2 × Swift.** Reported because no first-party per-process GPU *energy*
  attribution exists — Apple's per-process figure is the composite Energy Impact score its own
  documentation calls "a rough proxy" with a "platform specific" weighting — and because the
  battery gate already carries whatever the GPU costs the machine.
- Absolute CPU seconds and absolute megabytes where the ratio gate holds.
- Every reading from a run whose load average exceeded 4.0, or whose refresh rate moved.
- `powermetrics`' Energy Impact composite, always, for both arms.
- **The Swift arm failing its own gate.** This is the sharpest line in the whole note: if the Swift
  arm fails W1 on the reference Mac — and on today's `main` it will, by a factor of thirteen —
  **the comparison is void, not passed.** #1538 lands first, or the Electron app is accepted
  against nothing. "Parity with Swift" is not available as an acceptance criterion while Swift is
  the thing under repair.

## What was proved locally

Everything in this section is a measurement taken on the reference Mac at repo commit `374b6b3a`,
against the pinned `electron@44.2.0` in `apps/desktop/node_modules`, by running that binary against
a throwaway main script. It is recorded because it replaces four claims the external documentation
could not settle.

**The runtime versions**, from `ELECTRON_RUN_AS_NODE=1 Electron -e 'console.log(process.versions)'`:
Electron **44.2.0**, Chromium **152.0.7977.76**, Node **24.20.0**, V8 **15.2.124.19-electron.0**.

**Which `PerformanceObserver` entry types exist in an Electron renderer.** The full
`PerformanceObserver.supportedEntryTypes`:

```
element, event, first-input, interaction-contentful-paint, largest-contentful-paint,
layout-shift, long-animation-frame, longtask, mark, measure, navigation, paint,
resource, soft-navigation, visibility-state
```

So `long-animation-frame`, `longtask`, `event` and `first-input` are all real here, and
`observe({ type: 'event', durationThreshold: 16 })` and
`observe({ type: 'long-animation-frame' })` both succeed. **`frame` is absent** — the Frame Timing
API was abandoned ([WICG](https://wicg.github.io/frame-timing/): "This work is NO LONGER BEING
PURSUED") — and `window.requestPostAnimationFrame` is **absent** (its
[proposal repo](https://github.com/WICG/requestPostAnimationFrame) is archived). There is therefore
**no web API in an Electron renderer that reports a frame's presentation time.** The only route to
compositor frame data is a `contentTracing` capture, and reading a trace is a diagnosis, not a gate.

**`performance.memory` is useless as a gate.** It exists, and it returned
`{used: 10000000, total: 10000000, limit: 3760000000}` — a suspiciously round quantised figure, with
used equal to total. `performance.measureUserAgentSpecificMemory` is **absent**, and
`self.crossOriginIsolated` read **false**, which is exactly what the spec requires for it: *"Assert:
the current Realm's settings objects's cross-origin isolated capability is true"*
([WICG](https://wicg.github.io/performance-measure-memory/)). Whether COOP/COEP headers can be
injected into an Electron `BrowserWindow` to enable it is **unverified**, and irrelevant while
`footprint` exists.

**The frame cadence and the refresh rate.** `screen.getPrimaryDisplay()` returned
`{size: {width: 1512, height: 982}, scaleFactor: 2, displayFrequency: 120.0006103515625}`. Six
seconds of `requestAnimationFrame` on a page translating a 200 px div every frame, reduced by
`frame-band.py`'s own nearest-rank arithmetic:

| frames | span | p50 | p95 | p99 | max | LoAF entries |
| --- | --- | --- | --- | --- | --- | --- |
| 720 | 5.9916 s | 8.30 ms | 8.80 ms | 9.20 ms | 9.30 ms | **0** |

120.2 frames per second, sustained, with no long animation frame at all. **The Electron runtime is
not what will cost Argo its frame budget** — whatever Argo builds on it will be.

**Event Timing rounds, LoAF does not.** Five injected clicks into a handler that spins for 70 ms:

| instrument | reading |
| --- | --- |
| `event.duration` | 232, 168, 88 ms — every value a multiple of 8 |
| LoAF `duration` | 75, 70.5, 70.39999997615814, 70.39999997615814, 70.5 ms |
| LoAF `blockingDuration` | 24.9, 20.4, 20.3, 20.3, 20.3 ms |
| LoAF `firstUIEventTimestamp` | equal to the event's own `timeStamp` in every case |
| `event.interactionId` | non-zero on `pointerdown`, `pointerup` and `click` (4633, 4640, …) |

`blockingDuration` reading 20.3 against a `duration` of 70.4 confirms the spec's definition
directly — the sum of task time past the 50 ms threshold.

**`contentTracing` round-trips, and carries every category needed.** `getCategories()` returned
**288** categories, including all of `benchmark`, `viz`, `cc`, `gpu`, `latency`, `latencyInfo`,
`devtools.timeline`, `input`, `toplevel`, `disabled-by-default-devtools.timeline`,
`disabled-by-default-devtools.timeline.frame`, `blink`, `blink.user_timing`, `renderer.scheduler`,
`sequence_manager` and `gpu.capture`. `viz.triangles` is **not** among them. A 1.5-second recording
of `['benchmark', 'viz', 'toplevel']` produced an **8.48 MB** trace file — about 5.6 MB per second,
which is why a trace is a diagnosis after a failure and not something a run collects by default.

**The four-process floor.** `app.getAppMetrics()` for one window: Browser, GPU, Utility
(`network.mojom.NetworkService`) and Tab, at 159 888 / 81 952 / 49 296 / 94 064 KB of
`workingSetSize` — **376 MB before Argo**. `process.getProcessMemoryInfo()` for the same main
process returned `{private: 37713, shared: 656}` KB. **Those two disagree by a factor of four for
the same process, and the disagreement is recorded rather than resolved**: Electron documents
`workingSetSize` as "the amount of memory currently pinned to actual physical RAM" and `private` as
"the amount of memory not shared by other processes"
([MemoryInfo](https://www.electronjs.org/docs/latest/api/structures/memory-info),
[process](https://www.electronjs.org/docs/latest/api/process)), and neither is `phys_footprint`.
This is the whole reason the memory gate reads `footprint` and not an Electron API. Electron's own
docs also note that `residentSet` is **not provided on macOS**, "because macOS performs in-memory
compression of pages that haven't been recently used."

**`powermetrics`' real sampler list**, from `powermetrics -h` on this machine — closing a gap the
man page leaves open, since it only says "Run with -h to see a list of samplers":

```
tasks, battery, network, disk, interrupts, cpu_power, thermal, sfi, gpu_power, ane_power
groups: all = every one of those; default = all but thermal and sfi
```

`--format plist` is real (*"machine-readable property list, NUL-separated"*), as are
`--show-process-energy`, `--show-process-gpu`, `--show-process-coalition`,
`--show-process-samp-norm` and `--hide-cpu-duty-cycle`. `-i` is `--sample-rate` in milliseconds
(default 5000), `-n` is `--sample-count` (`-1` = infinite), `-o` is `--output-file`. It also takes
`SIGINFO` for an immediate sample and `SIGIO` to flush — useful for a harness that wants a sample
at a workflow boundary rather than on a timer.

## What this does not settle

- **The Swift baseline on the reference Mac.** Nothing here re-records it. Every relative gate
  above is armed by that recording and inert until it exists. It is the first task of the
  implementation ticket, not of this note.
- **Whether `powermetrics` needs root.** `man powermetrics` on this machine states no root
  requirement anywhere in its text, unlike `man footprint`, which states one explicitly. The
  attempt to settle it by running `powermetrics -n 1 -i 500 --samplers tasks` was blocked by this
  session's own worktree guard before it ran. **Unverified**, and it decides whether the CPU, GPU
  and energy-report commands can run inside an unprivileged harness or need a sudo prompt per run.
- **The exact `powermetrics` output line labels.** No Apple source publishes a sample listing, and
  the help text describes the concepts without spelling the lines. Do not write `"CPU Power: N mW"`
  into a parser before seeing one.
- **Which Instruments templates exist on this Xcode.** `xcrun xctrace list templates` is the
  authoritative answer and was blocked by the same guard. "Metal System Trace" is confirmed by
  Apple's own [Metal tools page](https://developer.apple.com/metal/tools/); **"Animation Hitches",
  "CPU Counters" and "Energy Log" are unverified on current Xcode and Apple silicon**, and the one
  Apple description of Energy Log found is an archived iOS-device page. Nothing in the procedure
  above depends on Instruments, deliberately — `xctrace record --template <name> --attach <pid>`
  and `xctrace export --input <trace> --xpath <expr>` are documented in `man xctrace` and are the
  route if a template turns out to be needed.
- **Whether `event.timeStamp` carries the kernel's timestamp for a real hardware event.** The five
  measured `performance.now() - event.timeStamp` deltas were 2.9, 0.6, 0.4, 0.5 and 0.4 ms — but
  those events were injected with `webContents.sendInputEvent`, which stamps them in the browser
  process, so the delta measured the browser-to-renderer IPC hop and nothing before it. Blink's own
  intent-to-ship thread says input events carry "the underlying OS timestamp for the event"
  ([blink-dev](https://groups.google.com/a/chromium.org/g/blink-dev/c/hfkkQiuMgkQ/m/IC4EY3KUBQAJ)),
  and the DOM spec does not distinguish. **Unverified for a real mouse**, and it is why the input
  gate reads LoAF's `firstUIEventTimestamp` rather than a subtraction: a scripted input latency
  measurement cannot see the operating-system leg, whichever app it is driving.
- **The repeatability of a battery-delta measurement on this machine.** Unknown. The tolerance band
  for the energy gate is therefore established by measurement before it binds, not stated here.
- **How the two workflows that need synthetic writers get one.** W2 and W6 need a fixed-rate
  transcript writer on both sides. Nothing in the repo provides it.
- **What #1745 actually decided.** The arm64-only ship decision is cited from the map and is not
  recorded in `docs/adr/` or `docs/research/` in this tree.
- **The 5 and 10 ms/s hitch bands.** Read off WWDC20 session 10077's page through a fetch summary,
  not hand-verified against the transcript. They are the only external number in the note that a
  gate rests on, and they deserve a direct check before the gate is written into code.

## Sources

Local primary sources, all read in this tree: `AGENTS.md`;
`docs/agents/visual-verification.md`; `docs/agents/build-configurations.md`;
[ADR-0028](../adr/0028-cost-is-a-gate.md), [ADR-0029](../adr/0029-a-feed-opens-at-its-tail.md),
[ADR-0030](../adr/0030-geometry-is-settled-before-it-is-shown.md);
`apps/macOS/Packages/ArgoUI/Tests/ArgoUITests/PerfBudgets.swift` and `CostMeasure.swift`;
`apps/macOS/Packages/ArgoEngine/Tests/ArgoEngineTests/PerfBudgets.swift`;
`apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Perf/FrameProbe.swift`,
`FrameProbeSummary.swift` and `FrameProbeSummary+Reduce.swift`; `scripts/frame-band.py`;
`scripts/load-burst.sh`; `apps/macOS/scripts/timing-suites.sh`; `apps/macOS/scripts/run-release.sh`.
Sibling notes: [the idle frame band](./2026-09-06-idle-frame-band-after-1512-1518.md),
[the Session process hosts](./2026-09-08-session-process-hosts.md),
[the portable Atlas scene boundary](./2026-09-08-portable-atlas-scene-boundary.md),
[the packaged Electron toolchain proof](./2026-09-08-packaged-electron-toolchain-proof.md).

Machine-local primary sources: `man footprint`, `man vmmap`, `man pmset`, `man ps`, `man top`,
`man caffeinate`, `man xctrace`, `man powermetrics` and `powermetrics -h`; `sysctl`, `sw_vers`,
`system_profiler SPDisplaysDataType`, `ioreg -rn AppleSmartBattery`; and the `electron@44.2.0`
binary itself, which produced every reading in **What was proved locally**.

External primary sources, each linked at its claim above: Electron's
[content tracing](https://www.electronjs.org/docs/latest/api/content-tracing),
[app.getAppMetrics](https://www.electronjs.org/docs/latest/api/app#appgetappmetrics),
[ProcessMetric](https://www.electronjs.org/docs/latest/api/structures/process-metric),
[CPUUsage](https://www.electronjs.org/docs/latest/api/structures/cpu-usage),
[MemoryInfo](https://www.electronjs.org/docs/latest/api/structures/memory-info),
[process](https://www.electronjs.org/docs/latest/api/process) and
[performance tutorial](https://www.electronjs.org/docs/latest/tutorial/performance) — that last one
naming **no numeric target anywhere**, which is why every number in this note had to be derived
here. Chromium's
[process_metrics.h](https://chromium.googlesource.com/chromium/src/+/HEAD/base/process/process_metrics.h)
and [cc/base/switches.cc](https://chromium.googlesource.com/chromium/src/+/HEAD/cc/base/switches.cc).
The specs: [Long Animation Frames](https://w3c.github.io/long-animation-frames/),
[Long Tasks](https://w3c.github.io/longtasks/), [Event Timing](https://w3c.github.io/event-timing/),
[measureUserAgentSpecificMemory](https://wicg.github.io/performance-measure-memory/),
[Frame Timing (abandoned)](https://wicg.github.io/frame-timing/),
[requestAnimationFrame](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames).
Apple: [WWDC20 session 10077](https://developer.apple.com/videos/play/wwdc2020/10077/),
[Activity Monitor energy help](https://support.apple.com/guide/activity-monitor/view-energy-consumption-actmntr43697/mac),
[the archived Energy Efficiency Guide](https://developer.apple.com/library/archive/documentation/Performance/Conceptual/power_efficiency_guidelines_osx/MonitoringEnergyUsage.html),
[Metal tools](https://developer.apple.com/metal/tools/),
[MacBook Pro tech specs](https://support.apple.com/en-us/125405).
Three.js: [WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer).
Google, for the INP bands this note declines to gate on:
[web.dev/articles/inp](https://web.dev/articles/inp).

Two source-level traps worth carrying forward. `w3c.github.io/measure-memory` **404s** — the live
spec is `wicg.github.io/performance-measure-memory/`. And Electron's own
[command-line switches page](https://www.electronjs.org/docs/latest/api/command-line-switches)
disclaims the completeness and reliability of undocumented Chromium switches, so
`--show-fps-counter` and `--enable-gpu-benchmarking` are Chromium switches passable through
`app.commandLine.appendSwitch`, never Electron guarantees — which is a second reason the frame
instrument is `requestAnimationFrame` plus LoAF rather than a Chromium flag.
