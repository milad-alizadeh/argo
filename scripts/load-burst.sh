#!/bin/sh
# A bounded CPU load burst, for reproducing the load-sensitive test failures of #918.
#
#   sh scripts/load-burst.sh 8 60     # 8 workers, for at MOST 60 seconds
#
# CRASH-SAFE BY CONSTRUCTION, which is the whole reason it exists rather than a one-line
# `yes` loop. Diagnosing #918 left twelve unbounded spinners saturating this Mac for eight
# hours, because a watchdog killed the shell before it reached its own `kill` line: three
# agent sessions stalled on the machine they had made slow, and every measurement taken in
# that window — this ticket's included — had to be thrown away.
#
# So the deadline belongs to each WORKER, not to this script. A worker holds the end time
# and re-reads the clock itself, so an orphan whose parent is gone still stops on time. The
# trap is the early exit; it is not what makes this safe.
set -eu

workers=${1:?usage: load-burst.sh <workers> <seconds>}
seconds=${2:?usage: load-burst.sh <workers> <seconds>}

# A burst is a measurement, never a soak. The ceiling is a backstop against a typo, since
# the cost of getting this wrong is hours of everyone else's machine.
if [ "$seconds" -gt 600 ]; then
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
