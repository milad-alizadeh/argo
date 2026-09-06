#!/bin/sh
# The ink ratchet. `ArgoLineKind` names the kinds of line the interface writes and
# `TextRoles.ink(_:)` pairs each with a rung, so a call site asks for a KIND and is handed an ink.
# A call site that instead names a rung — `argo.color.text.tertiary` — has made the pairing
# again, by hand, and that is the fault #1250 was opened for: 139 of the shell's readings sat on
# the two quietest rungs against 56 on the loudest, because nobody was answering the same
# question twice.
#
# The rungs cannot simply be sealed: a glyph, a stroke, a dot and a ghosting comparison all take
# one legitimately, and none of them is a line of text. So this is a BUDGET rather than a ban —
# the count of hand-picked rungs outside the contract may fall and may never rise. Every fall is
# a call site that now says what its line IS, and the number below records the tree at the moment
# it was measured.
#
# Fixing a finding: give the line its kind (`.argoLine(role, .kind)`, or
# `argo.color.text.ink(.kind)` where a modifier pair will not do) and lower the number in
# `scripts/text-ink-budget.txt` by what you converted. Never raise it — that is the ratchet, and a
# ratchet that turns both ways is a comment.
#
# Scans the whole tree and ignores any arguments, the way `check-design-tokens-swift.sh` does:
# what the tree holds is a property of the tree, not of the file you happened to touch.
set -u

# Every Swift source that CONSUMES the ramp. `ArgoDesign` is absent because it DECLARES it — the
# pairing itself is a switch over the four rungs and has to name them.
SRC_DIRS="apps/macOS/Packages/ArgoUI/Sources apps/macOS/Packages/ArgoDesign/Sources/ArgoAtoms\
 apps/macOS/Packages/ArgoDesign/Sources/ProseText apps/macOS/Packages/ArgoMermaid/Sources\
 apps/macOS/Packages/ArgoAtlas/Sources apps/macOS/Argo"

# A rung named rather than asked for. `ink(` is deliberately not matched: that IS the pairing.
RUNG_RE='\.text\.(primary|secondary|tertiary|disabled)\b'

# The count the tree stands at, beside this script rather than inside it — the same shape edge 7's
# allowlist takes, and for the same reason: a case in `swift-boundaries.ink.test.mjs` states the
# budget for its own tree, so no test passes or fails on what the real tree happens to hold today.
BUDGET_FILE="$(dirname "$0")/text-ink-budget.txt"
if [ ! -f "$BUDGET_FILE" ]; then
  echo "check:text-ink — the budget is not there: $BUDGET_FILE" >&2
  echo "A ratchet with no number counts nothing. Restore the file or point BUDGET_FILE at it." >&2
  exit 1
fi
BUDGET=$(grep -Ev '^[[:space:]]*(#|$)' "$BUDGET_FILE" | head -1 | tr -d '[:space:]')
case "$BUDGET" in
  '' | *[!0-9]*)
    echo "check:text-ink — the budget is not a number: '$BUDGET' in $BUDGET_FILE" >&2
    exit 1
    ;;
esac

missing=""
for dir in $SRC_DIRS; do
  [ -d "$dir" ] || missing="$missing $dir"
done
if [ -n "$missing" ]; then
  echo "check:text-ink — these scopes are not there:$missing" >&2
  echo "Point SRC_DIRS at their new homes. A scan over a path that has moved finds nothing and" >&2
  echo "reports a clean tree, which is a ratchet that holds nothing." >&2
  exit 1
fi

# shellcheck disable=SC2086
findings=$(grep -rEn --include='*.swift' -- "$RUNG_RE" $SRC_DIRS 2>/dev/null | sort -u)
count=$(printf '%s\n' "$findings" | sed '/^$/d' | wc -l | tr -d ' ')

if [ "$count" -gt "$BUDGET" ]; then
  printf '%s\n\n' "$findings"
  echo "check:text-ink — $count hand-picked text rungs, over the budget of $BUDGET."
  echo "A line that names a rung has made the kind/rung pairing again at the call site, which is"
  echo "what ArgoLineKind exists to stop. Give the line its kind — .argoLine(role, .kind), or"
  echo "argo.color.text.ink(.kind) — rather than raising the budget."
  exit 1
fi

if [ "$count" -lt "$BUDGET" ]; then
  echo "check:text-ink — $count hand-picked text rungs, under the budget of $BUDGET."
  echo "Lower the number in $BUDGET_FILE to $count. A budget left above the tree authorises the next call site"
  echo "written to the shape you just removed, which is how a ratchet stops."
  exit 1
fi

echo "check:text-ink — clean, $count hand-picked text rungs at the budget."
