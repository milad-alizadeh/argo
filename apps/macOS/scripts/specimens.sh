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

for name in $NAMES; do
  echo "specimens: rendering $name"
  ARGO_SPECIMEN="$name" sh "$SCRIPT_DIR/screenshot.sh" "$OUT_DIR/$name.png" >/dev/null
done

echo "specimens: $OUT_DIR"
