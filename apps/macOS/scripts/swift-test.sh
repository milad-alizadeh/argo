#!/bin/sh
# `swift test` for ArgoEngine, wired into `bun run test` through turbo.
#
# It skips rather than fails where Swift cannot run, because that is the normal case for
# this repo's CI: CI is Linux, where there is no Swift toolchain and no xcodebuild, and a
# root `bun run test` must stay green there. A skip prints why, so a missing toolchain
# never reads as a passing suite.
set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  echo "swift-test: not macOS — skipping ArgoEngine (CI is Linux; the suite runs locally)"
  exit 0
fi

if ! command -v swift >/dev/null 2>&1; then
  echo "swift-test: no Swift toolchain — skipping ArgoEngine (install Xcode to run it)"
  exit 0
fi

cd "$(dirname "$0")/../Packages/ArgoEngine"
exec swift test
