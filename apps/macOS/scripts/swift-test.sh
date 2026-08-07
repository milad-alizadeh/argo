#!/bin/sh
# `swift test` for ArgoEngine, wired into `bun run test` through turbo.
#
# It skips rather than fails where Swift cannot run, because that is the normal case for
# this repo's CI: CI is Linux, where there is no Swift toolchain and no xcodebuild, and a
# root `bun run test` must stay green there. A skip prints why, so a missing toolchain
# never reads as a passing suite.
set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  echo "swift-test: not macOS — skipping the Swift suites (CI is Linux; they run locally)"
  exit 0
fi

if ! command -v swift >/dev/null 2>&1; then
  echo "swift-test: no Swift toolchain — skipping the Swift suites (install Xcode to run them)"
  exit 0
fi

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)

# Both packages, not just the engine: ArgoUI carries the visual contract's tests (#375), and
# a `test` script that silently covered one of the two would be worse than none.
for package in ArgoEngine ArgoUI; do
  echo "swift-test: $package"
  (cd "$APP_DIR/Packages/$package" && swift test)
done
