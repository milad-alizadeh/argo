#!/bin/sh
# PROTOTYPE — regenerates atlas-cc.json from the repo. Stock CodeCharta, no authored content.
# Needs Java 11+ and: npm i codecharta-analysis   (binary lands at node_modules/.bin/ccsh)
set -eu

ROOT=$(git rev-parse --show-toplevel)
OUT=${TMPDIR:-/tmp}/atlas-cc
mkdir -p "$OUT"

ccsh unifiedparser "$ROOT" -fe swift -nc -o "$OUT/metrics"          # rloc, complexity, code smells
ccsh gitlogparser repo-scan --repo-path "$ROOT" -nc -o "$OUT/churn" # commits, authors, coupling
ccsh merge "$OUT/metrics.cc.json" "$OUT/churn.cc.json" -nc -o "$OUT/argo"

# The full map is 2.2 MB. The page reads the apps/macOS subtree with 12 of the 40 attributes.
node "$(dirname "$0")/atlas-cc-trim.mjs" "$OUT/argo.cc.json" "$(dirname "$0")/atlas-cc.json"
