#!/bin/sh
# Tests the base has that a rebased branch does not, minus the ones it says it meant to remove.
# Why a removal has to declare itself rather than be inferred: `docs/agents/landing.md` (#1558).
#
# Usage:
#   sh scripts/kept-the-tests.sh <repo-dir> <base-ref> <branch-ref>
#
# <branch-ref> must already be rebased onto <base-ref>, which is how `land.sh` calls it: the
# comparison is tree against tree, so an un-rebased branch reports every test the base gained
# since the cut.
#
# Prints one undeclared lost name per line and exits 1 when there are any; exits 0 in silence
# otherwise.
set -eu

if [ "$#" -ne 3 ]; then
  echo "kept-the-tests: usage: kept-the-tests.sh <repo-dir> <base-ref> <branch-ref>" >&2
  exit 2
fi

DIR=$1
BASE=$2
BRANCH=$3

# The declared name of every test in a tree, one per line, sorted. Names rather than
# file-and-name, so a test that moved between files reads as the same test — at the cost of a
# name held twice, where deleting one copy is invisible here.
test_names() {
  ref=$1
  {
    # swift-testing. What marks a test is the `@Test` attribute, not the name, so what gets read
    # is the first `func` after each one — the name is a backticked sentence here and a plain
    # identifier elsewhere, and keying on either spelling alone would miss the other in silence.
    # FIRST, not every func in the window: a helper declared inside a test body is not a test,
    # and renaming one would otherwise refuse the lane that renamed it.
    git -C "$DIR" grep -h -A4 -E '^[[:space:]]*@Test' "$ref" -- '*Tests.swift' 2>/dev/null |
      awk '
        /^--$/ { taken = 0; next }
        taken { next }
        /func / {
          name = $0
          sub(/^.*func +/, "", name)
          sub(/\(.*$/, "", name)
          gsub(/`/, "", name)
          if (name != "") { print name; taken = 1 }
        }'
    # The Node suites, whose case name is the first argument, in any of the three quotes.
    git -C "$DIR" grep -hE "^[[:space:]]*(check|test|it)\((['\"\`])" "$ref" \
      -- '*.test.mjs' '*.test.js' '*.test.ts' 2>/dev/null |
      sed -E "s/^[[:space:]]*(check|test|it)\((['\"\`])([^'\"\`]*)(['\"\`]).*/\3/"
  } | sort -u
}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

test_names "$BASE" >"$work/base"
test_names "$BRANCH" >"$work/branch"
comm -23 "$work/base" "$work/branch" >"$work/lost"
[ -s "$work/lost" ] || exit 0

# Only the commits the branch adds to the base are read, so a trailer that arrived with the base
# cannot excuse a later deletion.
git -C "$DIR" log --format=%B "$BASE..$BRANCH" |
  sed -n -E 's/^[[:space:]]*Removes-test:[[:space:]]*(.+[^[:space:]])[[:space:]]*$/\1/p' |
  sort -u >"$work/declared"

comm -23 "$work/lost" "$work/declared" >"$work/silent"
[ -s "$work/silent" ] || exit 0
cat "$work/silent"
exit 1
