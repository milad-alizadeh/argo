# The idle frame band on a clean build after #1512 and #1518

**Date:** 2026-09-06 · **For:** [#1523](https://github.com/milad-alizadeh/argo/issues/1523) ·
**Status:** measured, two arms, clean release builds, interleaved A/B

## The result

Each fix reproduces its own claim, and the pair together is a **regression in the steady idle
band**. The freezes are gone: the worst frame in a 30-second measurement window falls from 3238 ms
to 187 ms, better than the 7.1× [#1518](https://github.com/milad-alizadeh/argo/pull/1518) claimed.
One `window(for:)` pass falls from 451 ms to 1.03 ms, better than the 0.02 ratio
[#1512](https://github.com/milad-alizadeh/argo/pull/1512) claimed. But the cockpit now misses its
frame budget on **93 to 95% of frames instead of 3 to 19%**, and stall time per second goes *up*,
from 503 ms to 757 ms.

#1518's own body predicted the opposite. It said the fix alone trades three-second freezes for a
steady 11 fps, and that #1512 "is what closes the gap." On a tree carrying both, **the gap is not
closed.** #1512 removed the ledger fold from the frame, and the ledger is 0.2% of main-thread
samples now against 11.9% before, and the frame is still late, because what got faster was not
what was left.

Throughout this report **fold** means the projection pass `Hub.folded()` runs, not the Roster's
`Fold` that `CONTEXT.md` names, which the Hub has never heard of.

This is the outcome the ticket existed to find, and it is not a failed measurement. No fix is
proposed here; the ticket is measurement only, and the follow-up belongs in its own issue.

## What was measured

Two arms, each a fresh worktree checked out at a commit and built from nothing:

| arm | commit | carries |
| --- | --- | --- |
| before | `61dc37d2` | neither fix — the parent of #1512's merge |
| after | `e05a9747` | both, plus the other fifteen PRs merged that day |

`git merge-base --is-ancestor` confirms `b2f0a256` (#1512) and `aa60999a` (#1518) are ancestors of
the after commit and of neither the before one.

**Every build was cold.** Both worktrees were created for this measurement, so neither had a
`.build`, an `apps/macOS/build`, or any other Swift build output at any point before its first
build — checked, and recorded, rather than deleted, because there was nothing there to delete. The
step cache that would otherwise let a previous tree's verdict stand in for a build was disabled
with `ARGO_GATE_CACHE=off` on every build. The one cache **not** cleared is the machine's shared
precompiled-module directory (`~/Library/Caches/argo-swift/modules`), which holds SwiftUI and
Foundation module artefacts rather than any Argo code, and is identical for the two arms.

Both arms read the same fixture: the real per-machine `ownership-named.json`, which held 461
ledger windows when the session started and 466 when it ended. It is live state and it grows,
which is one of the reasons the arms are interleaved rather than run one after the other.

### The instrument, and why there are two sets of rounds

Both PRs' instruments already exist, so neither was rebuilt:

- **The frame band** is `FrameProbe` under `ARGO_FRAME_PROBE=1`, which ships on `main` and is in
  both arms unchanged. It writes every frame's wall stamp, so the band is recomputed with the
  launch discarded.
- **The per-pass cost** is `FrameProbePass`, which #1512 used and did not ship. It is still
  uncommitted on `argo/body-pass-counter`, and was copied into **both** arms exactly as that PR
  did, along with its `scripts/frame-band.py` reducer.

So there are two sets of four rounds. The **band** set is measured on builds with no counter in
either arm, which is the condition #1518 measured its maximum frame time under. The **pass** set
is measured on builds carrying the counter in both arms, which is the condition #1512 measured
its per-pass figure under. **Each PR's own verdict below is read off the set matching its
condition**, and the other set is quoted beside it as corroboration.

The two sets agree in direction and in every call they support, and they do **not** agree in
absolute value: the band set ran under roughly twice the machine load (see The machine), so its
before arm reaches 29.9 fps where the pass set's reaches 37.8. That the calls survive a 2× swing
in load is the useful part; that the ratios move with it is why neither set is quoted as a bare
absolute.

### The A/B design

Four rounds per set, eight runs per set. The arm that goes **first alternates every round**, so a
machine that drifts one way across the session cannot be read as a difference between the arms.
Each run is a 30-second measurement window after a 4-second warm-up, on an idle cockpit,
release build.

The primary reading per arm is **least-of-N**: the smallest reading for a cost and the largest for
a rate. A run that was fought over by another process is slower than the machine can be and never
faster, so the best reading of each arm is the one the machine actually reached. Every result is
stated as an **after/before ratio**.

One row is deliberately not read that way. **Passes per second is a count, not a cost or a rate**
— neither more nor fewer is better on its own, so "the best the machine reached" means nothing for
it and taking an extremum would only report the noisiest round. That row is the **median** of the
four, and it is the only row in this report that is.

## The band set — #1518's metric

Frame times over the settled measurement window, no counter in either arm.

```
run                maxMS     p50MS     p99MS   effFPS   stall ms/s   over-budget share
band-before-1    3917.51     16.67   1910.40     6.39       894.81               0.190
band-before-2    3237.75     16.67    677.96    29.29       513.99               0.038
band-before-3    4026.36     16.67    679.67    25.59       575.32               0.050
band-before-4    3717.11     16.67    621.68    29.89       502.73               0.030
band-after-1      226.90     71.91    179.95    12.74       787.91               0.945
band-after-2      198.26     62.41    170.43    14.34       761.41               0.935
band-after-3      187.11     59.93    163.34    14.60       756.53               0.938
band-after-4      252.70     63.30    188.35    13.50       775.45               0.934
```

| metric | before (least-of-4) | after (least-of-4) | ratio |
| --- | --- | --- | --- |
| max frame | 3237.75 ms | **187.11 ms** | **0.058** |
| p99 frame | 621.68 ms | 163.34 ms | 0.263 |
| p50 frame | 16.67 ms | **59.93 ms** | **3.60** |
| effective fps | 29.89 | **14.60** | **0.488** |
| stall ms per second | 502.73 | **756.53** | **1.505** |

The **over-budget share** is the column that says what changed in kind rather than in degree. The
before arm draws inside its budget on 81% to 97% of frames and occasionally stops dead for three
or four seconds. The after arm never stops dead and **misses the budget on 93 to 95% of frames**.
Its p50 of 60 ms is not a tail; it is the typical frame.

## The pass set — #1512's metric

The same rounds with `FrameProbePass` built into both arms.

```
run                maxMS   p50MS    p99MS   effFPS   stall ms/s   pass median   pass ms/s   passes/s
pass-before-1    4351.98   16.67  1267.32    11.85       803.31      454.15 ms      500.60       1.12
pass-before-2    3471.36   16.67   575.94    30.93       485.43      451.45 ms      261.04       0.63
pass-before-3    2979.42   16.67   570.74    37.80       370.98      452.19 ms      209.91       0.53
pass-before-4    3842.93   16.67  1236.57    14.37       762.46      463.40 ms      456.74       1.05
pass-after-1      264.08   66.70   185.73    13.18       780.54        1.10 ms       21.05      14.48
pass-after-2      222.47   61.25   169.17    14.29       762.21        1.04 ms       24.12      15.55
pass-after-3      241.76   64.66   170.59    13.41       777.27        1.03 ms       20.57      14.68
pass-after-4      220.27   58.27   168.27    14.51       758.60        1.07 ms       26.18      15.84
```

| metric | before | after | ratio |
| --- | --- | --- | --- |
| median `window(for:)` pass | 451.45 ms | **1.03 ms** | **0.002** |
| pass ms per second | 209.91 | 20.57 | 0.098 |
| **passes per second** (median of 4) | **1.05** | **15.55** | **14.81** |
| max frame | 2979.42 ms | 220.27 ms | 0.074 |
| p99 frame | 570.74 ms | 168.27 ms | 0.295 |
| p50 frame | 16.67 ms | 58.27 ms | 3.50 |
| effective fps | 37.80 | 14.51 | 0.384 |
| stall ms per second | 370.98 | 758.60 | 2.045 |

`passes per second` is the row that explains every other row. #1512 measured the fold running
about once a second and reported that its fix did not make passes rarer — 0.79/s to 0.95/s. On a
tree that also carries #1518, the fold runs **fifteen times a second**. #1518 named this mechanism
itself: the sweep used to take seconds because of its own directory walk, so the fold rode along
at that rate, and a sweep that now finishes in milliseconds runs at the FSEvents coalesce rate
instead.

So the pass got 438× cheaper and 14.8× more frequent, and the product of those is the only reason
the ledger's own cost fell at all.

## Where the main thread is now

`sample`, 25 seconds each, settled idle cockpit, release builds. Shares are of that arm's own
main-thread samples (19099 before, 17949 after).

| frame | before | after |
| --- | --- | --- |
| `mach_msg2_trap` — **parked, i.e. idle** | **56.4%** | **1.9%** |
| `ArgoApp.body` → `presentation` | 24.0% | 1.9% |
| `Hub.folded` | 23.7% | 0.6% |
| `SessionOwnershipLedger` | 11.9% | 0.2% |
| `SessionOwnershipLedger.window(for:)` | 3.8% | 0.2% |
| `SubagentTranscripts` / `NSURLDirectoryEnumerator` | 1.5% | **0.0%** |
| `getattrlistbulk` | 1.2% | **0.0%** |
| `SwiftUICore` | 32.7% | **67.0%** |
| `AttributeGraph` | 24.0% | **36.0%** |

Both fixes did exactly what they said. The directory walk is gone from the main thread entirely,
and the ledger fold is 0.2% of it. What is left is not Argo code: the main thread is parked 1.9%
of the time instead of 56.4%, and it spends two thirds of its life inside SwiftUI's own graph
update. **No frame doing work carries more than 2.0% of self time** — the after arm's heaviest
self-time entry is `mach_msg2_trap` at 2.1%, which is the thread parked rather than working, and
the heaviest actual work is `Hasher.combine(bytes:)` at 2.0% and `AG::Graph::UpdateStack::update()`
at 1.1%, with the rest spread across metadata lookups, retain/release and AttributeGraph
comparisons.

That is the shape of a re-derivation that is individually cheap and paid far too often. The cost
that now owns the frame is **SwiftUI re-evaluating the whole cockpit window fifteen times a
second**, and
neither PR measured it because in each PR's own before-arm it was hidden behind something larger.

## The verdict against each claim

Each row is read off the set measured under that claim's own condition, with the other set beside
it. #1512 took its per-pass figures with the counter built into both arms and its frame band
without it, so its rows split across the two sets exactly as that PR's own body does.

| claim | source | set | this measurement | the other set | call |
| --- | --- | --- | --- | --- | --- |
| median pass 437.47 → 8.70 ms, ratio 0.02 | #1512 | pass | 451.45 → 1.03 ms, ratio **0.002** | not measurable without the counter | **reproduced**, and exceeded |
| pass ms/s 323.65 → 7.51, ratio 0.02 | #1512 | pass | 209.91 → 20.57, ratio **0.098** | not measurable without the counter | **partially reproduced** — right direction, an order of magnitude less of it |
| stall ms/s 544 → 208, ratio 0.38 | #1512 | band | 502.73 → 756.53, ratio **1.505** | pass set: 2.045 | **not reproduced** — the opposite direction |
| max frame 3095 → 435 ms, 7.1× | #1518 | band | 3237.75 → 187.11 ms, **17.3×** | pass set: 13.5× | **reproduced**, and exceeded |
| #1512 closes the fps and p50 gap #1518 opened | #1518 | band | fps 29.89 → 14.60 (0.488); p50 16.67 → 59.93 (3.60) | pass set: 0.384 and 3.50 | **not reproduced** |

Every row lands on the same call in both sets, which is what makes the calls worth stating: the
two sets ran under a 2× difference in machine load and disagree about the size of each effect
without disagreeing about any of its direction.

The two "not reproduced" rows are one fact stated twice: the combined tree is smoother at its
worst and worse at its typical, and #1512 was not what closed it.

## The machine

Apple M4 Pro, 12 cores, 48 GB, macOS 26.5.1, Xcode 26.6 (17F113). It was **not** a quiet machine,
and that is recorded rather than corrected: this box carries the merge rate `AGENTS.md` describes
under Landing (#1377), across some sixty worktrees, and other lanes were building and gating
throughout. Both arms' builds queued behind other lanes on the shared build lock.

One-minute load average at the start of each run:

- band set: 51, 54, 53, 45, 45, 52, 65, 50
- pass set: 19, 23, 30, 32, 26, 28, 31, 25

The band set therefore ran under roughly twice the load of the pass set. That shows in the before
arm's absolute numbers (best fps 29.9 against 37.8) and barely at all in the after arm's, which
reads 187–253 ms max and 12.7–14.6 fps in one set against 220–264 ms and 13.2–14.5 fps in the
other. Both arms are affected together, both sets alternate which arm leads, and every call in
the verdict table holds in both sets, so no conclusion here rests on a single round or on a
single load condition.

Two things about the harness that would matter to anyone repeating this. `FrameProbePass` and
`frame-band.py` are **not on `main`** — they are uncommitted on `argo/body-pass-counter`, and a
future re-measure has to find them there, exactly as this one did. And `sample` names the main
thread `Main Thread` in some runs and `com.apple.main-thread` in others, so a reader that matches
only one spelling silently reports zero samples for a healthy process.

## What this does not settle

- **Which of the other fifteen PRs merged that day contributes.** The after arm is `main`, not
  #1518's merge commit, because the ticket asks for the combined result on a clean tree. Nothing
  here isolates #1518's merge from the fifteen commits after it. The mechanism named above is
  fully accounted for by the two fixes, but that is an explanation, not an isolation.
- **What invalidates the cockpit window fifteen times a second.** The sweep now runs at the FSEvents
  coalesce rate; whether that rate is the floor, or whether the roster's projection pass should be
  debounced or made to invalidate less, is a design question this measurement does not answer.
- **Whether 15 fps is what a person sees.** Every number here is from an idle cockpit with no one
  touching it. A cockpit under a hand may invalidate for other reasons entirely.

The fix belongs in its own ticket, per this one's out-of-scope list: it is
[#1538](https://github.com/milad-alizadeh/argo/issues/1538).
