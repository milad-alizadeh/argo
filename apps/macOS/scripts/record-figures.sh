#!/bin/sh
# Re-records the seconds-side figures `ArgoUITests/PerfBudgets` carries (ADR-0028 Rule 7), by
# running `MinimapFigureRecording` in both configurations, INTERLEAVED, and taking the least of
# N rounds per arm.
#
# Interleaved because a box drifts over a run — thermally, and as it picks up a neighbour. Five
# debug rounds followed by five release ones read the measure pass as SLOWER optimised, purely
# because the load average went from 131 to 215 in between (#998). Least of N because CPU noise
# is one-sided: a miss, a fault, a frequency step and a preemption only ever ADD (`CostMeasure`).
#
# It asserts no second and never will; the fold between its two arms is the whole of what it can
# check, and why is stated once, at `PerfBudgets.figureMachine`.
#
#   sh apps/macOS/scripts/record-figures.sh              # five interleaved rounds
#   ARGO_FIGURE_ROUNDS=1 sh apps/macOS/scripts/record-figures.sh
#
# Run it on a QUIET machine. `.github/workflows/figures.yml` is the one this repo has.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)

# shellcheck source=scripts/swift-tool-guard.sh
. "$APP_DIR/../../scripts/swift-tool-guard.sh"
# shellcheck source=scripts/build-lock.sh
. "$APP_DIR/../../scripts/build-lock.sh"

if [ "$(uname -s)" != "Darwin" ]; then
  swift_unavailable "not macOS" "the harness measures AppKit and Core Text"
fi

if ! command -v swift >/dev/null 2>&1; then
  swift_unavailable "no Swift toolchain" "install Xcode to record the figures"
fi

ROUNDS=${ARGO_FIGURE_ROUNDS:-5}
case "$ROUNDS" in
  '' | *[!0-9]* | 0)
    echo "record-figures: ARGO_FIGURE_ROUNDS is a round count, not $ROUNDS" >&2
    exit 1
    ;;
esac

# The figures the harness records, named HERE and not derived from what a run printed. A case that
# fails, throws or is skipped in BOTH arms prints nothing at all, and a set built from what arrived
# cannot miss what never arrived — the same hole `swift test` exiting 0 on a failed run leaves
# (#918). A renamed figure fails this run until the list moves with it, which is the direction the
# drift should break in.
#
# One line, in two pieces: awk's `-v` refuses a raw newline in a value, and finds out at the far
# end of a twenty-minute run.
FIGURES='feed-measure-pass-cold session-reading-warm band-paint-cold band-paint-warm'
FIGURES="$FIGURES sixty-scrolled-frames thirty-seam-frames markdown-band-cold"

# The arms, named once. The summary counts each figure per arm, so an arm added here and not
# there would be an arm nothing checks — the same silent gap the list above closes.
ARMS='debug release'

READINGS=$(mktemp)
ROUND_OUT=$(mktemp)
trap 'rm -f "$READINGS" "$ROUND_OUT"' EXIT INT TERM

cd "$APP_DIR/Packages/ArgoUI"

# Both configurations are BUILT before either is timed. A compile landing beside a measurement is
# the loudest neighbour a run can have, and it is the one neighbour this script owns.
# The release arm carries `-enable-testing` because the suites are `@testable`: SwiftPM turns it on
# for a debug build and not for a release one, so without it the release arm stops at
# `module 'ArgoUI' was not compiled for testing` and the run ends having measured one arm.
RELEASE='-c release -Xswiftc -DDEBUG -Xswiftc -enable-testing'

# One of the machine's build slots (#1377), and held past the builds through the timed rounds
# rather than released after them. This script asks for a quiet machine in its own usage note,
# and a cap that let go the moment the compile finished would hand the next lane a core in the
# middle of the measurement — the loudest neighbour a run can have, arriving by the one door
# this repo can close.
build_lock_acquire

echo "record-figures: building both configurations"
swift build --build-tests
# shellcheck disable=SC2086 # RELEASE is a word list, not one argument.
swift build --build-tests $RELEASE

round=1
while [ "$round" -le "$ROUNDS" ]; do
  # shellcheck disable=SC2086 # ARMS is a word list, which is the point of it being one.
  for configuration in $ARMS; do
    case "$configuration" in
      debug) flags='' ;;
      release) flags="$RELEASE" ;;
    esac
    echo "record-figures: round $round of $ROUNDS ($configuration)"
    status=0
    # `--filter` so nothing but the harness runs: every other suite in this package is a count,
    # and a count costs the measurement its quiet.
    #
    # shellcheck disable=SC2086 # flags is a word list, not one argument.
    ARGO_RECORD_FIGURES=1 swift test --filter MinimapFigureRecording $flags \
      >"$ROUND_OUT" 2>&1 || status=$?
    cat "$ROUND_OUT"
    if [ "$status" -ne 0 ]; then
      echo "record-figures: swift exited $status in round $round ($configuration)" >&2
      exit "$status"
    fi
    # `swift test` EXITS 0 ON A FAILED RUN (#918), so its status proves nothing here either. What
    # this script believes instead is the figures themselves: a case that failed, crashed or was
    # skipped prints no line, and the completeness check below is what reads that.
    awk -v arm="$configuration" '/FIGURE /{ sub(/^.*FIGURE /, ""); print arm, $0 }' \
      "$ROUND_OUT" >>"$READINGS"
  done
  round=$((round + 1))
done

# The suite is `.enabled(if:)` on `ARGO_RECORD_FIGURES`, so a run that never set it passes green
# having measured nothing — the shape of every machine-gated skip in this repo, and the one this
# script exists to make impossible.
if [ ! -s "$READINGS" ]; then
  echo "record-figures: not one figure printed across $ROUNDS rounds — the harness is gated on" \
    "ARGO_RECORD_FIGURES and this script sets it, so the suite did not run at all" >&2
  exit 1
fi

awk -v rounds="$ROUNDS" -v expected="$FIGURES" -v arms="$ARMS" \
  -f "$APP_DIR/scripts/record-figures.awk" "$READINGS"
