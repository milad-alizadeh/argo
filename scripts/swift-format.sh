#!/bin/sh
# SwiftFormat over the paths given, run from the repo root by lint-staged. The Swift half
# of what `biome check --write` does for TypeScript: it rewrites the files in place and
# lint-staged re-stages them.
#
# Absent tooling is a skip, not a failure — CI is Linux and a TypeScript-only contributor
# has no Swift toolchain (same call as scripts/swift-lint.sh).
set -eu

if ! command -v swiftformat >/dev/null 2>&1; then
  echo "swift-format: swiftformat not installed — skipping (brew install swiftformat)" >&2
  exit 0
fi

exec swiftformat --config apps/macOS/.swiftformat "$@"
