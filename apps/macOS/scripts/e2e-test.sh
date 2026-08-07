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
# FIRST RUN ON A NEW MACHINE IS INTERACTIVE. macOS gates UI testing behind a system
# authorisation prompt ("Authentication cancelled. System authentication is running." is what a
# refused or unanswered one looks like). Nothing here can grant it — answer the dialog once and
# subsequent runs are unattended. A locked or sleeping display fails the same way, because the
# runner cannot drive a screen that is not there.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$APP_DIR"

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
