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
    # The 3-digit branch requires a hex letter: a plain-decimal 3-digit "#NNN" is indistinguishable
    # from a GitHub issue/PR reference (`#607`), and every real short hex color in this codebase
    # already carries a letter (`#ccc`, `#fff`).
    grep -rEn --include='*.tsx' --include='*.ts' --include='*.css' $excludeArguments \
      '#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?\b|#([a-fA-F][0-9a-fA-F]{2}|[0-9][a-fA-F][0-9a-fA-F]|[0-9]{2}[a-fA-F])\b' \
      $sourceDirectories 2>/dev/null
    # The percent branch skips exactly three digits: a design percentage in this codebase is
    # always one or two digits (12%, 45%), and three digits is `100%`, the CSS idiom for an
    # axis's own full extent inside a `calc()`, never a design decision.
    grep -rEn --include='*.tsx' --include='*.ts' $excludeArguments -- \
      '-\[[^]]*(#|[0-9]+(\.[0-9]+)?(px|rem|em|ms|vh|vw)|\b[0-9]{1,2}(\.[0-9]+)?%|\b[0-9]{4,}(\.[0-9]+)?%)[^]]*\]' \
      $sourceDirectories 2>/dev/null
  } | sort -u
)

if [ -f "$allowlistPath" ]; then
  patternFile=$(mktemp)
  grep -Ev '^\s*(#|$)' "$allowlistPath" > "$patternFile" 2>/dev/null || true
  if [ -s "$patternFile" ]; then
    # A pattern file, never a heredoc: a heredoc redirects grep's own stdin, which is also where
    # the piped findings arrive, and the two collide silently into an empty result.
    findings=$(printf '%s\n' "$findings" | grep -Ev -f "$patternFile" || true)
  fi
  rm -f "$patternFile"
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
