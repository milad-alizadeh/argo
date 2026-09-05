#!/bin/sh
# A machine-wide cap on how many Swift builds run at once. Sourced, never executed.
#
# `xcodebuild` and `swift build` each fan out to every core on the machine, because each one
# is written as though it owns it. Eight lanes doing that on a twelve-core Mac does not make
# eight builds go at once; it makes all eight go about eight times slower and finishes none
# of them sooner. Measured while #1377 was written: load average 178 on 12 cores, 25
# concurrent `swift-frontend` and `xcodebuild` processes, and `swift-boundaries.sh` taking
# 43 s of wall-clock for 29 s of CPU — a third of its life waiting for a core.
#
# The cap is a count of slots, not a single mutex, because one build does not saturate the
# machine on its own and a strict mutex would idle cores between a lane's link and the next
# lane's parse. Two is the default for a twelve-core machine. Raise it with
# ARGO_BUILD_LOCK_SLOTS on a bigger one.
#
# Usage, from a POSIX shell script:
#
#   . "$(dirname "$0")/build-lock.sh"
#   build_lock_acquire            # blocks until a slot is free; releases on exit
#
# The lock lives outside every worktree, because it is a fact about the MACHINE. A per-tree
# lock would be no lock at all: the lanes it has to hold apart are in different trees.
#
# A slot is held for a process TREE, not a process. `swift-gate.sh` takes one and then runs
# `bun run build` and `bun run test`, each a child that sources this file — so a second
# acquire would make one gate occupy two of the two slots, and two gates would each hold one
# and then wait forever for the other's. The holder exports ARGO_BUILD_LOCK_HELD_BY; every
# descendant reads it and runs inside the slot already paid for.

BUILD_LOCK_ROOT=${ARGO_BUILD_LOCK_ROOT:-${TMPDIR:-/tmp}/argo-build-lock}
BUILD_LOCK_SLOTS=${ARGO_BUILD_LOCK_SLOTS:-2}
BUILD_LOCK_HELD=""
# Seconds this process spent waiting for a slot, for the caller to record. A cap that made
# things slower would show up here and nowhere else: every other number would just say the
# gate took longer, without saying it was queueing rather than working.
BUILD_LOCK_WAITED=0

# Release the slot this process holds, if any. Idempotent, so the EXIT trap and an explicit
# call cannot double-free a slot another process has since taken.
build_lock_release() {
  [ -n "$BUILD_LOCK_HELD" ] || return 0
  rm -rf "$BUILD_LOCK_HELD"
  BUILD_LOCK_HELD=""
  # Cleared with the slot, not left behind: a script that releases and then acquires again is
  # asking for a second slot, and an inherited marker would silently hand it none.
  unset ARGO_BUILD_LOCK_HELD_BY
}

# Install this lock's cleanup for signal $1, KEEPING whatever handler is already there, and
# appending `exit $2` when one is given.
#
# Chaining rather than clobbering, because `trap … EXIT` inside a function replaces the
# script-level one. `swift-test.sh` removes its xunit report directory in an EXIT trap set long
# before it asks for a slot, and a plain `trap 'build_lock_release' EXIT` here leaked one temp
# directory per run — on the very path the cap was added to cover, and on no other, since a
# caller that inherits a slot returns above without reaching this.
#
# `trap` with no arguments prints the handler it currently holds, one line per signal, in a form
# this reads back. The caller's handler runs AFTER the slot is freed and BEFORE the exit, so a
# slow cleanup never keeps the next lane waiting.
_bl_chain() {
  _bl_sig=$1
  _bl_exit=$2
  _bl_old=$(trap | sed -n "s/^trap -- '\(.*\)' $_bl_sig\$/\1/p")
  _bl_cmd='build_lock_release'
  [ -n "$_bl_old" ] && _bl_cmd="$_bl_cmd; $_bl_old"
  [ -n "$_bl_exit" ] && _bl_cmd="$_bl_cmd; exit $_bl_exit"
  trap "$_bl_cmd" "$_bl_sig"
}

# Take one of $BUILD_LOCK_SLOTS slots, waiting as long as it takes.
#
# It NEVER fails the caller. A lock is a throughput device, and a gate that refused to run
# because it could not write a lock directory would be a gate turned off by a full disk —
# which is exactly the condition this whole change exists to relieve.
build_lock_acquire() {
  # Already inside a slot this process tree paid for. Not an error and not a wait: the caller
  # is the `bun run build` that a gate holding a slot just started, and the machine is already
  # counting it.
  #
  # The holder has to still be RUNNING for that to be true. `build_lock_release` can only unset
  # the variable in its own shell, so a child spawned before the release keeps the exported
  # value for ever — and would then build uncapped, permanently, with nothing to notice. The
  # pid is in the marker, so proving it is one signal.
  if [ -n "${ARGO_BUILD_LOCK_HELD_BY:-}" ] && kill -0 "$ARGO_BUILD_LOCK_HELD_BY" 2>/dev/null; then
    return 0
  fi

  if ! mkdir -p "$BUILD_LOCK_ROOT" 2>/dev/null; then
    echo "build-lock: cannot create $BUILD_LOCK_ROOT — running unserialised" >&2
    return 0
  fi

  _bl_waited=0
  while :; do
    _bl_slot_index=1
    while [ "$_bl_slot_index" -le "$BUILD_LOCK_SLOTS" ]; do
      _bl_slot="$BUILD_LOCK_ROOT/slot-$_bl_slot_index"

      # `mkdir` is the atomic primitive here. macOS ships no `flock`, and the alternatives
      # (a lock FILE tested and then written) have a window between the test and the write
      # that two lanes starting together will find.
      if mkdir "$_bl_slot" 2>/dev/null; then
        echo $$ > "$_bl_slot/pid"
        BUILD_LOCK_HELD="$_bl_slot"
        BUILD_LOCK_WAITED=$_bl_waited
        ARGO_BUILD_LOCK_HELD_BY=$$
        export ARGO_BUILD_LOCK_HELD_BY
        _bl_chain EXIT ''
        _bl_chain INT 130
        _bl_chain TERM 143
        return 0
      fi

      # A slot whose holder is gone. A gate killed with SIGKILL, or a machine restarted
      # mid-build, leaves the directory behind, and nothing else would ever clear it.
      _bl_holder=$(cat "$_bl_slot/pid" 2>/dev/null) || _bl_holder=""
      if [ -n "$_bl_holder" ]; then
        kill -0 "$_bl_holder" 2>/dev/null || rm -rf "$_bl_slot"
      elif _bl_fresh=$(find "$_bl_slot" -mmin -5 -print -quit 2>/dev/null) &&
        [ -z "$_bl_fresh" ]; then
        # No pid file at all. That is either a slot half a second old, whose holder is
        # between the `mkdir` and the `echo`, or one whose holder died in that same window
        # and will never write it. Five minutes tells them apart.
        #
        # The probe has to SUCCEED before its silence counts. A `find` that errored also
        # prints nothing, and taking that for "old" would hand this slot to a second lane
        # while the first is building in it — so the reaping branch is the one that needs
        # the evidence, and the waiting branch is where an unknown answer goes.
        rm -rf "$_bl_slot"
      fi

      _bl_slot_index=$((_bl_slot_index + 1))
    done

    # Say something once a minute. A silent wait is indistinguishable from a hang, and the
    # first thing a person does to a gate that looks hung is take the skip.
    if [ $((_bl_waited % 60)) -eq 0 ] && [ "$_bl_waited" -gt 0 ]; then
      echo "build-lock: waiting for one of $BUILD_LOCK_SLOTS build slots (${_bl_waited}s)" >&2
    fi
    sleep 5
    _bl_waited=$((_bl_waited + 5))
  done
}
