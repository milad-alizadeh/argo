#!/bin/sh
# Measure the feed's frame cadence under a scripted drag — the repeatable half of #516, so that
# "scrolling is smooth" is a number somebody else can reproduce rather than an impression.
#
# Usage, from apps/macOS:
#   sh scripts/feed-fps.sh                                   # feedAtScale, 1600x1000, 6s × 3
#   sh scripts/feed-fps.sh feedAtScale 760x900 6
#   ARGO_FPS_PIXELS=40 ARGO_FPS_DRAGS=5 sh scripts/feed-fps.sh
#
# It launches ONE named specimen at ONE fixed size with the frame meter on, drags the feed at a
# fixed cadence through `ScrollDriver.swift`, and reports p50 / p95 / worst / dropped over exactly
# the frames those drags produced. Same transcript, same width, same gesture, every run — which is
# the only reason two runs are comparable at all.
#
# SEVERAL drags in one launch, with the first thrown away, and that is not thoroughness — it is what
# makes the number mean anything. A single drag right after a launch disagreed with itself by a
# factor of twenty across consecutive runs (14.7% of frames dropped, then 0.3%), because it was
# still measuring the launch: caches cold, the window just resized, the build's writes still
# settling. The warm-up absorbs that, and the repeats say whether what is left is the feed or the
# machine.
#
# The numbers come out of the RAW intervals the app wrote, not off the HUD: the log is kept so a
# reported figure can be recomputed from what was actually observed. The idle stretches BETWEEN
# drags are cut out — a gap of quiet frames would dilute every percentage by however long it was.
#
# Two permissions, and neither can be granted from here. Screen Recording, for the screenshot the
# launch takes (`screenshot.sh`); Accessibility, for the synthetic scroll events — without the
# second, the events are dropped silently and the run reports a perfectly idle app.
set -eu

SPECIMEN=${1:-feedAtScale}
SIZE=${2:-1600x1000}
SECONDS_TO_DRAG=${3:-6}
PIXELS=${ARGO_FPS_PIXELS:-30}
TICKS=${ARGO_FPS_TICKS:-60}
DRAGS=${ARGO_FPS_DRAGS:-3}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
OUT_DIR=${ARGO_FPS_OUT:-$SCRIPT_DIR/../out/fps}
mkdir -p "$OUT_DIR"

RUN="$SPECIMEN-$SIZE"
LOG="$OUT_DIR/$RUN.frames"
: >"$LOG"

# `ARGO_KEEP_RUNNING` is what leaves the app up to be dragged; without it the launch quits itself
# the moment the screenshot lands and the driver finds nothing to scroll.
ARGO_SPECIMEN="$SPECIMEN" \
ARGO_WINDOW_SIZE="$SIZE" \
ARGO_FEED_FPS=1 \
ARGO_FEED_FPS_LOG="$LOG" \
ARGO_KEEP_RUNNING=1 \
  sh "$SCRIPT_DIR/screenshot.sh" "$OUT_DIR/$RUN.png" >/dev/null

# Activated and settled BEFORE the mark is taken. Raising a window is a hundred-millisecond frame
# and it is not a scroll — left inside the measured stretch it becomes the worst frame of every run
# and the number reported is the launch, not the drag. The driver activates too; by then it is a
# no-op.
osascript -e 'tell application "Argo" to activate' >/dev/null 2>&1 || true
sleep 3

drag() {
  before=$(wc -l <"$LOG" | tr -d ' ')
  swift "$SCRIPT_DIR/ScrollDriver.swift" Argo "$SECONDS_TO_DRAG" "$TICKS" "$PIXELS" >/dev/null
  # The app writes in batches, so the last fraction of a second is still in memory when the driver
  # stops. A beat lets it land before the slice is cut.
  sleep 1
  tail -n "+$((before + 1))" "$LOG"
}

drag >/dev/null
: >"$LOG.drag"
run=0
while [ "$run" -lt "$DRAGS" ]; do
  run=$((run + 1))
  drag >>"$LOG.drag"
done

osascript -e 'tell application "Argo" to quit' >/dev/null 2>&1 || true

# Sorted by `sort` rather than inside awk: `asort` is a gawk extension and this machine's awk is
# BSD's. Nearest-rank percentiles, matching `FrameReading` — the HUD and this script must not be
# able to report two different p95s for one run.
sort -n "$LOG.drag" | awk -v run="$RUN" '
  { ms[NR] = $1; if ($1 > 16.667) dropped++ }
  END {
    if (NR == 0) { print run ": no frames recorded — check Accessibility permission"; exit 1 }
    printf "%s  frames=%d  p50=%.2f  p95=%.2f  worst=%.2f  dropped=%d (%.1f%%)\n", \
      run, NR, ms[int(NR * 0.5 + 0.999)], ms[int(NR * 0.95 + 0.999)], ms[NR], \
      dropped + 0, (dropped + 0) * 100 / NR
  }
'
