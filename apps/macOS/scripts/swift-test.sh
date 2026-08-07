#!/bin/sh
# `swift test` for ArgoEngine, wired into `bun run test` through turbo.
#
# It skips rather than fails where Swift cannot run, because that is the normal case for
# this repo's CI: the default jobs are Linux, where there is no Swift toolchain and no
# xcodebuild, and a root `bun run test` must stay green there. A skip prints why, so a
# missing toolchain never reads as a passing suite.
#
# The macOS CI job is the one place where a skip WOULD read as a passing suite, since the
# job exists to run these tests and reports Success either way. It sets
# ARGO_REQUIRE_SWIFT_TOOLS, which turns both skips below into failures.
set -eu

skip_or_fail() {
  if [ -n "${ARGO_REQUIRE_SWIFT_TOOLS:-}" ]; then
    echo "swift-test: $1, and ARGO_REQUIRE_SWIFT_TOOLS is set" >&2
    exit 1
  fi
  echo "swift-test: $1 — skipping the Swift suites ($2)"
  exit 0
}

if [ "$(uname -s)" != "Darwin" ]; then
  skip_or_fail "not macOS" "the default CI jobs are Linux; they run locally"
fi

if ! command -v swift >/dev/null 2>&1; then
  skip_or_fail "no Swift toolchain" "install Xcode to run them"
fi

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)

# Both packages, not just the engine: ArgoUI carries the visual contract's tests (#375), and
# a `test` script that silently covered one of the two would be worse than none.
for package in ArgoEngine ArgoUI; do
  echo "swift-test: $package"
  (cd "$APP_DIR/Packages/$package" && swift test)
done
