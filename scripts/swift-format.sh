#!/bin/sh
# SwiftFormat over the paths given, run from the repo root by lint-staged. The Swift half
# of what `biome check --write` does for TypeScript: it rewrites the files in place and
# lint-staged re-stages them.
#
# `--check` inverts that into a verdict — SwiftFormat's own `--lint`, which reformats
# nothing and exits non-zero on any file it would have changed. That is the mode CI runs,
# where rewriting the tree would be a change nobody asked for and nobody would see.
#
set -eu

APP_DIR="apps/macOS"

# shellcheck source=scripts/swift-tool-guard.sh
. "$(dirname "$0")/swift-tool-guard.sh"

lint=""
if [ "${1:-}" = "--check" ]; then
  lint="--lint"
  shift
fi

if ! command -v swiftformat >/dev/null 2>&1; then
  swift_unavailable "swiftformat not installed" "brew install swiftformat"
fi

# No paths means the whole app: what a tree-wide check asks for, and what lint-staged never
# does (it always names the staged files).
whole_tree=0
if [ "$#" -eq 0 ]; then
  set -- "$APP_DIR"
  whole_tree=1
fi

# A tree-wide CHECK is a verdict, and a verdict about content this one has already given is one
# it can read back (#1377). Only `--check`, and only over the whole tree: a rewrite has a
# product, and a run naming staged paths is asking about those paths.
if [ -n "$lint" ] && [ "$whole_tree" = 1 ]; then
  # shellcheck source=scripts/gate-cache.sh
  . "$(dirname "$0")/gate-cache.sh"
  # shellcheck source=scripts/metrics.sh
  . "$(dirname "$0")/metrics.sh"
  if step_begin swiftformat apps/macOS scripts; then
    echo "swift-format: this tree was checked at $STEP_SINCE — not checked again"
    exit 0
  fi
  # shellcheck disable=SC2086 # $lint is one optional flag, not a path list
  swiftformat $lint --config "$APP_DIR/.swiftformat" "$@"
  step_end swiftformat apps/macOS scripts
  exit 0
fi

# shellcheck disable=SC2086 # $lint is one optional flag, not a path list
exec swiftformat $lint --config "$APP_DIR/.swiftformat" "$@"
