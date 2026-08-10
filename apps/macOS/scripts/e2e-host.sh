#!/bin/sh
# Drive the real app through XCUITest on THIS machine's screen — the only tests here that launch
# Argo and click it.
#
# THIS RUN TAKES THE MOUSE AND KEYBOARD of whatever screen it runs on, for its whole length.
# XCUITest drives the real WindowServer and there is no headless mode to switch on, so the pointer
# and the keys belong to the suite and not to whoever is sitting at the machine.
#
# Which is why this is the RUNNER and not the entry point. `scripts/e2e-test.sh` is what you type;
# it routes to a VM unless asked for `--host`. Reaching this script means the screen being taken is
# either not yours (the guest) or yours by choice.
#
# Usage, from apps/macOS:
#   sh scripts/e2e-test.sh --host               # the opt-in, through the router
#   sh scripts/e2e-host.sh                      # the same run, by hand
#   sh scripts/e2e-host.sh -only-testing:ArgoE2ETests/ProjectDrawerE2ETests
#
# `e2e-vm.sh` syncs the tree into the guest and calls this script over ssh. Keeping it separate
# from `e2e-test.sh` is what makes that safe: a router that called the VM and a VM that called the
# router would be a loop with no bottom.
#
# See AGENTS.md ("A render is not a click") for why this gate exists and why it stays local.
#
# FIRST RUN ON A NEW MACHINE IS INTERACTIVE. macOS gates UI testing behind a system
# authorisation prompt ("Authentication cancelled. System authentication is running." is what a
# refused or unanswered one looks like). Nothing here can grant it — answer the dialog once and
# subsequent runs are unattended. A locked or sleeping display fails the same way, because the
# runner cannot drive a screen that is not there.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$APP_DIR"

# Announced here rather than in the router, because it is true of every way in — `--host`, this
# script by hand, or the guest's own invocation. On stderr: it is a warning, not output.
echo "e2e-host: driving this machine's screen — it takes the mouse and keyboard until it ends" >&2

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
