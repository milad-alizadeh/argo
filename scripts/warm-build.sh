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
{
  # One of the machine's build slots, taken INSIDE the background block.
  #
  # AGENTS.md tells every new Swift worktree to run this first, so on a morning where several
  # lanes are cut at once this is the single largest uncapped fan-out on the machine — four
  # packages of `swift build --build-tests`, each taking every core. Waiting here costs the
  # caller nothing, because the caller has already been handed its prompt back: a warm nobody
  # is waiting for is exactly the work that should yield to a build somebody is.
  build_lock_acquire

  # shellcheck disable=SC2086 # ARGO_BUILD_PACKAGES is a word list, not one argument.
  for package in $ARGO_BUILD_PACKAGES; do
    echo "warm: $package"
    (cd "$APP_DIR/Packages/$package" && swift build --build-tests) || echo "warm: $package failed"
  done
  echo "warm: done"
} >"$LOG" 2>&1 &

echo "warm: building the Swift test targets in the background, logging to $LOG"
echo "warm: it is finished when that file ends in 'warm: done'"
