#!/bin/sh
# A bounded CPU load burst, for reproducing the load-sensitive test failures of #918.
#
#   sh scripts/load-burst.sh 8 60     # 8 workers, for at MOST 60 seconds
#
# THE DEADLINE BELONGS TO EACH WORKER, not to this script: a worker holds the end time and
# re-reads the clock itself, so one orphaned by a killed parent still stops on time. The
# trap is the early exit; it is not what makes this safe. `load-burst.test.mjs` is what
# holds that invariant, because a deadline lifted into the parent would read as a tidy-up.
set -eu

workers=${1:?usage: load-burst.sh <workers> <seconds>}
seconds=${2:?usage: load-burst.sh <workers> <seconds>}

# Both arguments are capped, because the mistake this guards against is transposing them:
# `load-burst.sh 600 8` forks 600 spinners if only the seconds are checked.
cores=$(sysctl -n hw.ncpu 2>/dev/null || echo 8)
if [ "$workers" -lt 1 ] || [ "$workers" -gt $((cores * 4)) ]; then
  echo "load-burst: refusing $workers workers; $((cores * 4)) is the ceiling" >&2
  exit 1
fi
if [ "$seconds" -lt 1 ] || [ "$seconds" -gt 600 ]; then
  echo "load-burst: refusing $seconds seconds; 600 is the ceiling" >&2
  exit 1
fi

deadline=$(($(date +%s) + seconds))
pids=""
trap 'kill $pids 2>/dev/null || true' EXIT INT TERM

worker=0
while [ "$worker" -lt "$workers" ]; do
  # Spin in batches so the clock is read once per batch rather than once per turn: `date`
  # is a fork, and a worker that spends its life forking loads the scheduler, not the CPU.
  # The batch is also the overshoot — a worker stops within one of them of the deadline.
  (
    while [ "$(date +%s)" -lt "$deadline" ]; do
      turn=0
      while [ "$turn" -lt 50000 ]; do turn=$((turn + 1)); done
    done
  ) &
  pids="$pids $!"
  worker=$((worker + 1))
done

echo "load-burst: $workers workers, stopping in ${seconds}s whatever happens to this shell"
wait
