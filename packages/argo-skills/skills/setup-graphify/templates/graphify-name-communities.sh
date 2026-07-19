#!/bin/sh
# SessionStart auto-namer (installed by setup-graphify).
# Names NEW graphify communities — the placeholder "Community N" ones — via the local Claude
# CLI. Keeps existing names (--missing-only), so no churn and no wipe; no metered API key.
# Backgrounded + best-effort so it never blocks session start; the names ride into the next
# commit (the pre-commit stages graphify-out on the main tree).
[ -f graphify-out/graph.json ] || exit 0
command -v graphify >/dev/null 2>&1 || exit 0

# Cheap, no-LLM check: only spend a naming pass if placeholder communities actually exist.
if grep -q '"Community ' graphify-out/.graphify_labels.json 2>/dev/null; then
  nohup graphify label --missing-only --backend claude >/dev/null 2>&1 </dev/null &
fi
