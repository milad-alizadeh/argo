#!/bin/sh
# Render every `Specimen` case to a PNG — the per-state visual harness, so a visual claim about a
# deck state has evidence instead of an assertion.
#
# Usage, from apps/macOS:
#   sh scripts/specimens.sh out/specimens        # all of them
#   sh scripts/specimens.sh out/specimens feedEveryEventClass deckInFlight
#
# The names come from the app itself, which answers `--list-specimens` off `SpecimenRegistry` —
# adding an entry there is all it takes to add a state here. Asked rather than parsed out of Swift
# source: an unknown name renders the cockpit, so a list this script got subtly wrong would produce
# a directory of plausible PNGs of the wrong thing.
set -eu

OUT_DIR=${1:?usage: specimens.sh <out-dir> [name ...]}
shift || true

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
APP_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
APP="$APP_DIR/build/Build/Products/Debug/Argo.app"

# shellcheck source=scripts/build-lock.sh
. "$APP_DIR/../../scripts/build-lock.sh"

# One of the machine's build slots (#1377), held for the WHOLE batch. `/pixel-review` is not
# optional in this repo, so these xcodebuilds are ones an agent runs as routinely as the gate's.
# Taken up here rather than around the build below because each render delegates to
# `screenshot.sh`, which builds again: they inherit this slot and a run of twenty specimens
# queues once instead of twenty times.
build_lock_acquire

if [ "$#" -gt 0 ]; then
  NAMES=$*
else
  # The same build `screenshot.sh` does per capture, once and up front, because the list has to
  # come from THIS worktree's source rather than from whatever was built here last.
  xcodebuild -project "$APP_DIR/Argo.xcodeproj" -scheme Argo -configuration Debug \
    -derivedDataPath "$APP_DIR/build" build >/dev/null
  NAMES=$("$APP/Contents/MacOS/Argo" --list-specimens)
fi

mkdir -p "$OUT_DIR"

# The deck draws nothing at all until its measure lands (ADR-0030, Rule 3), so a specimen whose
# reading is big enough to take a while renders BLANK under the ordinary beat — and a blank PNG is
# indistinguishable from the bug somebody is looking for (#1287). Named here rather than left to
# whoever runs the batch: a still nobody set the beat for is a still that quietly lies.
slow_to_settle() {
  case $1 in
    feedHugePrompt*) return 0 ;;
    *) return 1 ;;
  esac
}

for name in $NAMES; do
  echo "specimens: rendering $name"
  settle=${ARGO_SETTLE_SECONDS:-}
  if [ -z "$settle" ] && slow_to_settle "$name"; then
    settle=5
  fi
  ARGO_SPECIMEN="$name" ARGO_SETTLE_SECONDS="$settle" \
    sh "$SCRIPT_DIR/screenshot.sh" "$OUT_DIR/$name.png" >/dev/null
done

echo "specimens: $OUT_DIR"
