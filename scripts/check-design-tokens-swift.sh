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
# VisualContract/ is exempt because it IS the contract (#375): the ramps and roles are the one
# place a literal colour, size or step is allowed to be written down. Specimen/ is exempt for
# the opposite reason — a specimen exists to SHOW the contract on a real surface, so it reaches
# for a raw value to demonstrate what a role is worth, and it ships in no screen.
#
# Allowlist: scripts/design-tokens-swift-allow.txt, one grep -E pattern per line
# (matched against the full "path:line:content" finding). Comments with #.
set -u

SRC_DIRS="apps/macOS/Packages/ArgoUI/Sources apps/macOS/Argo"
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

if [ $# -gt 0 ]; then
  # File mode (lint-staged pre-commit): scan only the staged files given — parallel sessions
  # share one working tree, so a full scan would fail a commit on another session's WIP.
  targets=""
  for f in "$@"; do
    case "$f" in
      */VisualContract/* | */Specimen/*) continue ;;
      *.swift) targets="$targets $f" ;;
    esac
  done
  if [ -z "$targets" ]; then
    echo "check:design-tokens-swift — clean."
    exit 0
  fi
  findings=$(
    # shellcheck disable=SC2086
    {
      grep -HEn -- "$COLOR_RE" $targets 2>/dev/null
      grep -HEn -- "$APPLE_INK_RE" $targets 2>/dev/null
      grep -HEn -- "$FONT_RE" $targets 2>/dev/null
      grep -HEn -- "$RHYTHM_RE" $targets 2>/dev/null
    } | sort -u
  )
else
  findings=$(
    # shellcheck disable=SC2086
    {
      # --exclude-dir must come AFTER --include: BSD grep gives the later option precedence
      for pattern in "$COLOR_RE" "$APPLE_INK_RE" "$FONT_RE" "$RHYTHM_RE"; do
        grep -rEn --include='*.swift' \
          --exclude-dir=VisualContract --exclude-dir=Specimen \
          -- "$pattern" $SRC_DIRS 2>/dev/null
      done
    } | sort -u
  )
fi

if [ -f "$ALLOW_FILE" ]; then
  patterns=$(grep -Ev '^[[:space:]]*(#|$)' "$ALLOW_FILE" || true)
  if [ -n "$patterns" ]; then
    findings=$(printf '%s\n' "$findings" | grep -Ev -f /dev/stdin <<EOF || true
$patterns
EOF
    )
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
