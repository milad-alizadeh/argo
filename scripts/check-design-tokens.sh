#!/bin/sh
# Fails when a design constant escapes the token contract inside component source: a raw hex
# colour, or a Tailwind arbitrary value carrying a unit or colour. A finding is fixed by
# snapping to a token or promoting one, never by allowlisting, unless it is tracked debt.
# Allowlist: scripts/design-tokens-allow.txt, one grep -E pattern per line, comments with #.
set -u

sourceDirectories="apps/desktop/src"
excludedFiles="tokens.css"
allowlistPath="$(dirname "$0")/design-tokens-allow.txt"

excludeArguments=""
for excludedFile in $excludedFiles; do
  excludeArguments="$excludeArguments --exclude=$excludedFile"
done

# 1. Raw hex colours in source (tsx/ts/css), outside the token files.
# 2. Tailwind arbitrary values with a unit or color inside the brackets.
findings=$(
  {
    grep -rEn --include='*.tsx' --include='*.ts' --include='*.css' $excludeArguments '#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b|#[0-9a-fA-F]{3}\b' $sourceDirectories 2>/dev/null
    grep -rEn --include='*.tsx' --include='*.ts' $excludeArguments -- '-\[[^]]*(#|[0-9]+(\.[0-9]+)?(px|rem|em|ms|vh|vw|%))[^]]*\]' $sourceDirectories 2>/dev/null
  } | sort -u
)

if [ -f "$allowlistPath" ]; then
  patterns=$(grep -Ev '^\s*(#|$)' "$allowlistPath" || true)
  if [ -n "$patterns" ]; then
    findings=$(printf '%s\n' "$findings" | grep -Ev -f /dev/stdin <<EOF_PATTERNS || true
$patterns
EOF_PATTERNS
    )
  fi
fi

findings=$(printf '%s\n' "$findings" | sed '/^$/d')

if [ -n "$findings" ]; then
  printf '%s\n\n' "$findings"
  count=$(printf '%s\n' "$findings" | wc -l | tr -d ' ')
  echo "check:design-tokens — $count design constant(s) outside the token contract."
  echo "Fix: snap to an existing token or promote a named one (apps/desktop/AGENTS.md)."
  exit 1
fi

echo "check:design-tokens — clean."
