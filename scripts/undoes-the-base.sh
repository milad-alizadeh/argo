#!/bin/sh
# What a branch takes away from the base, rather than what it adds. Two rules, both read on the
# rebased result, both clearable by a trailer. Why: `docs/agents/landing.md` (#1558).
#
#   deleted <path>   the base has the file and the merged tree does not
#   reverted <path>  the merged tree's content for the file is a state the base has MOVED PAST:
#                    what it held at the merge-base, or at any commit since, but not what it
#                    holds now
#
# The second is the one a green suite cannot see. A branch cut before a fix carries the pre-fix
# file, and a resolution that takes its own side re-asserts it; the merged tree then holds
# content the base retired, and nothing downstream reads that as a loss.
#
# A deliberate removal or revert says so in one of its own commit messages:
#
#   Removes-file: apps/macOS/Sources/Old.swift
#   Reverts-file: apps/macOS/Sources/Hub.swift
#
# `*` in place of a path declares the whole change, which is what a repair of a bad merge is.
#
# Usage:
#   sh scripts/undoes-the-base.sh <repo-dir> <base-ref> <merge-base-ref> <result-ref>
#
# <merge-base-ref> is merge-base(branch, base) taken BEFORE the rebase — afterwards it is the
# base itself and says nothing. <result-ref> is the rebased tree.
#
# Prints one "<rule> <path>" per line and exits 1 when there are any; exits 0 in silence
# otherwise.
set -eu

if [ "$#" -ne 4 ]; then
  echo "undoes-the-base: usage: undoes-the-base.sh <repo-dir> <base-ref> <merge-base-ref> <result-ref>" >&2
  exit 2
fi

DIR=$1
BASE=$2
MERGE_BASE=$3
RESULT=$4

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

blob() {
  git -C "$DIR" rev-parse --quiet --verify "$1:$2" 2>/dev/null || true
}

: >"$work/found"

# Rule 1. Deleted going from the base to the merged tree.
git -C "$DIR" diff --name-only --diff-filter=D "$BASE" "$RESULT" >"$work/deleted"
while IFS= read -r file; do
  [ -n "$file" ] || continue
  echo "deleted $file" >>"$work/found"
done <"$work/deleted"

# Rule 2. For each file the merged tree changes, the states the base has held for it since the
# cut and moved past. Its CURRENT state is excluded, so a file the branch left alone can never
# appear here — after a clean rebase that file reads the base's own blob.
git -C "$DIR" diff --name-only --diff-filter=d "$BASE" "$RESULT" >"$work/changed"
while IFS= read -r file; do
  [ -n "$file" ] || continue
  here=$(blob "$RESULT" "$file")
  [ -n "$here" ] || continue
  now=$(blob "$BASE" "$file")
  {
    blob "$MERGE_BASE" "$file"
    for commit in $(git -C "$DIR" rev-list "$MERGE_BASE..$BASE" -- "$file"); do
      blob "$commit" "$file"
    done
  } | sort -u | grep -v "^$now\$" >"$work/retired" || true
  if grep -qx "$here" "$work/retired" 2>/dev/null; then
    echo "reverted $file" >>"$work/found"
  fi
done <"$work/changed"

sort -u "$work/found" >"$work/undone"
[ -s "$work/undone" ] || exit 0

# Only the commits the branch adds to the base are read, so a trailer that arrived with the base
# cannot excuse a later removal.
git -C "$DIR" log --format=%B "$BASE..$RESULT" |
  sed -n -E 's/^[[:space:]]*(Removes-file|Reverts-file):[[:space:]]*(.*[^[:space:]])[[:space:]]*$/\2/p' |
  sort -u >"$work/declared"

if grep -qx '\*' "$work/declared" 2>/dev/null; then
  exit 0
fi

: >"$work/silent"
while IFS= read -r line; do
  path=${line#* }
  grep -qx "$path" "$work/declared" 2>/dev/null || echo "$line" >>"$work/silent"
done <"$work/undone"

[ -s "$work/silent" ] || exit 0
cat "$work/silent"
exit 1
