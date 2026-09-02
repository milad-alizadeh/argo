#!/bin/sh
# Design-token guardrail for SwiftUI — the repo's only one, since the CSS sibling it was
# written against retired with the Electron cockpit. The bargain is unchanged: it fails when
# a design constant escapes the token contract, and a finding is
# fixed by snapping to an existing token or promoting a named one (rules/design-system.md),
# never by allowlisting, unless it is pre-existing debt tracked in a ticket.
#
# Scope is deliberately narrow and greppable. It looks at colour construction, the type
# ladder, and the modifiers that take a rhythm value — NOT at `frame`, whose numbers are
# usually a content measure rather than a design constant, and not at computed expressions.
# The rest is the design-system rule's job, and review's.
#
# What is exempt is a MODULE, not a directory name: `ArgoDesign` IS the contract (#1088), and it
# is the one place a literal colour, size or step may be written down. That is the whole reason
# the contract left `ArgoUI` — while the two shared a module, "the palette" was a folder name any
# view could be moved into, and this script's exemption was that folder. Edge 7 of
# `scripts/swift-boundaries.sh` runs this over the tree, so the rule is a CI gate rather than the
# review note it was.
#
# Allowlist: scripts/design-tokens-swift-allow.txt, one grep -E pattern per line
# (matched against the full "path:line:content" finding), each preceded by a comment line saying
# why. The list may only shrink: an entry matching nothing is a failure, not a no-op.
#
# Scans the whole tree and ignores any arguments, the way its caller does: which constants are
# outside the contract is a property of the tree, not of the file you happened to touch.
#
# That replaced a file mode, which took the staged paths from lint-staged so a full scan could not
# fail a commit on a parallel session's WIP (AGENTS.md → Session isolation). The trade is recorded
# rather than silent: `swift-boundaries.sh` was ALREADY in lint-staged and already scanned the
# whole tree, so that protection had gone before this script's caller arrived — a second, narrower
# entry only made it look present. What remains is one scan, and one answer to what the tree holds.
set -u

# Every Swift source that CONSUMES the contract. `ArgoDesign` itself is absent because it declares
# them, and the two test targets are absent because a test states a value on purpose — an
# assertion about #D73A4A has to spell #D73A4A.
SRC_DIRS="apps/macOS/Packages/ArgoUI/Sources apps/macOS/Packages/ArgoDesign/Sources/ArgoAtoms apps/macOS/Argo"
# The module the exemption is: named here so a rename fails loudly rather than exempting nothing.
DESIGN_TARGET="apps/macOS/Packages/ArgoDesign/Sources/ArgoDesign"
ALLOW_FILE="$(dirname "$0")/design-tokens-swift-allow.txt"

# 1. A colour built rather than named — a hex literal, a component initialiser, AppKit.
# 2. Apple's semantic palette. Not an escape route: `.primary` is Apple's ink, not Argo's,
#    and a surface half-drawn in each is what makes a port look like neither.
# 3. A size handed straight to the system font, bypassing the type ladder.
# 4. A bare number where a rhythm step belongs.
COLOR_RE='0x[0-9a-fA-F]{6}|Color\(\.?(sRGB|displayP3|red:)|NSColor\('
APPLE_INK_RE='(Color\.|foregroundStyle\(\.|foregroundColor\(\.|tint\(\.)(primary|secondary|accentColor)\b'
FONT_RE='\.system\(size:|\.font\(\.(largeTitle|title[23]?|headline|subheadline|body|callout|footnote|caption[2]?)\b'
RHYTHM_RE='\.(padding|cornerRadius|opacity|blur\(radius:|shadow\(radius:)\(-?[0-9]|(spacing|lineWidth|lineSpacing|tracking|kerning|radius):[[:space:]]*-?[0-9]'

# A scope that has moved is reported, never assumed empty: a scan over a path that is not there
# returns nothing and reads exactly like a clean tree (docs/agents/quality-gates.md).
missing=""
for dir in $SRC_DIRS "$DESIGN_TARGET"; do
  [ -d "$dir" ] || missing="$missing $dir"
done
if [ -n "$missing" ]; then
  echo "check:design-tokens-swift — these scopes are not there:$missing" >&2
  echo "Point SRC_DIRS and DESIGN_TARGET at their new homes. A scan over a path that has moved" >&2
  echo "finds nothing and reports a clean tree, which is a gate that checks nothing." >&2
  exit 1
fi

findings=$(
  # shellcheck disable=SC2086
  {
    for pattern in "$COLOR_RE" "$APPLE_INK_RE" "$FONT_RE" "$RHYTHM_RE"; do
      grep -rEn --include='*.swift' -- "$pattern" $SRC_DIRS 2>/dev/null
    done
  } | sort -u
)

# An entry is a pattern with the line above it saying why. Both halves are checked: a pattern
# without a reason is not read, and a reason without a subject is a licence nothing needs.
if [ -f "$ALLOW_FILE" ]; then
  unreasoned=$(awk '
    /^[[:space:]]*#/ { reason = 1; next }
    /^[[:space:]]*$/ { reason = 0; next }
    { if (!reason) print; reason = 0 }
  ' "$ALLOW_FILE")
  if [ -n "$unreasoned" ]; then
    echo "check:design-tokens-swift — these allowlist entries say nothing about themselves:" >&2
    printf '%s\n' "$unreasoned" >&2
    echo "Put a comment line directly above each one naming the debt and the ticket that ends it." >&2
    exit 1
  fi

  patterns=$(grep -Ev '^[[:space:]]*(#|$)' "$ALLOW_FILE" || true)
  if [ -n "$patterns" ]; then
    stale=$(
      printf '%s\n' "$patterns" | while IFS= read -r pattern; do
        printf '%s\n' "$findings" | grep -Eq -- "$pattern" || printf '%s\n' "$pattern"
      done
    )
    if [ -n "$stale" ]; then
      echo "check:design-tokens-swift — these allowlist entries match nothing any more:" >&2
      printf '%s\n' "$stale" >&2
      echo "Delete each line. An entry left standing for a constant that was snapped goes on" >&2
      echo "authorising the next one written to that shape, which is how a ratchet stops." >&2
      exit 1
    fi
    # The patterns go to a real file. `-f /dev/stdin` with a heredoc hands grep the PATTERNS as
    # its stdin and then leaves it nothing to read as INPUT, so every finding is filtered out and
    # the tree reports clean — which is what this line did while the allowlist was empty enough
    # for nobody to notice (#1088).
    allow_patterns=$(mktemp)
    printf '%s\n' "$patterns" > "$allow_patterns"
    findings=$(printf '%s\n' "$findings" | grep -Ev -f "$allow_patterns" || true)
    rm -f "$allow_patterns"
  fi
fi

findings=$(printf '%s\n' "$findings" | sed '/^$/d')

if [ -n "$findings" ]; then
  printf '%s\n\n' "$findings"
  count=$(printf '%s\n' "$findings" | wc -l | tr -d ' ')
  echo "check:design-tokens-swift — $count design constant(s) outside the token contract."
  echo "Fix: snap to an existing token or promote a named one (rules/design-system.md)."
  echo "Colours come from ArgoColor, type from ArgoTypography, the rest from ArgoSpacing/Radius/Stroke/Motion."
  exit 1
fi

echo "check:design-tokens-swift — clean."
