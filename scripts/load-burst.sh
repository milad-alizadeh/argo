#!/bin/sh
# A bounded CPU load burst, for reproducing the load-sensitive test failures of #918.
#
#   sh scripts/load-burst.sh 8 60     # 8 workers, for at MOST 60 seconds
#   sh scripts/load-burst.sh --reap <token>   # stop THIS run's workers, nothing else
#   sh scripts/load-burst.sh --orphans        # report ownerless spinners, kill nothing
#
# THE DEADLINE BELONGS TO EACH WORKER, not to this script: a worker holds the end time and
# re-reads the clock itself, so one orphaned by a killed parent still stops on time. The
# trap is the early exit; it is not what makes this safe. `load-burst.test.mjs` is what
# holds that invariant, because a deadline lifted into the parent would read as a tidy-up.
#
# Cleanup is scoped by TOKEN because several sessions share this machine: `pkill -f
# load-burst.sh` from one of them took out another's measurement run (#988), so --reap
# signals only the pids its own run recorded.
set -eu

CPU_THRESHOLD=50
run_dir=${TMPDIR:-/tmp}/argo-load-burst

# Ownerless CPU hogs: reparented to init (PPID 1) and still burning a core. Read-only by
# construction — it prints, and whoever reads it kills only what they recognise as theirs.
orphan_report() {
  ps -eo pid=,ppid=,pcpu=,command= 2>/dev/null |
    awk -v threshold="$CPU_THRESHOLD" '$2 == 1 && $3 + 0 >= threshold { print "  " $0 }' |
    cut -c 1-200
}

if [ "${1:-}" = "--orphans" ]; then
  found=$(orphan_report)
  if [ -z "$found" ]; then
    echo "load-burst: no PPID-1 process above ${CPU_THRESHOLD}% CPU"
    exit 0
  fi
  echo "load-burst: ownerless processes above ${CPU_THRESHOLD}% CPU — kill only your own:"
  echo "$found"
  echo "load-burst: lines are cut; the whole one is \`ps -o command= -p <pid>\`"
  exit 0
fi

if [ "${1:-}" = "--reap" ]; then
  token=${2:?usage: load-burst.sh --reap <token>}
  pidfile=$run_dir/$token.pids
  [ -f "$pidfile" ] || { echo "load-burst: no run recorded for $token" >&2; exit 1; }
  reaped=0
  while read -r pid; do
    # A recorded pid can have been reused since the run, so the command line is checked
    # before the signal: this must never kill something it did not start.
    case $(ps -o command= -p "$pid" 2>/dev/null) in
      *load-burst.sh*)
        if kill -9 "$pid" 2>/dev/null; then reaped=$((reaped + 1)); fi
        ;;
    esac
  done < "$pidfile"
  rm -f "$pidfile"
  echo "load-burst: reaped $reaped worker(s) of $token"
  exit 0
fi

workers=${1:?usage: load-burst.sh <workers> <seconds> [token]}
seconds=${2:?usage: load-burst.sh <workers> <seconds> [token]}
# The script's own pid is unique among live processes, which is all a token has to be.
token=${3:-$$}

# Both arguments are capped, because the mistake this guards against is transposing them:
# `load-burst.sh 600 8` forks 600 spinners if only the seconds are checked.
# `nproc` on Linux, `sysctl` on macOS. The fallback is deliberately small: guessing high on
# a box whose core count cannot be read is how a two-core runner ends up with 32 spinners.
cores=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)
if [ "$workers" -lt 1 ] || [ "$workers" -gt $((cores * 4)) ]; then
  echo "load-burst: refusing $workers workers; $((cores * 4)) is the ceiling" >&2
  exit 1
fi
if [ "$seconds" -lt 1 ] || [ "$seconds" -gt 600 ]; then
  echo "load-burst: refusing $seconds seconds; 600 is the ceiling" >&2
  exit 1
fi

already=$(orphan_report)
if [ -n "$already" ]; then
  echo "load-burst: WARNING — this machine already carries ownerless CPU hogs:" >&2
  echo "$already" >&2
fi

mkdir -p "$run_dir"
pidfile=$run_dir/$token.pids
: > "$pidfile"

deadline=$(($(date +%s) + seconds))
pids=""
trap 'kill $pids 2>/dev/null || true; rm -f "$pidfile"' EXIT INT TERM

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
  # Recorded as it forks, not at the end: a parent killed mid-loop has still left a
  # pidfile another session can reap, which is the case the token exists for.
  echo "$!" >> "$pidfile"
  worker=$((worker + 1))
done

echo "load-burst: $workers workers, stopping in ${seconds}s whatever happens to this shell"
echo "load-burst: token $token — early stop is \`load-burst.sh --reap $token\`, never pkill"
wait
