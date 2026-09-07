#!/usr/bin/env python3
"""Frame-time band of one probe run, with the launch discarded.

`FrameProbeSummary` reports over the whole window, and the whole window includes the app
starting up: a 3.3s cold-start stall lands in p99 and buries whatever the run was about. The
summary keeps every frame's wall clock, so the band can be recomputed over the settled part.

It also keeps every root body evaluation on that same clock, which is the multiplier on every
per-pass cost in the cockpit. A fold priced at a few hundred microseconds is free at one pass a
second and is the whole frame budget at sixty, so the band is reported beside it rather than on
its own.

    python3 scripts/frame-band.py <probe.json> [warmup-seconds]

Prints as JSON so a caller can ratio two runs without re-parsing prose.
"""
import json
import math
import sys


def busiest_second(stamps):
    """The most stamps inside any one-second window. A burst that straddles a whole-second
    boundary is still a burst, so this walks rather than buckets."""
    stamps = sorted(stamps)
    busiest = opening = 0
    for closing, stamp in enumerate(stamps):
        while stamps[opening] < stamp - 1:
            opening += 1
        busiest = max(busiest, closing - opening + 1)
    return busiest


def nearest_rank(ranked, fraction):
    """The percentile `FrameProbeSummary` reports, spelled the same way: nearest-rank over the
    sorted values, which needs no interpolation and never invents a value no sample had. A
    midpoint or a floor here would disagree with the summary the file was reduced from, and the
    two figures are read side by side."""
    if not ranked:
        return 0
    rank = math.ceil(fraction * len(ranked)) - 1
    return ranked[min(max(rank, 0), len(ranked) - 1)]


def band(path, warmup):
    summary = json.load(open(path))
    stamps = summary["timestamps"]
    if len(stamps) < 2:
        return {"error": f"{path}: {len(stamps)} frames, nothing to measure"}
    start = stamps[0] + warmup
    settled = [t for t in stamps if t >= start]
    if len(settled) < 2:
        return {"error": f"{path}: nothing after {warmup}s of warm-up"}
    gaps = sorted(
        (later - earlier) * 1000.0 for earlier, later in zip(settled, settled[1:])
    )
    budget = summary["frameBudgetMS"]
    span = settled[-1] - settled[0]
    # Older summaries predate the counter. Absent is reported as absent rather than as zero,
    # which would read as a cockpit that never redrew.
    counted = summary.get("passes")
    pass_stamps = (counted or {}).get("stamps", [])
    pass_costs = summary.get("passCosts", {}).get("eachMS", [])
    # Zipped only when the two arrays agree in length. A `zip` over a summary that carries the
    # stamps but not the costs truncates to nothing and reports zero passes, which is the same
    # "a cockpit that never redrew" reading the line above exists to avoid.
    if len(pass_costs) != len(pass_stamps):
        pass_costs = []
    passes = [at for at in pass_stamps if at >= start]
    costs = [
        cost for at, cost in zip(pass_stamps, pass_costs) if at >= start
    ]
    reduced = {
        "file": path,
        "warmupSeconds": warmup,
        "frames": len(settled),
        "wallSeconds": round(span, 2),
        "effectiveFPS": round(len(settled) / span, 2) if span else 0,
        "p50MS": round(nearest_rank(gaps, 0.50), 2),
        "p95MS": round(nearest_rank(gaps, 0.95), 2),
        "p99MS": round(nearest_rank(gaps, 0.99), 2),
        "maxMS": round(gaps[-1], 2),
        # The dropped-frame proxy, as a share rather than a count, so runs of unequal
        # length compare.
        "overBudgetShare": round(
            sum(1 for gap in gaps if gap > budget * 1.5) / len(gaps), 4
        ),
        "stallMSPerSecond": round(
            sum(gap - budget for gap in gaps if gap > budget * 1.5) / span, 2
        )
        if span
        else 0,
    }
    if counted is None:
        reduced["bodyPasses"] = None
        return reduced
    reduced["bodyPasses"] = len(passes)
    reduced["bodyPassesPerSecond"] = round(len(passes) / span, 2) if span else 0
    reduced["peakBodyPassesPerSecond"] = busiest_second(passes)
    # What the reader is actually asking: is a pass paid per frame, or many per frame? At or
    # under 1 the cockpit re-derives less often than it draws.
    reduced["passesPerFrame"] = round(len(passes) / len(settled), 2) if settled else 0
    if costs:
        ranked = sorted(costs)
        reduced["bodyPassMedianMS"] = round(nearest_rank(ranked, 0.50), 2)
        reduced["bodyPassMaxMS"] = round(ranked[-1], 2)
        # The share of every second the main thread spends re-deriving the window. This is the
        # number that says whether to make the pass cheaper or to make it rarer.
        reduced["bodyPassMSPerSecond"] = round(sum(costs) / span, 2) if span else 0
    return reduced


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    warmup = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
    print(json.dumps(band(sys.argv[1], warmup), indent=2))
