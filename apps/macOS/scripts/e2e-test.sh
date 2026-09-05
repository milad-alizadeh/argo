#!/bin/sh
# Drive the real app through XCUITest — the only tests here that launch Argo and click it.
#
# Usage, from apps/macOS:
#   sh scripts/e2e-test.sh
#
# Every other Swift test in this repo is a SwiftPM package test. Those can build a projection and
# assert on it, but they cannot launch the app and they cannot click, so a view that renders
# correctly in a specimen and comes apart inside a popover passes all of them. That is not
# hypothetical: it is what shipped, and this target is the answer to it.
#
# A LOCAL gate, deliberately not a CI one. Driving the real app needs a macOS runner, the most
# expensive minutes GitHub bills, and it would take them on every push to walk a handful of
# clicks. Run this when you touch the drawer or the toolbar.
#
# FIRST RUN ON A NEW MACHINE IS INTERACTIVE. macOS gates UI testing behind a system
# authorisation prompt ("Authentication cancelled. System authentication is running." is what a
# refused or unanswered one looks like). Nothing here can grant it — answer the dialog once and
# subsequent runs are unattended. A locked or sleeping display fails the same way, because the
# runner cannot drive a screen that is not there.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$APP_DIR"

# shellcheck source=scripts/build-lock.sh
. "$APP_DIR/../../scripts/build-lock.sh"

# One of the machine's build slots (#1377), held for the whole run. `xcodebuild test` compiles and
# then drives the app in one invocation, so there is no seam to release at — and this is the run
# that least wants a neighbour anyway: it holds the real keyboard and mouse, and a build stealing
# cores under it turns a click that arrives late into a test failure.
build_lock_acquire

# Match the host: a UI test runs the app it built, and an arch mismatch reports as a launch
# failure rather than as the configuration error it is.
ARCH=$(uname -m)

xcodebuild test \
  -project Argo.xcodeproj \
  -scheme Argo \
  -configuration Debug \
  -destination "platform=macOS,arch=$ARCH" \
  -derivedDataPath build \
  "$@"
