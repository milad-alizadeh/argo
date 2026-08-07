#!/bin/sh
# `swift test` for ArgoEngine, wired into `bun run test` through turbo.
#
# It skips rather than fails where Swift cannot run, because that is the normal case for
# this repo's CI: the default jobs are Linux, with no Swift toolchain and no xcodebuild, and
# a root `bun run test` must stay green there. The macOS CI job is the one place a skip
# would instead read as a passing suite, and swift-tool-guard.sh is what stops it.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)

# shellcheck source=scripts/swift-tool-guard.sh
. "$APP_DIR/../../scripts/swift-tool-guard.sh"

if [ "$(uname -s)" != "Darwin" ]; then
  swift_unavailable "not macOS" "the default CI jobs are Linux; the suites run locally"
fi

if ! command -v swift >/dev/null 2>&1; then
  swift_unavailable "no Swift toolchain" "install Xcode to run the suites"
fi

# Both packages, not just the engine: ArgoUI carries the visual contract's tests (#375), and
# a `test` script that silently covered one of the two would be worse than none.
for package in ArgoEngine ArgoUI; do
  echo "swift-test: $package"
  (cd "$APP_DIR/Packages/$package" && swift test)
done
