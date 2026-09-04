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
else
  # A git pathspec glob spans '/', so ':(exclude)*.md' drops nested markdown too.
  # Kept identical to ci.yml's `changes` job.
  if [ -z "$(git diff --name-only "$BASE...HEAD" -- \
       apps/macOS 'scripts/swift-*.sh' package.json turbo.json \
       .github/workflows/ci.yml .github/actions/setup ':(exclude)*.md')" ]; then
    echo "swift-gate: nothing in the Swift scope changed — skipping"
    exit 0
  fi
fi

# Every skip in the three Swift shell scripts becomes a failure.
ARGO_REQUIRE_SWIFT_TOOLS=1
export ARGO_REQUIRE_SWIFT_TOOLS

echo "swift-gate: SwiftFormat · SwiftLint · module boundaries"
bun run quality:swift

echo "swift-gate: build"
bun run build --filter=@argo/macos

echo "swift-gate: swift tests"
bun run test --filter=@argo/macos
