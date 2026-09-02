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
# It asserts no second and never will. A hosted runner is a shared, virtualised box, so an
# absolute-seconds gate here would go red on the machine rather than on the code — #918's flake
# at CI scale. The one quantity it CAN hold is a quotient whose two halves are the same work in
# the same shape (ADR-0028 Rule 8): the optimiser fold, debug over release, of one figure. That
# check arms itself the day the figures are recorded on a quiet runner and says so until then.
#
#   sh apps/macOS/scripts/record-figures.sh              # five interleaved rounds
#   ARGO_FIGURE_ROUNDS=1 sh apps/macOS/scripts/record-figures.sh
#
# Run it on a QUIET machine. `.github/workflows/figures.yml` is the one this repo has.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)

# shellcheck source=scripts/swift-tool-guard.sh
. "$APP_DIR/../../scripts/swift-tool-guard.sh"

if [ "$(uname -s)" != "Darwin" ]; then
  swift_unavailable "not macOS" "the harness measures AppKit and Core Text"
fi

if ! command -v swift >/dev/null 2>&1; then
  swift_unavailable "no Swift toolchain" "install Xcode to record the figures"
fi

ROUNDS=${ARGO_FIGURE_ROUNDS:-5}
READINGS=$(mktemp)
ROUND_OUT=$(mktemp)
trap 'rm -f "$READINGS" "$ROUND_OUT"' EXIT INT TERM

cd "$APP_DIR/Packages/ArgoUI"

# Both configurations are BUILT before either is timed. A compile landing beside a measurement is
# the loudest neighbour a run can have, and it is the one neighbour this script owns.
echo "record-figures: building both configurations"
swift build --build-tests
swift build --build-tests -c release -Xswiftc -DDEBUG

round=1
while [ "$round" -le "$ROUNDS" ]; do
  for configuration in debug release; do
    case "$configuration" in
      debug) flags='' ;;
      release) flags='-c release -Xswiftc -DDEBUG' ;;
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

awk -v rounds="$ROUNDS" -f "$APP_DIR/scripts/record-figures.awk" "$READINGS"
