#!/bin/sh
# Measure the feed's frame cadence under a scripted drag — the repeatable half of #516, so that
# "scrolling is smooth" is a number somebody else can reproduce rather than an impression.
#
# Usage, from apps/macOS:
#   sh scripts/feed-fps.sh                                   # feedAtScale, BOTH widths, 6s × 3
#   sh scripts/feed-fps.sh feedAtScale 760x900 6              # one width
#   ARGO_FPS_PIXELS=40 ARGO_FPS_DRAGS=5 sh scripts/feed-fps.sh
#   ARGO_FPS_TRANSCRIPT=~/.claude/projects/…/x.jsonl sh scripts/feed-fps.sh   # a REAL session
#
# `ARGO_FPS_TRANSCRIPT` measures the cockpit against a transcript on this machine instead of the
# fixture, and it is not interchangeable with the default: the same fix that holds `feedAtScale` at
# 0.4% dropped holds a real 4,000-line session at 2.1—2.6%, because real turns carry far more prose
# per row. The fixture is therefore the OPTIMISTIC case, and a gate that only ever reads it would
# wave through a regression that had doubled what a reader actually feels. It stays opt-in because
# the file is per-machine and cannot be committed — a repeatable default has to be the fixture.
#
# Two exit codes, and the difference between them matters more than either: **1** means measured and
# past the floor (a regression), **2** means it could not be measured at all (no app, no frames, no
# Accessibility permission). Collapsing the two lets an infrastructure failure read as a clean run
# or as a regression, and both readings are wrong.
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
SIZE=${2:-both}
SECONDS_TO_DRAG=${3:-6}
PIXELS=${ARGO_FPS_PIXELS:-30}
TICKS=${ARGO_FPS_TICKS:-60}
DRAGS=${ARGO_FPS_DRAGS:-3}
TRANSCRIPT=${ARGO_FPS_TRANSCRIPT:-}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
OUT_DIR=${ARGO_FPS_OUT:-$SCRIPT_DIR/../out/fps}
mkdir -p "$OUT_DIR"

# Named, so a run against a real session cannot be mistaken for a fixture run in the log directory
# or in whatever a reader pastes into a ticket. Truncated because a transcript's name is a uuid and
# the first segment already tells two of them apart.
if [ -n "$TRANSCRIPT" ]; then
  [ -f "$TRANSCRIPT" ] || { echo "feed-fps: no transcript at $TRANSCRIPT" >&2; exit 2; }
  SUBJECT="real-$(basename "$TRANSCRIPT" .jsonl | cut -c1-8)"
else
  SUBJECT="$SPECIMEN"
fi

# `both` is the default because the target is stated at TWO widths, and a claim about smoothness
# taken at one of them is a claim about one column. The narrow one is the deck at its tightest, the
# wide one the deck a reader actually spreads out in; a fix can help one and cost the other.
#
# BOTH legs run whatever the first one did. Under `set -e` a bare pair of calls stops at the first
# failure, so the width that was never measured reads as the width that was fine — and the leg most
# likely to fail first is the narrow one, which is the tighter claim. Each status is kept and the
# worse of the two decides the exit: unmeasurable beats regressed, because a number nobody took is
# not evidence about the floor.
if [ "$SIZE" = both ]; then
  narrow=0
  wide=0
  sh "$0" "$SPECIMEN" 760x900 "$SECONDS_TO_DRAG" || narrow=$?
  sh "$0" "$SPECIMEN" 1600x1000 "$SECONDS_TO_DRAG" || wide=$?
  # Spelled as `if` rather than `[ … ] || [ … ] && exit`: under `set -e` the status of that list is
  # the status of the last test it actually ran, so the both-fine case exits the script as a failure.
  if [ "$narrow" -eq 2 ] || [ "$wide" -eq 2 ]; then
    exit 2
  fi
  if [ "$narrow" -ne 0 ] || [ "$wide" -ne 0 ]; then
    exit 1
  fi
  exit 0
fi

RUN="$SUBJECT-$SIZE"
LOG="$OUT_DIR/$RUN.frames"
: >"$LOG"

# A leg of `both` inherits whatever the previous leg left behind, and `screenshot.sh` gives up
# waiting for a quit after five seconds and launches anyway — at which point `open` activates the
# instance that is still terminating, the driver finds no window, and the width goes unmeasured. So
# the wait for the previous app to be GONE happens here, before the launch that would race it.
wait_for_quit() {
  attempt=0
  while pgrep -x Argo >/dev/null 2>&1 && [ "$attempt" -lt 40 ]; do
    attempt=$((attempt + 1))
    sleep 0.25
  done
}

wait_for_quit

# `ARGO_KEEP_RUNNING` is what leaves the app up to be dragged; without it the launch quits itself
# the moment the screenshot lands and the driver finds nothing to scroll.
#
# `ARGO_SPECIMEN` is set only when there is no transcript: a specimen renders INSTEAD of the
# cockpit, so passing both would measure the fixture while claiming a real session.
ARGO_SPECIMEN=$([ -n "$TRANSCRIPT" ] || echo "$SPECIMEN") \
ARGO_TRANSCRIPT_PATH="$TRANSCRIPT" \
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

# Checked rather than assumed. Every failure below this line is reported by the driver on stderr and
# the run still prints a percentile table from whatever the log happens to hold — so the one thing
# that must not be silent is the app not being there at all.
if ! pgrep -x Argo >/dev/null 2>&1; then
  echo "$RUN: Argo is not running — nothing was measured" >&2
  exit 2
fi

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
#
# It EXITS NON-ZERO when p95 is past the floor, so this is a gate and not a readout. A script that
# only ever prints is a script whose regression somebody has to notice.
sort -n "$LOG.drag" | awk -v run="$RUN" '
  { ms[NR] = $1; if ($1 > 16.667) dropped++ }
  END {
    if (NR == 0) { print run ": no frames recorded — check Accessibility permission"; exit 2 }
    p95 = ms[int(NR * 0.95 + 0.999)]
    printf "%s  frames=%d  p50=%.2f  p95=%.2f  worst=%.2f  dropped=%d (%.1f%%)\n", \
      run, NR, ms[int(NR * 0.5 + 0.999)], p95, ms[NR], \
      dropped + 0, (dropped + 0) * 100 / NR
    if (p95 > 16.667) { print run ": p95 is past the 60fps floor."; exit 1 }
  }
'
