#!/bin/sh
# Catch the cockpit's main thread while it is stuck, and say what it is stuck ON.
#
#   sh scripts/hang-sample.sh            # watch, and dump a full sample when main stops drawing
#   sh scripts/hang-sample.sh --once     # sample right now, whatever the app is doing
#
# A hang is only ever diagnosed from the stack that was on the main thread AT THE TIME. This
# takes a one-second `sample` every few seconds and reads how much of it the main thread spent
# parked in the run loop. An app that is fine parks there for nearly the whole second; one that
# is hung is somewhere else for all of it, and the third consecutive busy reading writes the
# whole sample out.
#
# `sample` needs no permission for a process of your own user, and it does not stop the app.
set -eu

APP=${ARGO_HANG_APP:-Argo}
OUT_DIR=${ARGO_HANG_OUT:-${TMPDIR:-/tmp}/argo-hang}
INTERVAL=${ARGO_HANG_INTERVAL:-3}
SAMPLE_SECONDS=${ARGO_HANG_SECONDS:-1}
# Below this percentage of the second parked in the run loop, the main thread is working rather
# than drawing. Deliberately low: a busy but responsive app still parks often.
IDLE_FLOOR=${ARGO_HANG_IDLE_FLOOR:-15}
BUSY_BEFORE_DUMP=3

mkdir -p "$OUT_DIR"

pid_of_app() {
  pgrep -x "$APP" 2>/dev/null | head -1
}

# The call graph's first thread block is the main thread; `sample` labels it. Everything up to
# the next thread header belongs to it.
main_thread_stack() {
  awk '
    /main-thread/ { inside = 1 }
    inside && /Thread_/ && seen { exit }
    inside { seen = 1; print }
  ' "$1"
}

# What fraction of the main thread's samples sat in a run-loop or lock wait. Every line of a
# call graph starts with its sample count behind some tree drawing, so the count is whatever
# number the line opens with once that is stripped.
idle_percent() {
  main_thread_stack "$1" | awk '
    { line = $0; sub(/^[^0-9]*/, "", line); count = line + 0 }
    /Thread_/ && total == 0 { total = count }
    /mach_msg2_trap|__psynch_cvwait|__psynch_mutexwait|kevent_id|__ulock_wait/ { idle += count }
    END { if (total > 0) printf "%d", (idle * 100) / total; else printf "0" }
  '
}

report() {
  echo "hang-sample: wrote $1"
  echo "hang-sample: main thread ---"
  main_thread_stack "$1" | head -45
}

pid=$(pid_of_app || true)
if [ -z "${pid:-}" ]; then
  echo "hang-sample: no process named $APP is running" >&2
  exit 1
fi

if [ "${1:-}" = "--once" ]; then
  out=$OUT_DIR/sample-$(date +%Y%m%d-%H%M%S).txt
  /usr/bin/sample "$pid" "$SAMPLE_SECONDS" -file "$out" >/dev/null 2>&1
  echo "hang-sample: main thread parked $(idle_percent "$out")% of the sample"
  report "$out"
  exit 0
fi

echo "hang-sample: watching $APP (pid $pid); samples in $OUT_DIR"
echo "hang-sample: stop with Ctrl-C"

busy=0
while :; do
  pid=$(pid_of_app || true)
  if [ -z "${pid:-}" ]; then
    echo "hang-sample: $APP has gone"
    exit 0
  fi
  probe=$OUT_DIR/probe.txt
  if ! /usr/bin/sample "$pid" "$SAMPLE_SECONDS" -file "$probe" >/dev/null 2>&1; then
    sleep "$INTERVAL"
    continue
  fi
  idle=$(idle_percent "$probe")
  if [ "$idle" -lt "$IDLE_FLOOR" ]; then
    busy=$((busy + 1))
    echo "hang-sample: main thread parked ${idle}% ($busy in a row)"
  else
    busy=0
  fi
  if [ "$busy" -ge "$BUSY_BEFORE_DUMP" ]; then
    out=$OUT_DIR/hang-$(date +%Y%m%d-%H%M%S).txt
    /usr/bin/sample "$pid" 5 -file "$out" >/dev/null 2>&1 || true
    report "$out"
    busy=0
  fi
  sleep "$INTERVAL"
done
