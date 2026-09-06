#!/bin/sh
# Catch the cockpit's main thread while it is stuck, and say what it is stuck ON.
#
#   sh scripts/hang-sample.sh            # watch, and dump a full sample when main stops drawing
#   sh scripts/hang-sample.sh --once     # sample right now, whatever the app is doing
#   sh scripts/hang-sample.sh --pid 123  # sample THAT copy, when several are running
#
# A hang is only ever diagnosed from the stack that was on the main thread AT THE TIME. This
# takes a one-second `sample` every few seconds and reads how much of it the main thread spent
# parked in the run loop. An app that is fine parks there for nearly the whole second; one that
# is hung is somewhere else for all of it, and the third consecutive busy reading writes the
# whole sample out.
#
# `sample` needs no permission for a process of your own user, and it does not stop the app.
#
# Every worktree builds its own `Release/Argo.app` and they all carry the process name `Argo`, so
# the NAME does not identify a build and `ARGO_HANG_APP` cannot separate two of them. The path
# can, and it is the only thing that can — which is why nothing below resolves a target silently
# and no line names a pid without naming the executable behind it (#1560).
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

# The executable behind a pid, empty when the process is gone. `run-release.sh` decides which
# copy it may end off exactly this, and the two tools have to mean the same thing by a target.
executable_of() {
  ps -o comm= -p "$1" 2>/dev/null || true
}

# Every live process whose executable is named `$APP`, as `pid<TAB>path`.
#
# `ps`, not `pgrep -x "$APP"`, which is what this used and which does not answer here at all: with
# two Argos running, `ps -Ao ucomm=` names both and `pgrep -x Argo` exits 1 on the pair. A finder
# that silently finds nothing is the same class of bug as one that silently picks wrong, so the
# candidate list comes from the command that also carries the path — one answer, not two.
#
# A process that is exiting is listed by `ps` as `(Argo)`, parentheses and all, so it does not
# match the name and drops out here. Nothing can be sampled off one anyway.
candidates() {
  ps -Ao pid=,comm= | awk -v app="$APP" '
    {
      pid = $1
      sub(/^ *[0-9]+ +/, "")
      name = $0
      sub(/^.*\//, "", name)
      if (name == app) printf "%s\t%s\n", pid, $0
    }
  '
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

once=0
chosen=""
while [ "$#" -gt 0 ]; do
  case $1 in
    --once) once=1 ;;
    --pid)
      shift
      chosen=${1:-}
      if [ -z "$chosen" ]; then
        echo "hang-sample: --pid needs a process id" >&2
        exit 1
      fi
      ;;
    *)
      echo "hang-sample: unknown argument '$1'; --once and --pid are the only ones" >&2
      exit 1
      ;;
  esac
  shift
done

# A caller who names a pid gets that pid, and nothing else is consulted — the point of the flag is
# to settle an ambiguity this script cannot settle for them. It is still resolved to a path,
# because a target nobody can name is the bug either way.
if [ -n "$chosen" ]; then
  pid=$chosen
  exe=$(executable_of "$pid")
  if [ -z "$exe" ]; then
    echo "hang-sample: pid $chosen is not running" >&2
    exit 1
  fi
else
  found=$(candidates)
  count=$(printf '%s' "$found" | grep -c . || true)
  if [ "$count" -eq 0 ]; then
    echo "hang-sample: no process named $APP is running" >&2
    exit 1
  fi
  # Whichever the kernel happens to list first is not an answer. `head -1` here reported on one
  # worktree's build while the caller read it as another's, twice in one afternoon (#1560).
  if [ "$count" -gt 1 ]; then
    echo "hang-sample: more than one process named $APP is running:" >&2
    printf '%s\n' "$found" | while IFS="$(printf '\t')" read -r one path; do
      printf '  %s  %s\n' "$one" "$path" >&2
    done
    echo "hang-sample: name the one you mean with --pid <id>" >&2
    exit 1
  fi
  pid=$(printf '%s' "$found" | cut -f1)
  exe=$(printf '%s' "$found" | cut -f2-)
fi

if [ "$once" -eq 1 ]; then
  echo "hang-sample: sampling pid $pid at $exe"
  out=$OUT_DIR/sample-$(date +%Y%m%d-%H%M%S).txt
  if ! /usr/bin/sample "$pid" "$SAMPLE_SECONDS" -file "$out" >/dev/null 2>&1; then
    echo "hang-sample: sample could not read pid $pid" >&2
    exit 1
  fi
  echo "hang-sample: main thread parked $(idle_percent "$out")% of the sample"
  report "$out"
  exit 0
fi

echo "hang-sample: watching pid $pid at $exe; samples in $OUT_DIR"
echo "hang-sample: stop with Ctrl-C"

busy=0
while :; do
  # The watch follows the process it named, not the name it was given: re-resolving by name would
  # let a second build take the watch over mid-run and say nothing about the swap.
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "hang-sample: pid $pid has gone"
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
