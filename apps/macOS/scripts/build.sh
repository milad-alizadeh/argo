#!/bin/sh
# `xcodebuild` for the app target, wired into `bun run build` through turbo.
#
# The project signs automatically against a real Apple Development identity (#627), which the
# CI runners do not have and cannot be given — the build there fails on the certificate before
# it compiles a line. Signing is dropped when no codesigning identity is installed, so the CI
# job still checks what it is there to check: that the app target compiles.
#
# The condition is the certificate, not the runner, because a contributor without one is the
# same case. A machine that has an identity builds exactly as Xcode does.
#
# `ARGO_BUILD_CONFIGURATION` picks the configuration — `debug` (the default) or `release`, and
# nothing else, for the reasons in `docs/agents/build-configurations.md` (#998).
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$APP_DIR"

# The per-step memory, and the one place the shared cache roots are spelled (#1377). The
# module cache below is the machine's, not this worktree's: `-derivedDataPath build` keeps two
# lanes from writing one build directory, and took the module cache in with it, so each of 75
# worktrees precompiled the same SwiftUI and Foundation modules for itself.
# shellcheck source=scripts/gate-cache.sh
. "$APP_DIR/../../scripts/gate-cache.sh"
# shellcheck source=scripts/metrics.sh
. "$APP_DIR/../../scripts/metrics.sh"
# shellcheck source=scripts/build-lock.sh
. "$APP_DIR/../../scripts/build-lock.sh"

case "${ARGO_BUILD_CONFIGURATION:-debug}" in
  debug) configuration=Debug ;;
  release) configuration=Release ;;
  *)
    echo "build: ARGO_BUILD_CONFIGURATION must be debug or release," \
      "got '$ARGO_BUILD_CONFIGURATION'" >&2
    exit 1
    ;;
esac

if security find-identity -p codesigning -v 2>/dev/null | grep -q "Apple Development"; then
  signing=""
else
  echo "build: no codesigning identity — building unsigned" >&2
  signing="CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= DEVELOPMENT_TEAM="
fi

# Has this exact tree already been built? (#1377)
#
# The same duplicate `swift-test.sh` closes: an agent builds the app to look at it, and then
# the pre-push gate builds it again. Unlike a suite, though, a build has a PRODUCT, and a
# verdict says nothing about whether that product is still on disk — `worktree-gc --artifacts`
# may have swept it since. So the recorded pass is believed only when the app is there to
# point at, and the two conditions are checked together.
BUILD_KEY=$(step_key "xcodebuild:$configuration" apps/macOS)
PRODUCT="build/Build/Products/$configuration/Argo.app"
if step_cached "$BUILD_KEY" && [ -d "$PRODUCT" ]; then
  echo "build: $configuration is up to date for this tree ($(step_recorded_at "$BUILD_KEY"))"
  metric_append step "xcodebuild:$configuration" hit 0 0
  exit 0
fi

# One of the machine's build slots (#1377), after the cache check above for the reason
# `swift-gate.sh` gives at its own call: a run with nothing to do must not queue behind a run
# that has.
build_lock_acquire

BUILD_STARTED=$(metric_now)
# shellcheck disable=SC2086 # $signing is a deliberate argument list, empty when signing stays on.
xcodebuild -project Argo.xcodeproj -scheme Argo -configuration "$configuration" \
  -derivedDataPath build "MODULE_CACHE_DIR=$ARGO_SWIFT_CACHE_DIR/modules" build $signing

# Only a build that produced the app counts. `xcodebuild` exiting 0 having written nothing is
# not a build, and a verdict recorded for it would skip the next one too.
[ -d "$PRODUCT" ] || {
  echo "build: xcodebuild exited 0 but wrote no $PRODUCT" >&2
  exit 1
}
step_record "$BUILD_KEY" "xcodebuild:$configuration" apps/macOS
metric_append step "xcodebuild:$configuration" run \
  "$(($(metric_now) - BUILD_STARTED))" "$BUILD_LOCK_WAITED"
