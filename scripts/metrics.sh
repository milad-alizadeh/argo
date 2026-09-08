#!/bin/sh
# One line per thing that took time. Sourced, never run.
#
# #1377 changed six things about how the gate runs, and every one of them is the kind of change
# that FEELS faster. The measurements that motivated it — load average 178 on 12 cores, 104 GB
# of build output, 91 merges in a day — were taken by hand, once, and a claim nobody can
# re-measure is a claim that quietly stops being true.
#
# So each run appends a row here, and `scripts/gate-report.mjs` turns the rows into the numbers
# that say whether it worked. The file is a TSV outside every worktree, because the question
# "how long does the gate take on this machine" is about the machine, not about a branch.
#
# Columns, in order:
#   1 when            ISO 8601, UTC
#   2 event           gate | step | land
#   3 name            what ran: `gate`, `swift-test:ArgoUI:debug`, `xcodebuild:Debug`, `land:#12`
#   4 outcome         run | hit | skip | fail
#   5 seconds         wall-clock this run took
#   6 waited          seconds spent waiting for a build slot
#   7 branch          the branch it ran on
#   8 loadavg         one-minute load average when it started
#   9 free_gb         free space on the data volume when it started
#  10 arm             capped | uncapped when the cap A/B is on, `-` otherwise (#1440)
#  11 caller          `METRIC_CALLERS` below, or unknown (#1711)
#  12 phase           `METRIC_PHASES` below, or unknown (#1711)
#
# The arm is stamped at write time rather than worked out later, because "which runs were
# capped" is not recoverable from a timestamp: the arms alternate per run, and two lanes
# starting a second apart are in different ones.
#
# The caller and the phase are the same kind of fact, stamped for the same reason (#1711). An
# absent or unrecognised one reads `unknown` rather than being invented, so the report never
# states a caller nobody claimed (CONTEXT.md L2 · degrade-down).
#
# Nothing here is ever fatal, and nothing here is read back by the gate. A metrics file that
# could fail a push, or change what the gate decides, would be a liability rather than a record.

ARGO_METRICS_FILE=${ARGO_METRICS_FILE:-${ARGO_CACHE_ROOT:-${XDG_CACHE_HOME:-$HOME/Library/Caches}}/argo-gate/metrics.tsv}

# Seconds since the epoch, for timing a section: `started=$(metric_now)`.
metric_now() {
  date +%s
}

# The callers and phases a row can carry, and no others: recording an unrecognised word would
# let a typo look like a step. Who sets each: `docs/agents/quality-gates.md`.
METRIC_CALLERS='implement review ship push landing'
METRIC_PHASES='gate quality build correctness cost filtered'

# One of a closed set, or `unknown`. Never the word itself.
#
# The whitespace case first, because the membership test is a substring of a space-joined list:
# `ship push` sits inside ` implement review ship push landing ` and would be recorded whole,
# putting a caller in the file that no run had.
metric_word() {
  case $1 in
    '' | *[[:space:]]*)
      printf unknown
      return 0
      ;;
  esac
  case " $2 " in
    *" $1 "*) printf '%s' "$1" ;;
    *) printf unknown ;;
  esac
}

# metric_append <event> <name> <outcome> <seconds> <waited>
metric_append() {
  [ "${ARGO_METRICS:-on}" = off ] && return 0
  mkdir -p "$(dirname "$ARGO_METRICS_FILE")" 2>/dev/null || return 0

  _metric_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || _metric_branch=unknown
  # The one-minute load average, which is the number that says whether the machine was being
  # fought over while this ran.
  _metric_load=$(uptime | sed -n 's/.*load averages*: *\([0-9.]*\).*/\1/p')
  _metric_free=$(df -g /System/Volumes/Data 2>/dev/null | awk 'NR == 2 { print $4 }')

  # The arm, the caller and the phase are read off the environment rather than passed in, so
  # every existing `metric_append` call site keeps its five arguments and no caller has to know
  # any of the three exist.
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    "$1" "$2" "$3" "${4:-0}" "${5:-0}" \
    "${_metric_branch:-unknown}" "${_metric_load:-0}" "${_metric_free:-0}" \
    "${BUILD_LOCK_ARM:--}" \
    "$(metric_word "${ARGO_GATE_CALLER:-}" "$METRIC_CALLERS")" \
    "$(metric_word "${ARGO_GATE_PHASE:-}" "$METRIC_PHASES")" \
    >> "$ARGO_METRICS_FILE" 2>/dev/null || return 0
  return 0
}
