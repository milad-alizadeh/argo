#!/bin/sh
# The test suites that read a CLOCK, for the phase `swift-test.sh` runs them alone in (#1711).
#
# A call to one of `CostMeasure`'s four helpers is what puts a suite here, not the file's name:
# `FeedRowShapeTests` measures and is in the set, `MinimapCostTests` counts and is not.
#
# The name printed is the suite's TYPE name, because that is what `swift test --filter` matches
# and the `@Suite("…")` display name is not (#1358). Here that is the file's own name, and
# `scripts/timing-suites.test.mjs` refuses a file where it is not.
#
# Usage: sh scripts/timing-suites.sh <package-dir>
set -eu

PACKAGE_DIR=${1:?timing-suites: takes one package directory}
[ -d "$PACKAGE_DIR/Tests" ] || exit 0

# `(` or a trailing-closure `{`, so a helper NAMED in a doc comment — three suites cite
# `cpuSeconds` to explain why they measure counts instead — is not mistaken for a call to one.
CLOCK_CALL='(leastCPUSeconds|pairedCPUSeconds|cpuSeconds|elapsedSeconds)[[:space:]]*[({]'

# One `grep` over the whole target rather than one per file: `ArgoUI` has 450 test files, and a
# process each cost about two seconds of CPU against 0.25s for this. It is paid per package on
# every unfiltered run, cache hits included, so it has to stay in that order of magnitude.
#
# `|| true`, because `grep -l` exits 1 when it matched nothing and `find -exec … +` hands that
# status on — the ordinary answer for a package whose budgets are all counts, and `set -e` would
# take it for a failure.
CLOCK_FILES=$(
  find "$PACKAGE_DIR/Tests" -name '*.swift' -type f -exec grep -lE "$CLOCK_CALL" {} + || true
)
[ -n "$CLOCK_FILES" ] || exit 0

# `LC_ALL=C`, because the default collation is the SHELL's: `FeedRowShapeTests` and
# `FeedRowsCompareCostTests` swap places between a login shell and one with a stripped
# environment, and a pattern that depends on its caller is one no test can assert on.
printf '%s\n' "$CLOCK_FILES" | while read -r file; do
  # `CostMeasure.swift` defines the helpers and holds no test of its own.
  grep -q '@Test' "$file" || continue
  basename "$file" .swift
done | LC_ALL=C sort
