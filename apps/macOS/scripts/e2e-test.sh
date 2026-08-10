#!/bin/sh
# Run the XCUITest suite — `ArgoE2ETests`, the only tests here that launch Argo and click it.
#
# THIS IS A ROUTER, not the runner. By default it sends the suite to a VM, so the run drives a
# screen that is not yours:
#
#   sh scripts/e2e-test.sh                      # in the VM — your mouse and keyboard stay yours
#   sh scripts/e2e-test.sh --host               # on THIS screen — seizes the mouse and keyboard
#   sh scripts/e2e-test.sh -only-testing:ArgoE2ETests/ContextGuideE2ETests
#
# Why the default moved. XCUITest drives the real WindowServer, and there is no headless mode to
# switch on — so a suite pointed at this machine holds the pointer and the keys for its whole
# length, and anyone at the keyboard is locked out until it finishes. That is not a cost worth
# paying on every run when a guest can take it instead. `scripts/e2e-vm.sh` runs the same target,
# the same tests and the same specimens inside a Tart VM synced from the current worktree; only the
# screen changes.
#
# The host path is KEPT, because a VM is not always there — no Tart, an Intel Mac, or a first
# provision not yet done — and because it is still the fastest way to watch the suite drive the app
# with your own eyes. It is opt-in on purpose: `--host`, or ARGO_E2E_HOST=1. Both are a deliberate
# act, which is what taking somebody's input devices ought to be.
#
# A LOCAL gate, deliberately not a CI one. Driving the real app needs a macOS runner, the most
# expensive minutes GitHub bills, and it would take them on every push to walk a handful of clicks.
# Run it when you touch a surface that is only reachable by clicking. That is true of BOTH paths:
# routing to a VM changes whose screen is driven, not where the gate lives.
#
# The interactive first run belongs to the HOST path and does not go away — macOS gates UI testing
# behind an authorisation prompt a human answers by hand, and a locked or sleeping display fails
# the same way. The VM has the same prompt, answered once inside the guest during `--provision`,
# after which the answer lives in the guest's own disk image and every run is headless.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$APP_DIR"

HOST=${ARGO_E2E_HOST:-}
if [ "${1:-}" = "--host" ]; then
  HOST=1
  shift
fi

if [ -n "$HOST" ]; then
  echo "e2e: running on THIS machine's screen — it will take the mouse and keyboard until it ends"
  exec sh scripts/e2e-host.sh "$@"
fi

exec sh scripts/e2e-vm.sh "$@"
