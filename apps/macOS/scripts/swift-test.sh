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

# `ARGO_TEST_CONFIGURATION=release` runs the same suites against the optimiser. Debug is
# `-Onone`, so a cost budget recorded there bounds code nobody ships (#991) — and a release run
# is the only way to re-record one, which ADR-0028's Consequences require before the seconds-side
# budgets bind.
#
# It defines DEBUG anyway, and that is not a contradiction: every counter the budgets read is
# `#if DEBUG`, so without it the test target does not COMPILE in release — and a count is
# identical under `-Onone` and `-O`, being control flow. The only thing `-O` moves is the
# seconds, which is the whole point of running it. What makes the flag honest is that all 18
# `#if DEBUG` blocks under `Packages/*/Sources` are additive — not one has an `#else` — so
# defining it adds counters and changes no behaviour. An `#else` added there would break that,
# and nothing checks it.
CONFIGURATION=${ARGO_TEST_CONFIGURATION:-debug}
case "$CONFIGURATION" in
  debug) CONFIGURATION_FLAGS='' ;;
  release) CONFIGURATION_FLAGS='-c release -Xswiftc -DDEBUG' ;;
  *)
    echo "swift-test: ARGO_TEST_CONFIGURATION is debug or release, not $CONFIGURATION" >&2
    exit 1
    ;;
esac

REPORT_DIR=$(mktemp -d)
trap 'rm -rf "$REPORT_DIR"' EXIT INT TERM

# Sum one integer attribute over every `<testsuite>` in the reports named.
sum_attribute() {
  # shellcheck disable=SC2086
  grep -ho '<testsuite [^>]*>' $2 |
    grep -o "$1=\"[0-9]*\"" |
    grep -o '[0-9]*' |
    awk '{ total += $1 } END { print total + 0 }'
}

# `swift test` EXITS 0 ON A FAILED RUN (#918). Its status therefore proves nothing, and the
# "Test run with N tests ... failed" line it prints is prose — a human signal, and the only
# reason any of #918's flakes were ever noticed. The xUnit report is the honest one, because
# it carries the counts as DATA. Fail closed on all three ways it can be absent: no report,
# a report of no tests, and a report of failures.
verdict() {
  found=$(find "$REPORT_DIR" -type f -name "$1*.xml")
  if [ -z "$found" ]; then
    echo "swift-test: $1 wrote no test report — the run never got that far" >&2
    return 1
  fi
  tests=$(sum_attribute tests "$found")
  bad=$(($(sum_attribute failures "$found") + $(sum_attribute errors "$found")))
  if [ "$tests" -eq 0 ]; then
    echo "swift-test: $1 reported 0 tests — nothing ran" >&2
    return 1
  fi
  if [ "$bad" -ne 0 ]; then
    echo "swift-test: $1 reported $bad failure(s) across $tests tests" >&2
    return 1
  fi
  # "reported" rather than "ran": a skipped suite is in neither the report nor this number,
  # so it sits BELOW the count in `swift test`'s own summary line.
  echo "swift-test: $1 clean, 0 failures across $tests reported tests"
}

# Every package with a test target, not just the engine: ArgoUI carries the visual contract's
# tests (#375) and ArgoMermaid the renderer's layout suites (#1087). A `test` script that
# silently covered some of them would be worse than none.
for package in ArgoEngine ArgoUI ArgoMermaid; do
  echo "swift-test: $package ($CONFIGURATION)"
  status=0
  # The report path stays third, ahead of the configuration flags: swift-tooling.test.mjs stubs
  # `swift` positionally, and a stub that wrote nowhere would pass by reporting nothing.
  # shellcheck disable=SC2086 # CONFIGURATION_FLAGS is a word list, not one argument.
  (cd "$APP_DIR/Packages/$package" &&
    swift test --xunit-output "$REPORT_DIR/$package.xml" $CONFIGURATION_FLAGS) ||
    status=$?
  # The STATUS first. A compile failure or a signalled `swift` never reaches a report, and
  # `verdict`'s "wrote no test report" would bury the reason it did not.
  if [ "$status" -ne 0 ]; then
    echo "swift-test: $package exited $status" >&2
    exit "$status"
  fi
  verdict "$package"
done
