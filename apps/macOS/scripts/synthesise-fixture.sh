#!/bin/sh
# Re-writes the checked-in synthetic of the largest Session from a real transcript (ADR-0030).
#
#   cp <a real transcript>.jsonl apps/macOS/Fixtures/settled-session.jsonl   # gitignored
#   sh apps/macOS/scripts/synthesise-fixture.sh
#
# It writes nothing when the synthetic reads as a different document from its source: the
# generator prints every counted fact that moved and exits non-zero.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)

# shellcheck source=scripts/swift-tool-guard.sh
. "$APP_DIR/../../scripts/swift-tool-guard.sh"

if [ "$(uname -s)" != "Darwin" ]; then
  swift_unavailable "not macOS" "the generator projects the feed, which needs AppKit"
fi

if ! command -v swift >/dev/null 2>&1; then
  swift_unavailable "no Swift toolchain" "install Xcode to regenerate the fixture"
fi

FIXTURES="$APP_DIR/Packages/ArgoUI/Sources/ArgoFixtures/Fixtures"

cd "$APP_DIR/Packages/ArgoUI"
swift run argo-synthesise "$FIXTURES"
