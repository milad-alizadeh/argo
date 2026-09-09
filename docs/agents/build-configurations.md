# Build configurations — historical

> **2026-09-09 (#1758).** Every command this file described is deleted along with
> `apps/macOS/scripts`, and nothing builds the Swift app. This is the record of how it was
> configured and what optimisation was worth, for whoever ports its behaviour to `apps/desktop`.
> There is nothing here to run.

## What the Swift app was built with

Debug was `-Onone` and incremental; Release was `-O` and `wholemodule`. Both were named once, in
the project-level block of `Argo.xcodeproj/project.pbxproj`, so the target-level blocks inherited
them and adding a target could not silently give it a different level.

Until #998 **no configuration named an optimisation level except Debug's `-Onone`**, and the
build script built Debug, so nothing anyone ran was optimised. An unnamed level is not a
decision; it is the template default surviving unread, and it read as an oversight for exactly as
long as nobody looked. That is the lesson worth carrying to a new toolchain: **the setting a
build never names is the one nobody has decided.**

## What optimisation was worth

Release cost roughly 1.6x the wall clock of a Debug build from cold. On the seven paths #963
measured, it bought **1.1x to 1.4x on six, and 2.9x on a warm whole-session walk**. Per-path
milliseconds are on [#998](https://github.com/milad-alizadeh/argo/issues/998) with the machine
and load average beside them; they are one dated reading, not a property of the app.

The multiplier was small because **those paths were mostly not Argo's code** — SwiftUI hosting
and Core Text, which are optimised in both configurations, so `-Onone` inflated only Argo's own
share. The path where release won big was almost entirely Argo's own Swift.

Which is the shape of the warning, and it outlives the language: **a small average multiplier is
not a licence to size a budget in a debug build.** The next hot path that is all your own code
reads 3x, and it is ratios and counts that survive either way (ADR-0028, Rules 3 and 7).

## The measurement trap, which is not Swift-specific

**Interleave the arms and take the least of N** — debug, release, debug, release — never one arm
to completion and then the other. A machine stepping its clock or picking up a neighbour drifts
over a run, and a sequential layout lands all of that drift on whichever arm was in flight. The
first attempt here ran three debug passes then three release passes and read a path as *slower*
optimised, purely because the load average had gone from 131 to 215 in between.

Two companions to it. **Run it on a quiet machine**, which is not this laptop, and on a shared
box only the fold between the arms binds rather than either absolute. And **refuse a run in which
any named figure went missing from any arm**, because an env-gated suite quietly not running
looks exactly like a fast one.
