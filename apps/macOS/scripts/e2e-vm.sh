#!/bin/sh
# Run the XCUITest suite inside a macOS VM, so it drives a screen that is not yours.
#
# Usage, from apps/macOS:
#   sh scripts/e2e-vm.sh --provision            # once per machine, interactive, downloads the image
#   sh scripts/e2e-vm.sh                        # every run after that, headless and unattended
#   sh scripts/e2e-vm.sh -only-testing:ArgoE2ETests/ProjectDrawerE2ETests
#
# `scripts/e2e-test.sh` drives the real app through the real WindowServer. That is what makes it
# the only test here that can click, and it is also why it takes the keyboard and mouse away from
# whoever is at the machine for the length of the run. There is no headless or sandboxed XCUITest
# mode to switch on — the test needs a graphical session, so the only fix is giving it a session
# that is not yours. This script does that with a Tart VM (Apple silicon,
# `Virtualization.framework`); `e2e-test.sh` is unchanged and stays the direct path for anyone who
# wants it.
#
# THE FIRST RUN ON A NEW MACHINE IS INTERACTIVE AND EXPENSIVE — `--provision` pulls an Xcode image
# (tens of GB), asks for the guest's SSH password once to install a key, and then runs the suite
# with the VM's window on screen so a human can answer macOS's UI-testing authorisation prompt
# INSIDE the guest. That prompt is the same one `e2e-test.sh` documents; this script does not make
# it disappear, it stops it from being the developer's problem on every run. Everything after
# provisioning is headless.
#
# Knobs:
#   ARGO_E2E_VM=argo-e2e                              VM name
#   ARGO_E2E_VM_IMAGE=ghcr.io/cirruslabs/macos-tahoe-xcode:latest
#   ARGO_E2E_VM_USER=admin                            guest account (cirruslabs images: admin/admin)
#   ARGO_E2E_VM_KEY=~/.config/argo/e2e-vm_ed25519     key this script generates and uses
#   ARGO_E2E_VM_KEEP_RUNNING=1                        leave the VM booted between runs
set -eu

VM=${ARGO_E2E_VM:-argo-e2e}
IMAGE=${ARGO_E2E_VM_IMAGE:-ghcr.io/cirruslabs/macos-tahoe-xcode:latest}
VM_USER=${ARGO_E2E_VM_USER:-admin}
KEY=${ARGO_E2E_VM_KEY:-$HOME/.config/argo/e2e-vm_ed25519}
GUEST_DIR=argo/apps/macOS

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$APP_DIR"

PROVISION=0
if [ "${1:-}" = "--provision" ]; then
  PROVISION=1
  shift
fi

# Virtualization.framework is Apple silicon only. Say so rather than failing somewhere inside
# `tart clone`, where it reads as a broken image instead of a machine this approach cannot serve.
if [ "$(uname -m)" != "arm64" ]; then
  echo "e2e-vm: needs Apple silicon — run 'sh scripts/e2e-test.sh' directly on this machine" >&2
  exit 1
fi

if ! command -v tart >/dev/null 2>&1; then
  echo "e2e-vm: tart not installed — see https://tart.run (brew install cirruslabs/cli/tart)" >&2
  exit 1
fi

# The VM's host key is reinstalled with the image and its NAT address is handed out fresh on every
# boot, so pinning either just breaks the next reprovision. This is a local throwaway guest on a
# host-private network, not a server worth remembering.
SSH_OPTS="-i $KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
SSH_OPTS="$SSH_OPTS -o ConnectTimeout=10"

# One place that knows how to reach the guest. rsync needs the options as a string for `-e`, so the
# string is the source of truth and this wraps it — two spellings of the same connection would
# drift, and the one that drifted would be the one that only runs on a reprovision.
ssh_vm() {
  host=$1
  shift
  # shellcheck disable=SC2086,SC2029 # $SSH_OPTS is a flag list and must split; the command is
  # assembled on the host on purpose, from this script's own constants
  ssh $SSH_OPTS "$VM_USER@$host" "$@"
}

vm_exists() {
  tart list --source local --quiet 2>/dev/null | grep -qx "$VM"
}

# An IP means a DHCP lease, which arrives well before sshd does. Boot readiness is "something is
# listening", not "it has an address" — without this the first connection fails on a VM that is
# fine. It probes the PORT rather than a session on purpose: during `--provision` this runs BEFORE
# the key is installed, so a probe that needed the key could never succeed.
wait_for_ssh() {
  ip=$1
  attempt=0
  while [ "$attempt" -lt 60 ]; do
    if nc -z -w 5 "$ip" 22 >/dev/null 2>&1; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  echo "e2e-vm: $VM took an address but never opened ssh" >&2
  return 1
}

# ssh runs one shell string on the far side, so every argument has to survive a second round of
# word-splitting. Single-quote each one; an `-only-testing:` filter that lost its quoting would run
# a different set of tests than was asked for and still report green.
quote_args() {
  for arg in "$@"; do
    printf " '%s'" "$(printf '%s' "$arg" | sed "s/'/'\\\\''/g")"
  done
}

# Everything the guest runs, it runs from the synced tree — so no call site can forget the `cd` and
# have `xcodebuild` fail on a missing project in the login directory.
run_in_guest() {
  ip=$1
  shift
  ssh_vm "$ip" "mkdir -p '$GUEST_DIR' && cd '$GUEST_DIR' && $*"
}

# `--delete` so a file deleted on the host is deleted in the guest — a stale copy of a renamed test
# is the kind of green run nobody questions. `build/` is excluded rather than deleted, which is
# load-bearing: the guest's own DerivedData survives between runs, so the second build is
# incremental instead of a cold Xcode build every time.
sync_tree() {
  ip=$1
  run_in_guest "$ip" true
  rsync -az --delete \
    --exclude build/ --exclude out/ --exclude .git/ --exclude .DS_Store \
    -e "ssh $SSH_OPTS" \
    "$APP_DIR/" "$VM_USER@$ip:$GUEST_DIR/"
}

if [ "$PROVISION" -eq 1 ]; then
  if vm_exists; then
    echo "e2e-vm: $VM already exists — reusing it"
  else
    echo "e2e-vm: cloning $IMAGE into $VM (tens of GB, once per machine)"
    tart clone "$IMAGE" "$VM"
  fi

  if [ ! -f "$KEY" ]; then
    # A key of its own, not the developer's default identity: this script has no business
    # authorising a throwaway guest with the same key that reaches their real hosts.
    mkdir -p "$(dirname "$KEY")"
    ssh-keygen -t ed25519 -N "" -C "argo-e2e-vm" -f "$KEY" >/dev/null
    echo "e2e-vm: generated $KEY"
  fi

  # With graphics, on purpose: the UI-testing authorisation prompt below is a dialog, and a human
  # has to see it to answer it.
  echo "e2e-vm: booting $VM with its window on screen"
  tart run "$VM" >/dev/null 2>&1 &
  IP=$(tart ip "$VM" --wait 300)
  wait_for_ssh "$IP"

  echo "e2e-vm: installing $KEY.pub into $VM — the guest's password follows (cirruslabs: admin)"
  ssh-copy-id -i "$KEY.pub" \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    "$VM_USER@$IP"

  sync_tree "$IP"

  echo "e2e-vm: running the suite once — ANSWER THE AUTHORISATION PROMPT IN THE VM's WINDOW"
  run_in_guest "$IP" "sh scripts/e2e-test.sh" || true

  # Left running, not stopped: the authorisation above is answered per boot on some macOS versions,
  # and a developer who has just answered it should get the chance to re-run against the same live
  # guest before it goes away. `tart stop $VM` when done.
  echo "e2e-vm: provisioned, and $VM is still up ('tart stop $VM' to close its window)."
  echo "e2e-vm: 'sh scripts/e2e-vm.sh' from here on — headless, no prompt, no window."
  exit 0
fi

if ! vm_exists; then
  echo "e2e-vm: no VM named $VM — run 'sh scripts/e2e-vm.sh --provision' first" >&2
  exit 1
fi

# A VM someone else already booted (a `--provision` left up, a window they are watching) is theirs
# to stop, not ours. Ownership is read off our own `tart run` rather than probed beforehand: by the
# time the VM has a DHCP lease it is definitely up, so a `tart run` of ours still alive at that
# point is the one running it, and one that exited did so because another instance already held it.
# A pre-flight probe cannot tell those apart — it only sees a VM that has no address YET.
echo "e2e-vm: reaching $VM"
tart run "$VM" --no-graphics >/dev/null 2>&1 &
BOOT_PID=$!
IP=$(tart ip "$VM" --wait 300)
WE_BOOTED_IT=0
if kill -0 "$BOOT_PID" 2>/dev/null; then
  WE_BOOTED_IT=1
fi
echo "e2e-vm: $VM at $IP"

cleanup() {
  if [ "$WE_BOOTED_IT" -eq 1 ] && [ -z "${ARGO_E2E_VM_KEEP_RUNNING:-}" ]; then
    tart stop "$VM" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

wait_for_ssh "$IP"

# The tree that gets tested is THIS worktree, resolved from the script's own location. Concurrent
# sessions each have their own checkout, and a VM holding one of them is the same failure as an
# already-running Argo poisoning a screenshot — plausible output from somebody else's source.
echo "e2e-vm: syncing $APP_DIR"
sync_tree "$IP"

echo "e2e-vm: running the suite in $VM"
run_in_guest "$IP" "sh scripts/e2e-test.sh$(quote_args "$@")"
