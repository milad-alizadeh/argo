#!/bin/sh
# Render every `Specimen` case to a PNG — the per-state visual harness, so a visual claim about a
# deck state has evidence instead of an assertion.
#
# Usage, from apps/macOS:
#   sh scripts/specimens.sh out/specimens        # all of them
#   sh scripts/specimens.sh out/specimens feedEveryEventClass deckInFlight
#
# The names come from `ArgoUI/Specimen/SpecimenCatalog.swift`; adding a case there is all it takes
# to add a state here. An unknown name renders the cockpit, which is why the list is read from the
# source rather than repeated in this script.
set -eu

OUT_DIR=${1:?usage: specimens.sh <out-dir> [name ...]}
shift || true

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
CATALOG="$SCRIPT_DIR/../Packages/ArgoUI/Sources/ArgoUI/Specimen/SpecimenCatalog.swift"

if [ "$#" -gt 0 ]; then
  NAMES=$*
else
  NAMES=$(sed -n 's/^    case \([a-zA-Z]*\)$/\1/p' "$CATALOG")
fi

mkdir -p "$OUT_DIR"

for name in $NAMES; do
  echo "specimens: rendering $name"
  ARGO_SPECIMEN="$name" sh "$SCRIPT_DIR/screenshot.sh" "$OUT_DIR/$name.png" >/dev/null
done

echo "specimens: $OUT_DIR"
