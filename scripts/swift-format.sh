#!/bin/sh
# SwiftFormat over the paths given, run from the repo root by lint-staged. The Swift half
# of what `biome check --write` does for TypeScript: it rewrites the files in place and
# lint-staged re-stages them.
#
# `--check` inverts that into a verdict — SwiftFormat's own `--lint`, which reformats
# nothing and exits non-zero on any file it would have changed. That is the mode CI runs,
# where rewriting the tree would be a change nobody asked for and nobody would see.
#
# Absent tooling is a skip, not a failure — CI is Linux and a TypeScript-only contributor
# has no Swift toolchain (same call as scripts/swift-lint.sh). ARGO_REQUIRE_SWIFT_TOOLS
# reverses that for the one job where a missing binary must never read as a pass.
set -eu

APP_DIR="apps/macOS"

lint=""
if [ "${1:-}" = "--check" ]; then
  lint="--lint"
  shift
fi

if ! command -v swiftformat >/dev/null 2>&1; then
  if [ -n "${ARGO_REQUIRE_SWIFT_TOOLS:-}" ]; then
    echo "swift-format: swiftformat not installed, and ARGO_REQUIRE_SWIFT_TOOLS is set" >&2
    exit 1
  fi
  echo "swift-format: swiftformat not installed — skipping (brew install swiftformat)" >&2
  exit 0
fi

# No paths means the whole app: what a tree-wide check asks for, and what lint-staged never
# does (it always names the staged files).
if [ "$#" -eq 0 ]; then
  set -- "$APP_DIR"
fi

# shellcheck disable=SC2086 # $lint is one optional flag, not a path list
exec swiftformat $lint --config "$APP_DIR/.swiftformat" "$@"
