#!/bin/sh
# Run the XCUITest suite inside a macOS VM, so it drives a screen that is not yours.
#
# Usage, from apps/macOS:
#   sh scripts/e2e-vm.sh --provision            # once per machine, interactive, downloads the image
#   sh scripts/e2e-vm.sh                        # every run after that, headless and unattended
#   sh scripts/e2e-vm.sh -only-testing:ArgoE2ETests/ProjectDrawerE2ETests
#
# `scripts/e2e-host.sh` drives the real app through the real WindowServer. That is what makes it
# the only test here that can click, and it is also why it takes the keyboard and mouse away from
# whoever is at the machine for the length of the run. There is no headless or sandboxed XCUITest
# mode to switch on — the test needs a graphical session, so the only fix is giving it a session
# that is not yours. This script does that with a Tart VM (Apple silicon,
# `Virtualization.framework`), and it is where `scripts/e2e-test.sh` now sends a run by default;
# `e2e-host.sh` stays reachable by hand, and is what this script runs inside the guest.
#
# THE FIRST RUN ON A NEW MACHINE IS INTERACTIVE AND EXPENSIVE. `--provision` pulls an Xcode image —
# 60-80 GB, with its own Xcode inside it — asks for the guest's SSH password once to install a key,
# and then runs the suite with the VM's window on screen so a human can answer macOS's UI-testing
# authorisation prompt INSIDE the guest. That is the same prompt `e2e-test.sh` documents; this
# script does not make it disappear, it stops it from being the developer's problem on every run.
# The answer lives in the guest's own disk image, which is durable — so it survives reboots of the
# VM and needs no snapshot to preserve it. Everything after provisioning is headless.
#
# THE VM IS LEFT RUNNING when the suite finishes. Booting is the slow part, so a warm guest makes
# the next run quick — and stopping one is a decision this script is not equipped to make, because
# it cannot tell its own VM from one a colleague is watching. `tart stop` it by hand, or set
# ARGO_E2E_VM_STOP=1 to have this script stop what it leaves behind.
#
# Knobs:
#   ARGO_E2E_VM=argo-e2e                              VM name
#   ARGO_E2E_VM_IMAGE=ghcr.io/cirruslabs/macos-tahoe-xcode:latest
#   ARGO_E2E_VM_USER=admin                            guest account (cirruslabs images: admin/admin)
#   ARGO_E2E_VM_KEY=~/.config/argo/e2e-vm_ed25519     key this script generates and uses
#   ARGO_E2E_VM_STOP=1                                stop the VM when the suite finishes
set -eu

VM=${ARGO_E2E_VM:-argo-e2e}
IMAGE=${ARGO_E2E_VM_IMAGE:-ghcr.io/cirruslabs/macos-tahoe-xcode:latest}
VM_USER=${ARGO_E2E_VM_USER:-admin}
SSH_KEY=${ARGO_E2E_VM_KEY:-$HOME/.config/argo/e2e-vm_ed25519}

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$APP_DIR"

# One directory per checkout, named after it. Concurrent sessions each work in their own worktree,
# and a single guest path would have them `rsync --delete` over each other — the same failure as an
# already-running Argo poisoning a screenshot, only now it is the source under test.
TREE=$(basename "$(cd "$APP_DIR/../.." && pwd)")
GUEST_DIR="argo/$TREE/apps/macOS"
# The lock is NOT per-tree, deliberately: separate trees still share one screen inside the guest,
# and two `xcodebuild test` runs clicking at the same window is a flake with no honest diagnosis.
GUEST_LOCK="argo/.e2e-lock"

PROVISION=0
if [ "${1:-}" = "--provision" ]; then
  PROVISION=1
  shift
fi

# Virtualization.framework is Apple silicon only, so on Intel there is no VM to hand the suite.
# Fall through to the direct run rather than leaving the developer with nothing — loudly, because
# the whole point of this script is that the direct run takes the machine over.
if [ "$(uname -m)" != "arm64" ]; then
  echo "e2e-vm: no VM on Intel — falling back to scripts/e2e-host.sh, which WILL take your mouse"
  exec sh scripts/e2e-host.sh "$@"
fi

if ! command -v tart >/dev/null 2>&1; then
  echo "e2e-vm: tart not installed — see https://tart.run (brew install cirruslabs/cli/tart)" >&2
  exit 1
fi

# The VM's host key is reinstalled with the image and its NAT address is handed out fresh on every
# boot, so pinning either just breaks the next reprovision. This is a local throwaway guest on a
# host-private network, not a server worth remembering. Split from the identity below because
# `ssh-copy-id` runs before that identity exists and must not be handed it.
SSH_HOST_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
SSH_OPTS="-i $SSH_KEY $SSH_HOST_OPTS -o LogLevel=ERROR -o ConnectTimeout=10"

# One place that knows how to reach the guest; `rsync` needs the same options as a string for `-e`,
# which is why they live in a variable rather than in an argument list.
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

# Backgrounded because `tart run` holds the VM for as long as it lives; the address is what says the
# guest is up. Called with no arguments it boots with a window, which is what `--provision` wants.
boot_vm() {
  tart run "$VM" "$@" >/dev/null 2>&1 &
  tart ip "$VM" --wait 300
}

# An IP means a DHCP lease, which arrives well before sshd does. Boot readiness is "something is
# listening", not "it has an address" — without this the first connection fails on a VM that is
# fine. It probes the PORT rather than opening a session on purpose: during `--provision` this runs
# BEFORE the key is installed, so a probe that needed the key could never succeed.
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
# have `xcodebuild` fail on a missing project in the login directory. The `mkdir` is what creates
# that tree on a first run, before rsync has anything to copy into.
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
    echo "e2e-vm: cloning $IMAGE into $VM (60-80 GB, once per machine)"
    tart clone "$IMAGE" "$VM"
  fi

  if [ ! -f "$SSH_KEY" ]; then
    # A key of its own, not the developer's default identity: this script has no business
    # authorising a throwaway guest with the same key that reaches their real hosts.
    mkdir -p "$(dirname "$SSH_KEY")"
    ssh-keygen -t ed25519 -N "" -C "argo-e2e-vm" -f "$SSH_KEY" >/dev/null
    echo "e2e-vm: generated $SSH_KEY"
  fi

  # With a window, on purpose: the authorisation prompt below is a dialog, and a human has to see
  # it to answer it.
  echo "e2e-vm: booting $VM with its window on screen"
  IP=$(boot_vm)
  wait_for_ssh "$IP"

  echo "e2e-vm: installing $SSH_KEY.pub into $VM — the guest's password follows (cirruslabs: admin)"
  # shellcheck disable=SC2086 # $SSH_HOST_OPTS is a flag list and must split
  ssh-copy-id -i "$SSH_KEY.pub" $SSH_HOST_OPTS "$VM_USER@$IP"

  sync_tree "$IP"

  echo "e2e-vm: running the suite once — ANSWER THE AUTHORISATION PROMPT IN THE VM's WINDOW"
  # `|| true` because this run is not a gate: an unanswered prompt fails it, and that failure says
  # nothing about the code. What matters is that the prompt got raised and answered.
  run_in_guest "$IP" "sh scripts/e2e-host.sh" || true

  echo "e2e-vm: provisioned, and $VM is still up ('tart stop $VM' to close its window)."
  echo "e2e-vm: 'sh scripts/e2e-vm.sh' from here on — headless, no prompt, no window."
  exit 0
fi

if ! vm_exists; then
  echo "e2e-vm: no VM named $VM — run 'sh scripts/e2e-vm.sh --provision' first" >&2
  exit 1
fi

echo "e2e-vm: reaching $VM"
IP=$(boot_vm --no-graphics)
wait_for_ssh "$IP"
echo "e2e-vm: $VM at $IP"

# `mkdir` is the atomic part — it fails if the directory is there, so the loser of a race finds out
# rather than joining in. The holder's name goes inside, so the message names a tree instead of
# telling somebody their machine is mysteriously busy.
LOCK_HELD=0
if ssh_vm "$IP" "mkdir -p '$(dirname "$GUEST_LOCK")' && mkdir '$GUEST_LOCK'" 2>/dev/null; then
  LOCK_HELD=1
  ssh_vm "$IP" "echo '$TREE' > '$GUEST_LOCK/holder'"
else
  holder=$(ssh_vm "$IP" "cat '$GUEST_LOCK/holder' 2>/dev/null" || true)
  echo "e2e-vm: $VM is already running a suite for '${holder:-another tree}'" >&2
  echo "e2e-vm: wait for it, or clear a stale lock with 'rm -rf $GUEST_LOCK' in the guest" >&2
  exit 1
fi

cleanup() {
  if [ "$LOCK_HELD" -eq 1 ]; then
    ssh_vm "$IP" "rm -rf '$GUEST_LOCK'" >/dev/null 2>&1 || true
  fi
  if [ -n "${ARGO_E2E_VM_STOP:-}" ]; then
    tart stop "$VM" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "e2e-vm: syncing $APP_DIR"
sync_tree "$IP"

echo "e2e-vm: running the suite in $VM"
run_in_guest "$IP" "sh scripts/e2e-host.sh$(quote_args "$@")"
