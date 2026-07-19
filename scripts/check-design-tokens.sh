#!/bin/sh
# Design-token guardrail: fails when a design constant escapes the token
# contract inside renderer source — a raw hex color, or a Tailwind arbitrary
# value carrying a unit/color (text-[13px], p-[7px], bg-[#4a5ee0]).
#
# Scope is deliberately narrow and greppable: it does NOT parse style={{}}
# objects or computed values — those are covered by the design-system rule and
# review. A finding is fixed by snapping to an existing token or promoting a
# new one (see rules/design-system.md — "fix the contract, not the symptom"),
# never by allowlisting, unless it is pre-existing debt tracked in a ticket.
#
# Allowlist: scripts/design-tokens-allow.txt, one grep -E pattern per line
# (matched against the full "path:line:content" finding). Comments with #.
set -u

SRC_DIRS="apps/desktop/src/renderer/src"
EXCLUDE_FILES="argo-tokens.css globals.css"
ALLOW_FILE="$(dirname "$0")/design-tokens-allow.txt"

# 1. Raw hex colors in source (tsx/ts/css), outside the token files.
# 2. Tailwind arbitrary values with a unit or color inside the brackets.
# 3. Stock Tailwind text-size classes — the default scale is removed from the
#    theme (globals.css --text-*: initial), so text-sm would silently no-op;
#    type is set only via the role ladder (text-row, text-meta, …).
HEX_RE='#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b|#[0-9a-fA-F]{3}\b'
TW_RE='-\[[^]]*(#|[0-9]+(\.[0-9]+)?(px|rem|em|ms|vh|vw|%))[^]]*\]'
STOCK_TEXT_RE='(^|[^a-zA-Z0-9_-])text-(xs|sm|base|lg|[0-9]?xl)($|[^a-zA-Z0-9-])'

if [ $# -gt 0 ]; then
  # File mode (lint-staged pre-commit): scan only the staged files given —
  # parallel sessions share one working tree, so a full scan would fail a
  # commit on another session's WIP.
  targets=""
  for f in "$@"; do
    case "$(basename "$f")" in
      argo-tokens.css | globals.css) continue ;;
    esac
    targets="$targets $f"
  done
  if [ -z "$targets" ]; then
    echo "check:design-tokens — clean."
    exit 0
  fi
  findings=$(
    # shellcheck disable=SC2086
    {
      grep -HEn "$HEX_RE" $targets 2>/dev/null
      grep -HEn -- "$TW_RE" $targets 2>/dev/null
      grep -HEn -- "$STOCK_TEXT_RE" $targets 2>/dev/null
    } | sort -u
  )
else
  exclude_args=""
  for f in $EXCLUDE_FILES; do
    exclude_args="$exclude_args --exclude=$f"
  done

  findings=$(
    # shellcheck disable=SC2086
    {
      # excludes must come AFTER includes: BSD grep gives the later option precedence
      grep -rEn --include='*.tsx' --include='*.ts' --include='*.css' $exclude_args \
        "$HEX_RE" $SRC_DIRS 2>/dev/null
      grep -rEn --include='*.tsx' --include='*.ts' $exclude_args \
        -- "$TW_RE" $SRC_DIRS 2>/dev/null
      grep -rEn --include='*.tsx' --include='*.ts' $exclude_args \
        -- "$STOCK_TEXT_RE" $SRC_DIRS 2>/dev/null
    } | sort -u
  )
fi

if [ -f "$ALLOW_FILE" ]; then
  patterns=$(grep -Ev '^\s*(#|$)' "$ALLOW_FILE" || true)
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
  echo "check:design-tokens — $count design constant(s) outside the token contract."
  echo "Fix: snap to an existing token or promote a named one (rules/design-system.md)."
  echo "Stock text-* classes: use a type role instead (text-row, text-meta, …)."
  exit 1
fi

echo "check:design-tokens — clean."
