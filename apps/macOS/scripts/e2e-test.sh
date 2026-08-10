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
# XCUITest drives the real WindowServer, and there is no headless mode to switch on — so a suite
# pointed at this machine holds the pointer and the keys for its whole length, and anyone at the
# keyboard is locked out until it finishes. A guest takes that cost instead: `scripts/e2e-vm.sh`
# runs the same target, the same tests and the same specimens inside a Tart VM synced from the
# current worktree. Only the screen changes.
#
# The host path is KEPT, because a VM is not always there — no Tart, an Intel Mac, or a first
# provision not yet done — and because it is still the fastest way to watch the suite drive the app
# with your own eyes. It is opt-in on purpose: taking somebody's input devices should be a
# deliberate act, so it takes a deliberate flag.
#
# See AGENTS.md ("A render is not a click") for why this gate exists and why it stays local.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$APP_DIR"

# Matched by VALUE, not by "is it set". The obvious way to turn an env toggle off is to set it to
# 0, and a non-emptiness test would read that as opting IN — the one direction this flag must never
# get wrong.
HOST=0
case "${ARGO_E2E_HOST:-}" in
  1 | true | yes) HOST=1 ;;
esac

# `--host` is pulled out of ANY position rather than read off $1, because the usage below shows it
# alongside `-only-testing:`, and a flag that silently became an xcodebuild argument would boot a
# VM and sync a tree before failing on it.
ARGS=""
for arg in "$@"; do
  if [ "$arg" = "--host" ]; then
    HOST=1
  else
    ARGS="$ARGS $(printf "'%s'" "$(printf '%s' "$arg" | sed "s/'/'\\\\''/g")")"
  fi
done

if [ "$HOST" -eq 1 ]; then
  eval "exec sh scripts/e2e-host.sh$ARGS"
fi

eval "exec sh scripts/e2e-vm.sh$ARGS"
