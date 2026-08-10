#!/bin/sh
# Drive the real app through XCUITest on THIS machine's screen — the only tests here that launch
# Argo and click it.
#
# THIS RUN TAKES YOUR MOUSE AND KEYBOARD for its whole length. XCUITest drives the real
# WindowServer; there is no headless mode to switch on, so for as long as the suite runs the
# pointer and the keys belong to it and not to whoever is sitting at the machine. That is why this
# is NOT the default path any more: `scripts/e2e-test.sh` routes to a VM, and you reach this script
# either through `e2e-test.sh --host` or by calling it directly, both of which are deliberate acts.
#
# Usage, from apps/macOS:
#   sh scripts/e2e-host.sh                      # seizes this machine's screen
#   sh scripts/e2e-test.sh --host               # the same run, reached through the router
#   sh scripts/e2e-host.sh -only-testing:ArgoE2ETests/ProjectDrawerE2ETests
#
# It is also what runs INSIDE the guest: `e2e-vm.sh` syncs the tree and calls this script over ssh,
# where seizing the screen is exactly what you want because the screen is not yours. That is the
# whole trick, and it is why the router and the runner are two files — `e2e-test.sh` calling the VM
# and the VM calling `e2e-test.sh` would be a loop with no bottom.
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
