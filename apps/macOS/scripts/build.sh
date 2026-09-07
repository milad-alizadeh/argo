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

# Has this exact tree already been built, HERE? (#1377)
#
# The same duplicate `swift-test.sh` closes: an agent builds the app to look at it, and then
# the pre-push gate builds it again. Unlike a suite, though, a build has a PRODUCT, and a
# verdict says nothing about whether that product is still on disk — `worktree-gc --artifacts`
# may have swept it since. So the recorded pass is believed only when the app is there to
# point at, and the two conditions are checked together.
#
# Two conditions were one too few. The step memory is the MACHINE's — one cache directory
# behind seventy-five worktrees, which is the whole point of keying on content — while the
# product is this checkout's alone. So a lane that built a tree left a verdict every other
# lane could read, and any of them standing on that same tree skipped its build and kept an
# app compiled from whatever it happened to have built last. `bun run build` said "up to date"
# over a two-day-old binary, which is worse than a slow build: the run that goes on to screenshot
# it, or to look at the fix, is reading a product no longer of this source.
#
# What closes it is a STAMP: the product is labelled with the key that produced it, next to
# the app rather than inside it, where the bundle's signature does not cover it. A verdict is
# then believed only when this worktree's own app carries the same key — the memory says the
# tree is built, the stamp says it is built here. The stamp is removed before `xcodebuild`
# runs and written after it succeeds, so a build interrupted in the middle leaves a product
# no key claims, which is the honest answer for a bundle half-replaced.
BUILD_KEY=$(step_key "xcodebuild:$configuration" apps/macOS)
PRODUCT="build/Build/Products/$configuration/Argo.app"
STAMP="build/Build/Products/$configuration/.argo-build-key"
if step_cached "$BUILD_KEY" && [ -d "$PRODUCT" ] &&
  [ "$(cat "$STAMP" 2>/dev/null)" = "$BUILD_KEY" ]; then
  echo "build: $configuration is up to date for this tree ($(step_recorded_at "$BUILD_KEY"))"
  metric_append step "xcodebuild:$configuration" hit 0 0
  exit 0
fi

# One of the machine's build slots (#1377), after the cache check above for the reason
# `swift-gate.sh` gives at its own call: a run with nothing to do must not queue behind a run
# that has.
build_lock_acquire

BUILD_STARTED=$(metric_now)
rm -f "$STAMP"
# shellcheck disable=SC2086 # $signing is a deliberate argument list, empty when signing stays on.
xcodebuild -project Argo.xcodeproj -scheme Argo -configuration "$configuration" \
  -derivedDataPath build "MODULE_CACHE_DIR=$ARGO_SWIFT_CACHE_DIR/modules" build $signing

# Only a build that produced the app counts. `xcodebuild` exiting 0 having written nothing is
# not a build, and a verdict recorded for it would skip the next one too.
[ -d "$PRODUCT" ] || {
  echo "build: xcodebuild exited 0 but wrote no $PRODUCT" >&2
  exit 1
}
# The stamp is written whatever the key is, empty included. An unkeyable run — the cache off,
# or a dirty tree — still replaces the product, and leaving the previous label on it would let
# a later run over that older tree read a verdict against an app that is no longer the one it
# describes. An empty stamp matches no key, because `step_cached` never hits on one.
printf '%s\n' "$BUILD_KEY" > "$STAMP"
step_record "$BUILD_KEY" "xcodebuild:$configuration" apps/macOS
metric_append step "xcodebuild:$configuration" run \
  "$(($(metric_now) - BUILD_STARTED))" "$BUILD_LOCK_WAITED"
