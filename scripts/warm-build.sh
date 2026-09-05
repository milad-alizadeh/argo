#!/bin/sh
# `bun run warm` — the Swift test build, started in the background and left to finish.
#
# The largest single cost in the local gate is not a test (#1358). Every worktree gets its own
# `.build`, so the first `bun run test` in one spends about 52 seconds on ArgoUI alone and about
# two and a half minutes across the four packages before a line of test code runs. The suites
# themselves are 43 seconds.
#
# None of that has to be on anybody's critical path: a worktree is made minutes before its first
# test run, and the build has no input but the source already checked out. So this is the same
# work, started earlier — it makes nothing faster and removes nothing from the gate.
#
# Safe to run at any time and more than once. `swift build` takes the package's own lock, so a
# second run waits for the first rather than corrupting it, and a warm tree exits in a moment.
set -eu

APP_DIR=$(cd "$(dirname "$0")/../apps/macOS" && pwd)
# Absolute, because the worker below is this file re-entered and must not depend on the cwd
# it inherits. `${0##*/}` rather than `basename`: this line runs before the tool guard, and the
# stub harness gives the skip cases a PATH with no coreutils on it (found by those tests).
SELF=$(cd "$(dirname "$0")" && pwd)/${0##*/}

# shellcheck source=scripts/swift-tool-guard.sh
. "$(dirname "$0")/swift-tool-guard.sh"
# shellcheck source=scripts/build-lock.sh
. "$(dirname "$0")/build-lock.sh"

if [ "$(uname -s)" != "Darwin" ]; then
  swift_unavailable "not macOS" "there is nothing to warm without a Swift toolchain"
fi

if ! command -v swift >/dev/null 2>&1; then
  swift_unavailable "no Swift toolchain" "install Xcode to build the packages"
fi

LOG=${ARGO_WARM_LOG:-$APP_DIR/.build-warm.log}
mkdir -p "$(dirname "$LOG")"

# Backgrounded, so the shell that asked for it is free immediately — the whole point.
#
# Backgrounded, NOT detached: the job stays in the caller's process group, so a Ctrl-C at that
# terminal takes the warm with it. That is the wanted behaviour rather than a gap — the warm is
# for the session it was started in, and a build nobody is waiting for that survives the session
# is a `swift` holding the package lock against whoever opens the tree next. `nohup` here would
# buy outliving the terminal and cost exactly that.
#
# `--build-tests` because the test target is what the gate builds, and building only the library
# would leave half the cost still to pay.
#
# The work runs as this file RE-ENTERED as a real child process, not as a `{ … } &` group, and
# that is a correctness requirement rather than a tidying. Inside a backgrounded group `$$` is
# still the PARENT's pid and an EXIT trap never runs — both measured on this repo's `/bin/sh`.
# The build slot taken in the group was therefore recorded under a pid that exited seconds
# later, so the next lane to look reclaimed it as stale and built on top of the warm, and the
# slot was never released either. A child shell has its own `$$` and runs its traps.
if [ "${1:-}" = --worker ]; then
  # One of the machine's build slots (#1377), but NOT for ever (#1450).
  #
  # This worker is orphaned to pid 1 a second after it starts — the parent exits at once, which
  # is the whole point of warm — so nothing will ever reap it and nobody is waiting on it. Left
  # unbounded it queues behind lanes that started hours after it did, and when it finally wins a
  # slot it takes one from work somebody wants, to build a tree that has moved on. Thirty-three
  # of these had accumulated on one machine, the oldest three hours old, two of them naming a
  # worktree that had already been deleted; the queue they formed was most of why a gate could
  # sit 23 minutes waiting for a slot.
  #
  # Fifteen minutes against a warm that takes about two and a half. A refusal is not a failure
  # here: it means the machine is busy, which is exactly when the warm was never going to help.
  ARGO_BUILD_LOCK_WAIT_LIMIT=${ARGO_WARM_WAIT_LIMIT:-900}
  export ARGO_BUILD_LOCK_WAIT_LIMIT
  BUILD_LOCK_WAIT_LIMIT=$ARGO_BUILD_LOCK_WAIT_LIMIT
  if ! build_lock_acquire; then
    echo "warm: gave up waiting for a build slot — the machine is busy, so this was moot"
    exit 0
  fi

  # shellcheck disable=SC2086 # ARGO_BUILD_PACKAGES is a word list, not one argument.
  for package in $ARGO_BUILD_PACKAGES; do
    # The tree can be removed while this runs: a worktree is swept, or the session that asked
    # for the warm finished and cleaned up behind itself. Building on into a directory that is
    # gone spends a slot on nothing.
    if [ ! -d "$APP_DIR/Packages/$package" ]; then
      echo "warm: $APP_DIR is gone — stopping"
      exit 0
    fi
    echo "warm: $package"
    (cd "$APP_DIR/Packages/$package" && swift build --build-tests) || echo "warm: $package failed"
  done
  echo "warm: done"
  exit 0
fi

sh "$SELF" --worker >"$LOG" 2>&1 &

echo "warm: building the Swift test targets in the background, logging to $LOG"
echo "warm: it is finished when that file ends in 'warm: done'"
