#!/bin/sh
# The macOS gate, run where the code is written.
#
# It is the `macos` job of .github/workflows/ci.yml, moved to the push. The job ran a
# `macos-26` runner on every push and every Swift-touching pull request, at about ten times
# the price of a Linux runner and about 99% of this repo's Actions bill (#1340). Every
# command below ran there, in this order, and runs here unchanged.
#
# It is the same gate, not a lighter one. What moved is where it runs, not what it checks:
#
#   - the same three commands, in the same order — the formatter first, because a reformat
#     changes what the linter reads;
#   - the same ARGO_REQUIRE_SWIFT_TOOLS=1, so a missing binary FAILS instead of skipping
#     green. A runner that checked nothing and said Success is the way a gate rots, and it
#     rots the same way on a laptop;
#   - the same scope. The pathspec below is the one ci.yml's `changes` job used, character
#     for character, so a markdown-only push skips the Swift work here exactly as it did
#     there. Change one and change the other.
#
# Called by .husky/pre-push. Run it by hand any time: `sh scripts/swift-gate.sh`.
set -e

GATE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=scripts/metrics.sh
. "$GATE_DIR/metrics.sh"
GATE_STARTED=$(metric_now)

# The base to compare against. pre-push passes the remote ref it is about to update; by hand
# there is none, so fall back to the fork point with main.
BASE="${1:-}"
if [ -z "$BASE" ]; then
  BASE=$(git merge-base HEAD origin/main 2>/dev/null || echo '')
fi

# No base at all — a first push of a branch the remote has never seen, or a shallow clone.
# Run the whole gate rather than guess at a scope. A gate that skips when it cannot tell is
# a gate that skips exactly when it is needed.
if [ -z "$BASE" ]; then
  echo "swift-gate: no base to diff against — running the full gate"
  CHANGED=""
else
  # A git pathspec glob spans '/', so ':(exclude)*.md' drops nested markdown too.
  # Kept identical to ci.yml's `changes` job.
  CHANGED=$(git diff --name-only "$BASE...HEAD" -- \
       apps/macOS 'scripts/swift-*.sh' package.json turbo.json \
       .github/workflows/ci.yml .github/actions/setup ':(exclude)*.md')
  if [ -z "$CHANGED" ]; then
    echo "swift-gate: nothing in the Swift scope changed — skipping"
    metric_append gate gate skip "$(($(metric_now) - GATE_STARTED))" 0
    exit 0
  fi
fi

# Every skip in the three Swift shell scripts becomes a failure.
ARGO_REQUIRE_SWIFT_TOOLS=1
export ARGO_REQUIRE_SWIFT_TOOLS


# Which packages this change can reach, through the package graph. ALL when the change is
# outside the packages at all, or when there was no base to diff against.
#
# The formatter, the linter, the boundary gate and the app build stay whole whatever this
# says. They are cheap next to the suites, they read the tree rather than a diff, and the app
# target links every package anyway — so scoping them would buy little and could hide a lot.
# What it scopes is the suites, which is where the duplicated work is: `swift test` builds
# each package again in its OWN scratch path, so four packages is four subgraphs compiled.
if [ -z "$CHANGED" ]; then
  PACKAGES=ALL
else
  PACKAGES=$(printf '%s\n' "$CHANGED" | sh "$GATE_DIR/swift-scope.sh")
fi

if [ "$PACKAGES" = ALL ]; then
  echo "swift-gate: the change reaches every package"
else
  # ARGO_TEST_SCOPE, not ARGO_TEST_PACKAGES: the latter is the constant list of packages that
  # HAVE tests, set by swift-tool-guard.sh, and writing it here would be overwritten a moment
  # later by the guard swift-test.sh sources before it reads anything.
  ARGO_TEST_SCOPE=$(printf '%s\n' "$PACKAGES" | tr '\n' ' ')
  export ARGO_TEST_SCOPE
  echo "swift-gate: the change reaches ${ARGO_TEST_SCOPE}"
fi

# Has this exact tree, under this exact scope, already passed? A rebase onto a base whose
# Swift content the branch does not touch produces a tree the gate has seen, and the honest
# answer to it is the one it gave before. The check comes BEFORE the build slot: a run with
# nothing to do must not queue behind a run that has.
# shellcheck source=scripts/gate-cache.sh
. "$GATE_DIR/gate-cache.sh"
GATE_KEY=$(gate_cache_key "$PACKAGES")
if gate_cache_hit "$GATE_KEY"; then
  echo "swift-gate: this tree passed the gate at $(gate_cache_read "$GATE_KEY") — nothing changed since"
  metric_append gate gate hit "$(($(metric_now) - GATE_STARTED))" 0
  exit 0
fi

# One of a fixed number of machine-wide build slots, held for the rest of this script. Every
# command below fans out to all twelve cores, and eight lanes doing that at once is how a
# gate that takes minutes comes to take an hour (#1377). Waiting here is not lost time: it
# is time the other lane was going to take from this one anyway.
# shellcheck source=scripts/build-lock.sh
. "$GATE_DIR/build-lock.sh"
build_lock_acquire

echo "swift-gate: SwiftFormat · SwiftLint · module boundaries"
bun run quality:swift

echo "swift-gate: build"
bun run build --filter=@argo/macos

echo "swift-gate: swift tests"
bun run test --filter=@argo/macos

# Only here, with `set -e` having let every command above pass. A verdict is recorded for the
# tree that earned it and for the scope it was earned under.
gate_cache_record "$GATE_KEY" "${PACKAGES}"

# What it cost, for `scripts/gate-report.mjs`. Last, because a row for a run that failed would
# be a row saying the gate takes less time than it does.
metric_append gate gate run "$(($(metric_now) - GATE_STARTED))" "$BUILD_LOCK_WAITED"
