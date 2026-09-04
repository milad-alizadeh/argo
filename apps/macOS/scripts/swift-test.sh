#!/bin/sh
# `swift test` for ArgoEngine, wired into `bun run test` through turbo.
#
# It skips rather than fails where Swift cannot run, because that is the normal case for
# this repo's CI: the default jobs are Linux, with no Swift toolchain and no xcodebuild, and
# a root `bun run test` must stay green there. The macOS CI job is the one place a skip
# would instead read as a passing suite, and swift-tool-guard.sh is what stops it.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)

# Every package with a test target, not just the engine: ArgoUI carries the visual contract's
# tests (#375), ArgoMermaid the renderer's layout suites (#1087) and ArgoAtlas the map's (#1143).
# A `test` script that silently covered some of them would be worse than none.
ALL_PACKAGES='ArgoEngine ArgoUI ArgoMermaid ArgoAtlas'

# `swift-test.sh [Package…] [--filter PATTERN]` narrows the inner loop, and the point of routing a
# narrow run through here is `verdict` below: `swift test --filter` FAILS OPEN (#1358). It matches
# type names, not the `@Suite` display names, so `--filter "Minimap reshape"` selects nothing, runs
# 0 tests and exits 0 — a fast loop that reports success for a pattern that never found the suite
# it named. `verdict` already refuses a 0-test report per package, and a filtered run inherits it.
#
# Which is why a filter has to name its package. Unfiltered, all four run and each must report
# tests. Filtered, the three packages the pattern does not live in would each report nothing, and
# the guard that makes the filter safe would fire on them instead of on a typo.
PACKAGES=''
FILTER=''
while [ $# -gt 0 ]; do
  case "$1" in
    --filter)
      [ $# -ge 2 ] || { echo "swift-test: --filter takes a pattern" >&2; exit 1; }
      FILTER=$2
      shift 2
      ;;
    --filter=*)
      FILTER=${1#--filter=}
      shift
      ;;
    -*)
      echo "swift-test: unknown option $1" >&2
      exit 1
      ;;
    *)
      case " $ALL_PACKAGES " in
        *" $1 "*) PACKAGES="$PACKAGES $1" ;;
        *)
          echo "swift-test: $1 is not one of: $ALL_PACKAGES" >&2
          exit 1
          ;;
      esac
      shift
      ;;
  esac
done

if [ -n "$FILTER" ] && [ -z "$PACKAGES" ]; then
  echo "swift-test: --filter needs a package, one of: $ALL_PACKAGES" >&2
  echo "swift-test: e.g. sh scripts/swift-test.sh ArgoUI --filter MinimapReshapeTests" >&2
  exit 1
fi
[ -n "$PACKAGES" ] || PACKAGES=$ALL_PACKAGES

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
    if [ -n "$FILTER" ]; then
      # The fail-open case this guard exists for: `swift test` selected nothing and exited 0.
      # Naming the pattern is the whole message, because the pattern is what was wrong.
      echo "swift-test: $1 matched no test for --filter $FILTER — nothing ran" >&2
      echo "swift-test: --filter matches type names, not the names in @Suite(\"…\")" >&2
    else
      echo "swift-test: $1 reported 0 tests — nothing ran" >&2
    fi
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

for package in $PACKAGES; do
  echo "swift-test: $package ($CONFIGURATION)${FILTER:+ filtered to $FILTER}"
  status=0
  # The report path stays third, ahead of the configuration flags: swift-tooling.test.mjs stubs
  # `swift` positionally, and a stub that wrote nowhere would pass by reporting nothing. The
  # filter goes last, so an unfiltered run's argv is the one those tests already assert on.
  # shellcheck disable=SC2086 # CONFIGURATION_FLAGS is a word list, not one argument.
  (cd "$APP_DIR/Packages/$package" &&
    swift test --xunit-output "$REPORT_DIR/$package.xml" $CONFIGURATION_FLAGS \
      ${FILTER:+--filter "$FILTER"}) ||
    status=$?
  # The STATUS first. A compile failure or a signalled `swift` never reaches a report, and
  # `verdict`'s "wrote no test report" would bury the reason it did not.
  if [ "$status" -ne 0 ]; then
    echo "swift-test: $package exited $status" >&2
    exit "$status"
  fi
  verdict "$package"
done
